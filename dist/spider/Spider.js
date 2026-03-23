/**
 * Pixel2Liquid - Spider Main Class
 *
 * 采集目标：完整站点镜像，支持子页面递归采集
 */
import { chromium } from '@playwright/test';
import fse from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SiteCrawler } from './SiteCrawler.js';
import { AssetDownloader } from './AssetDownloader.js';
import { CSSProcessor } from './CSSProcessor.js';
import { PathResolver } from './PathResolver.js';
import { StaticRenderer } from './StaticRenderer.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class Spider {
    options;
    browser = null;
    state = {
        visited: new Set(),
        pending: [],
    };
    constructor(options) {
        this.options = {
            url: options.url,
            outputDir: options.outputDir,
            maxPages: options.maxPages ?? 50,
            followExternal: options.followExternal ?? false,
            proxy: options.proxy ?? '',
            timeout: options.timeout ?? 30000,
            userAgent: options.userAgent ?? '',
            headless: options.headless ?? true,
        };
    }
    /**
     * 执行完整站点采集
     */
    async crawl() {
        console.log(`\n🕷️  Pixel2Liquid Spider`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📍 URL: ${this.options.url}`);
        console.log(`📦 最大页面: ${this.options.maxPages}`);
        console.log(`🔗 跟随外部链接: ${this.options.followExternal ? '是' : '否'}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        // 1. 创建输出目录
        await this.prepareOutputDir();
        // 2. 启动浏览器
        await this.launchBrowser();
        // 3. 初始化爬虫
        const crawler = new SiteCrawler(this.browser, this.options, this.state);
        // 4. 采集所有页面
        const pages = await crawler.crawlAll();
        // 5. 处理每个页面
        console.log(`\n📦 处理 ${pages.length} 个页面...`);
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            console.log(`  [${i + 1}/${pages.length}] 处理: ${page.url}`);
            await this.processPage(page);
        }
        // 6. 生成站点地图
        const siteMap = {
            pages,
            entryUrl: this.options.url,
            collectedAt: new Date(),
            totalAssets: pages.reduce((sum, p) => sum + p.images.length + p.fonts.length + p.js.length, 0),
        };
        // 7. 保存站点地图
        await this.saveSiteMap(siteMap);
        // 8. 关闭浏览器
        await this.closeBrowser();
        console.log(`\n✅ 采集完成!`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📄 页面数: ${siteMap.pages.length}`);
        console.log(`📦 资源数: ${siteMap.totalAssets}`);
        console.log(`📁 输出目录: ${this.options.outputDir}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        return siteMap;
    }
    /**
     * 创建输出目录结构
     */
    async prepareOutputDir() {
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
    /**
     * 启动浏览器
     */
    async launchBrowser() {
        console.log(`🌐 启动浏览器...`);
        const launchOptions = {
            headless: this.options.headless,
        };
        if (this.options.proxy) {
            launchOptions.proxy = { server: this.options.proxy };
        }
        this.browser = await chromium.launch(launchOptions);
        // 设置默认User-Agent（BrowserContext在SiteCrawler中创建）
    }
    /**
     * 关闭浏览器
     */
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
    /**
     * 处理单个页面：下载资源、合并CSS、修复路径
     */
    async processPage(page) {
        const pageDir = path.dirname(page.localPath);
        await fse.ensureDir(path.join(this.options.outputDir, pageDir));
        // 1. 下载所有资源
        const downloader = new AssetDownloader(page, this.options.outputDir);
        const assets = await downloader.downloadAll();
        // 更新页面资源列表
        page.images = assets.filter(a => a.type === 'image');
        page.fonts = assets.filter(a => a.type === 'font');
        page.js = assets.filter(a => a.type === 'js');
        // 2. 处理CSS
        const cssProcessor = new CSSProcessor(page.html);
        page.css = await cssProcessor.bundle();
        // 3. 修复路径
        const pathResolver = new PathResolver(page, this.options.outputDir);
        pathResolver.resolve();
        page.html = pathResolver.getResolvedHtml();
        // 4. 静态化JS渲染（如需要）
        const renderer = new StaticRenderer(page, this.browser, this.options);
        await renderer.render();
        // 5. 保存页面
        await fse.writeFile(path.join(this.options.outputDir, page.localPath), page.html, 'utf-8');
        // 6. 保存CSS
        if (page.css.all) {
            await fse.writeFile(path.join(this.options.outputDir, 'assets', 'style.css'), page.css.all, 'utf-8');
        }
    }
    /**
     * 保存站点地图
     */
    async saveSiteMap(siteMap) {
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
//# sourceMappingURL=Spider.js.map