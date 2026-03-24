/**
 * Pixel2Liquid - Spider Main Class
 * 
 * 采集目标：完整站点镜像，支持子页面递归采集
 * 渐进式采集：Phase 1 快速扫描 + Phase 2 逐页完整采集
 */

import { chromium, Browser } from '@playwright/test';
import fse from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type {
  SpiderOptions,
  CollectedPage,
  SiteMap,
  Asset
} from './types.js';

import { SiteCrawler } from './SiteCrawler.js';
import { AssetDownloader } from './AssetDownloader.js';
import { CSSProcessor } from './CSSProcessor.js';
import { PathResolver } from './PathResolver.js';
import { StaticRenderer } from './StaticRenderer.js';
import { ResourceQueue } from './ResourceQueue.js';
import { LocalProxyServer } from './LocalProxyServer.js';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Spider {
  private options: Required<SpiderOptions>;
  private browser: Browser | null = null;
  private state: { visited: Set<string>; pending: string[]; context: any } = {
    visited: new Set<string>(),
    pending: [] as string[],
    context: null,
  };
  
  // 异步模式组件
  private resourceQueue: ResourceQueue | null = null;
  private proxyServer: LocalProxyServer | null = null;
  private proxyPort: number = 3002;

  constructor(options: SpiderOptions) {
    this.options = {
      url: options.url,
      outputDir: options.outputDir,
      maxPages: options.maxPages ?? 50,
      followExternal: options.followExternal ?? false,
      proxy: options.proxy ?? '',
      timeout: options.timeout ?? 30000,
      userAgent: options.userAgent ?? '',
      headless: options.headless ?? true,
      progressFile: options.progressFile ?? '',
      asyncMode: options.asyncMode ?? false,
      startProxyServer: options.startProxyServer ?? false,
      proxyPort: options.proxyPort ?? 3002,
    };
    this.proxyPort = this.options.proxyPort;
  }

  /**
   * 执行渐进式站点采集
   * Phase 1: 快速扫描获取URL列表
   * Phase 2: 逐页完整采集（含资源下载）
   * 
   * 异步模式 (asyncMode=true):
   * - HTML采集后立即返回，不等待资源下载
   * - 资源进入后台队列下载
   * - 可选启动本地预览服务器
   */
  async crawl(): Promise<SiteMap> {
    console.log(`\n🕷️  Pixel2Liquid Spider`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📍 URL: ${this.options.url}`);
    console.log(`📦 最大页面: ${this.options.maxPages}`);
    console.log(`🔗 跟随外部链接: ${this.options.followExternal ? '是' : '否'}`);
    console.log(`📋 模式: ${this.options.asyncMode ? '异步(立即返回)' : '同步(等待下载)'}`);
    if (this.options.asyncMode && this.options.startProxyServer) {
      console.log(`🔮 预览服务器: 启动 (端口 ${this.proxyPort})`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 创建输出目录
    await this.prepareOutputDir();

    // 初始化异步组件
    if (this.options.asyncMode) {
      await this.initAsyncMode();
    }

    // Phase 1: 快速扫描
    console.log(`📋 Phase 1: 快速扫描页面...`);
    const { pages: urlPages, sitemap: quickSitemap } = await this.phase1QuickScan();
    console.log(`📊 发现 ${urlPages.length} 个页面\n`);

    // Phase 2: 渐进式完整采集
    console.log(`📋 Phase 2: 逐页完整采集...`);
    const collectedPages = await this.phase2ProgressiveCollect(urlPages);

    // 生成站点地图
    const siteMap: SiteMap = {
      pages: collectedPages,
      entryUrl: this.options.url,
      collectedAt: new Date(),
      totalAssets: collectedPages.reduce((sum, p) =>
        sum + p.images.length + p.fonts.length + p.js.length, 0),
    };

    // 保存站点地图
    await this.saveSiteMap(siteMap);

    // 异步模式：启动后台资源下载
    if (this.options.asyncMode && this.resourceQueue) {
      console.log(`\n📦 启动后台资源下载队列...`);
      this.resourceQueue.startProcessing();
      
      this.resourceQueue.on('resource-completed', (res) => {
        console.log(`  ✅ 下载完成: ${res.url}`);
      });
      
      this.resourceQueue.on('resource-failed', (res) => {
        console.log(`  ❌ 下载失败: ${res.url} - ${res.error}`);
      });
      
      this.resourceQueue.on('idle', (stats) => {
        console.log(`\n📦 资源下载完成!`);
        console.log(`   完成: ${stats.completed}, 失败: ${stats.failed}`);
      });
    }

    console.log(`\n✅ 采集完成!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📄 页面数: ${siteMap.pages.length}`);
    console.log(`📦 资源数: ${siteMap.totalAssets}`);
    console.log(`📁 输出目录: ${this.options.outputDir}`);
    if (this.options.asyncMode && this.options.startProxyServer) {
      console.log(`🔮 预览服务器: http://localhost:${this.proxyPort}`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    return siteMap;
  }

  /**
   * 初始化异步模式组件
   */
  private async initAsyncMode(): Promise<void> {
    // 初始化资源队列
    this.resourceQueue = new ResourceQueue(this.options.outputDir, 3, 3);
    
    // 加载已有状态（断点续传）
    const stateFile = path.join(this.options.outputDir, '.resource-queue-state.json');
    await this.resourceQueue.loadState(stateFile);
    
    // 监听状态变化，自动保存
    this.resourceQueue.on('progress', async () => {
      await this.resourceQueue!.saveState(stateFile);
    });

    // 启动预览服务器
    if (this.options.startProxyServer) {
      this.proxyServer = new LocalProxyServer({
        port: this.proxyPort,
        outputDir: this.options.outputDir,
        baseUrl: this.options.url,
        resourceQueue: this.resourceQueue,
      });
      
      try {
        this.proxyPort = await this.proxyServer.start();
      } catch (e: any) {
        console.warn(`⚠️ 预览服务器启动失败: ${e.message}`);
      }
    }
  }

  /**
   * Phase 1: 快速扫描 - 只获取URL列表，不下载资源
   */
  private async phase1QuickScan(): Promise<{ pages: CollectedPage[]; sitemap: any }> {
    await this.launchBrowser();
    const crawler = new SiteCrawler(this.browser!, this.options, this.state);
    const pages = await crawler.crawlAll();

    // 保存快速扫描结果
    const scanResult = {
      entryUrl: this.options.url,
      scannedAt: new Date().toISOString(),
      totalPages: pages.length,
      pages: pages.map(p => ({
        url: p.url,
        localPath: p.localPath,
        title: p.metadata?.title || '',
      })),
    };
    await fse.writeJson(
      path.join(this.options.outputDir, 'quick-scan.json'),
      scanResult,
      { spaces: 2 }
    );

    await this.closeBrowser();
    return { pages, sitemap: scanResult };
  }

  /**
   * Phase 2: 渐进式完整采集 - 每页独立浏览器，完成后清理
   */
  private async phase2ProgressiveCollect(pages: CollectedPage[]): Promise<CollectedPage[]> {
    const collected: CollectedPage[] = [];
    const progressFile = path.join(this.options.outputDir, '.collection-progress.json');

    // 加载已完成的页面
    let completedUrls: Set<string> = new Set();
    let failedUrls: string[] = [];
    try {
      const progress = await fse.readJson(progressFile);
      completedUrls = new Set(progress.completedUrls || []);
      failedUrls = progress.failedUrls || [];
    } catch {}

    console.log(`📊 已完成: ${completedUrls.size}, 失败待重试: ${failedUrls.length}\n`);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageNum = i + 1;

      // 跳过已完成的
      if (completedUrls.has(page.url)) {
        console.log(`  [${pageNum}/${pages.length}] ⏭️  跳过(已完成)`);
        collected.push(page);
        continue;
      }

      const isRetry = failedUrls.includes(page.url);
      console.log(`  [${pageNum}/${pages.length}] ${isRetry ? '🔄' : '📦'} ${isRetry ? '重试' : '采集'}: ${page.url}`);

      try {
        // 为每页创建独立浏览器
        const pageBrowser = await this.launchIsolatedBrowser();

        let collectedPage: CollectedPage;
        try {
          // 采集单页（browser 在 collectSinglePage 内部已关闭）
          collectedPage = await this.collectSinglePage(page, pageBrowser.browser, pageBrowser.context);
        } finally {
          // 确保 browser 关闭（即使采集失败）
          try {
            await pageBrowser.browser.close();
          } catch {}
        }

        collected.push(collectedPage);
        completedUrls.add(page.url);

        // 保存进度
        await fse.writeJson(progressFile, {
          completedUrls: Array.from(completedUrls),
          failedUrls: failedUrls.filter(u => u !== page.url),
          lastUpdated: new Date().toISOString(),
        }, { spaces: 2 });

        console.log(`    ✅ 完成`);

        // 内存清理
        if (global.gc) global.gc();

      } catch (e: any) {
        console.log(`    ❌ 失败: ${e.message}`);
        failedUrls.push(page.url);

        await fse.writeJson(progressFile, {
          completedUrls: Array.from(completedUrls),
          failedUrls,
          lastUpdated: new Date().toISOString(),
        }, { spaces: 2 });
      }
    }

    // 保存错误日志
    if (failedUrls.length > 0) {
      await fse.writeJson(
        path.join(this.options.outputDir, 'errors.json'),
        { failedUrls, timestamp: new Date().toISOString() },
        { spaces: 2 }
      );
    }

    return collected;
  }

  /**
   * 启动独立浏览器（用于单页采集）
   */
  private async launchIsolatedBrowser(): Promise<{ browser: Browser; context: any }> {
    const launchOptions: any = { headless: this.options.headless };
    if (this.options.proxy) {
      launchOptions.proxy = { server: this.options.proxy };
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: this.options.userAgent ||
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      ignoreHTTPSErrors: true,
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      (window as any).chrome = { runtime: {} };
    });

    return { browser, context };
  }

  /**
   * 采集单个页面（含资源下载）
   * 
   * 异步模式 (asyncMode=true):
   * - 采集HTML后立即返回
   * - 资源URL加入队列，后台下载
   * - HTML中的资源URL保持原始地址（或替换为代理地址）
   */
  private async collectSinglePage(page: CollectedPage, browser: Browser, context: any): Promise<CollectedPage> {
    const pageObj = await context.newPage();
    const timeout = 60000;

    try {
      pageObj.setDefaultTimeout(timeout);

      const response = await pageObj.goto(page.url, {
        waitUntil: 'networkidle',
        timeout: 90000,
      });

      if (!response) throw new Error('No response');

      await pageObj.waitForLoadState('load').catch(() => {});
      // 短暂等待 JS 执行（1秒）
      await pageObj.waitForTimeout(1000);

      // 获取HTML
      const html = await pageObj.content();

      // ⚡ 立即关闭浏览器（最关键的优化）
      await pageObj.close().catch(() => {});
      await context.close().catch(() => {});

      // ===== 以下处理不需要浏览器 =====

      // 收集资源URL
      const assetUrls = this.collectAssetUrls(html);

      if (this.options.asyncMode && this.resourceQueue) {
        // 异步模式：URL加入队列，不等待下载
        const resources = assetUrls.map(({ url, type }) => ({ url, type }));
        this.resourceQueue.addResources(resources);

        // 如果启动了代理服务器，替换HTML中的URL为代理地址
        let processedHtml = html;
        if (this.proxyServer) {
          processedHtml = this.replaceUrlsWithProxy(html, assetUrls);
        }

        // 标记资源为虚拟（尚未下载）
        page.images = assetUrls.filter(a => a.type === 'image').map(a => ({
          url: a.url,
          localPath: this.resourceQueue!.getLocalPath(a.url) || a.url,
          type: 'image' as const,
        }));
        page.fonts = assetUrls.filter(a => a.type === 'font').map(a => ({
          url: a.url,
          localPath: this.resourceQueue!.getLocalPath(a.url) || a.url,
          type: 'font' as const,
        }));
        page.js = assetUrls.filter(a => a.type === 'js').map(a => ({
          url: a.url,
          localPath: this.resourceQueue!.getLocalPath(a.url) || a.url,
          type: 'js' as const,
        }));

        console.log(`    📦 资源已加入队列: ${assetUrls.length} 个 (后台下载中)`);

        // 保存页面（使用处理后的HTML）
        const pageDir = path.dirname(page.localPath);
        await fse.ensureDir(path.join(this.options.outputDir, pageDir));
        await fse.writeFile(
          path.join(this.options.outputDir, page.localPath),
          processedHtml,
          'utf-8'
        );

        // 释放大字符串内存
        page.html = processedHtml;
      } else {
        // 同步模式：下载所有资源
        page.html = html;
        const downloader = new AssetDownloader(page, this.options.outputDir);
        const assets = await downloader.downloadAll();

        page.images = assets.filter(a => a.type === 'image');
        page.fonts = assets.filter(a => a.type === 'font');
        page.js = assets.filter(a => a.type === 'js');

        // 处理CSS
        const cssProcessor = new CSSProcessor(html);
        page.css = await cssProcessor.bundle();

        // 修复路径
        const pathResolver = new PathResolver(page, this.options.outputDir);
        pathResolver.resolve();
        const resolvedHtml = pathResolver.getResolvedHtml();

        // 保存页面
        const pageDir = path.dirname(page.localPath);
        await fse.ensureDir(path.join(this.options.outputDir, pageDir));
        await fse.writeFile(
          path.join(this.options.outputDir, page.localPath),
          resolvedHtml,
          'utf-8'
        );

        // 释放大字符串内存
        page.html = resolvedHtml;
      }

      return page;

    } catch (e: any) {
      await pageObj.close().catch(() => {});
      throw new Error(`采集失败: ${e.message}`);
    }
  }

  /**
   * 收集HTML中的所有资源URL
   */
  private collectAssetUrls(html: string): Array<{ url: string; type: Asset['type'] }> {
    const $ = cheerio.load(html);
    const urls: Array<{ url: string; type: Asset['type'] }> = [];
    const seen = new Set<string>();

    // 图片
    $('img[src]').each((_: any, el: any) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('data:') && !seen.has(src)) {
        seen.add(src);
        urls.push({ url: src, type: 'image' });
      }
    });

    // 图片 srcset
    $('img[srcset]').each((_: any, el: any) => {
      const srcset = $(el).attr('srcset') || '';
      const re = /https?:\/\/[^\s,]+/g;
      const matches = srcset.match(re);
      if (matches) {
        for (const src of matches) {
          if (!seen.has(src)) {
            seen.add(src);
            urls.push({ url: src, type: 'image' });
          }
        }
      }
    });

    // CSS
    $('link[rel="stylesheet"][href]').each((_: any, el: any) => {
      const href = $(el).attr('href');
      if (href && !seen.has(href)) {
        seen.add(href);
        urls.push({ url: href, type: 'css' });
      }
    });

    // JS
    $('script[src]').each((_: any, el: any) => {
      const src = $(el).attr('src');
      if (src && !seen.has(src)) {
        seen.add(src);
        urls.push({ url: src, type: 'js' });
      }
    });

    // 字体
    $('style').each((_: any, el: any) => {
      const css = $(el).html() || '';
      const fontRe = /url\(['"]?(https?:\/\/[^'")]+)['"]?\)/g;
      let match;
      while ((match = fontRe.exec(css)) !== null) {
        const fontUrl = match[1];
        if (!seen.has(fontUrl)) {
          seen.add(fontUrl);
          urls.push({ url: fontUrl, type: 'font' });
        }
      }
    });

    return urls;
  }

  /**
   * 将HTML中的资源URL替换为代理服务器地址
   */
  private replaceUrlsWithProxy(html: string, assets: Array<{ url: string; type: Asset['type'] }>): string {
    if (!this.proxyServer) return html;
    
    let result = html;
    for (const asset of assets) {
      const proxyUrl = this.proxyServer.getProxyUrl(asset.url);
      result = result.split(asset.url).join(proxyUrl);
    }
    return result;
  }

  // ==================== 原有的辅助方法 ====================

  private async prepareOutputDir(): Promise<void> {
    const dirs = [
      this.options.outputDir,
      path.join(this.options.outputDir, 'assets'),
      path.join(this.options.outputDir, 'assets', 'images'),
      path.join(this.options.outputDir, 'assets', 'fonts'),
      path.join(this.options.outputDir, 'assets', 'js'),
      path.join(this.options.outputDir, 'assets', 'css'),
    ];
    for (const dir of dirs) {
      await fse.ensureDir(dir);
    }
  }

  private async launchBrowser(): Promise<void> {
    console.log(`🌐 启动浏览器...`);
    const launchOptions: any = { headless: this.options.headless };
    if (this.options.proxy) {
      launchOptions.proxy = { server: this.options.proxy };
    }
    this.browser = await chromium.launch(launchOptions);
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: this.options.userAgent ||
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      ignoreHTTPSErrors: true,
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      (window as any).chrome = { runtime: {} };
    });
    this.state.context = context;
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 标记任务失败（供CLI调用）
   */
  async fail(error: string): Promise<void> {
    console.error(`❌ 采集失败: ${error}`);
    await this.closeBrowser();
  }

  private async saveSiteMap(siteMap: SiteMap): Promise<void> {
    const mapFile = path.join(this.options.outputDir, 'sitemap.json');
    const summary = {
      entryUrl: siteMap.entryUrl,
      collectedAt: siteMap.collectedAt.toISOString(),
      totalPages: siteMap.pages.length,
      totalAssets: siteMap.totalAssets,
      pages: siteMap.pages.map(p => ({
        url: p.url,
        localPath: p.localPath,
        title: p.metadata.title,
      })),
    };
    await fse.writeJson(mapFile, summary, { spaces: 2 });
  }
}
