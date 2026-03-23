/**
 * Pixel2Liquid - StaticRenderer
 * 
 * JS静态化渲染：等待动态内容加载完成后提取HTML
 */

import { Browser, Page } from '@playwright/test';

import type { CollectedPage, SpiderOptions } from './types.js';

export class StaticRenderer {
  private page: CollectedPage;
  private browser: Browser;
  private options: Required<SpiderOptions>;

  constructor(page: CollectedPage, browser: Browser, options: Required<SpiderOptions>) {
    this.page = page;
    this.browser = browser;
    this.options = options;
  }

  /**
   * 渲染页面：等待JS执行完成，获取完整HTML
   */
  async render(): Promise<void> {
    try {
      const context = await this.browser.newContext({
        userAgent: this.options.userAgent || undefined,
        viewport: { width: 1920, height: 1080 },
      });

      const page = await context.newPage();
      page.setDefaultTimeout(this.options.timeout);

      // 1. 设置静态资源路径（本地文件）
      // 由于资源已下载到本地，需要替换URL为本地路径
      const localHtml = this.prepareLocalHtml();
      
      // 2. 加载页面内容
      await page.setContent(localHtml, {
        waitUntil: 'domcontentloaded',
      });

      // 3. 等待网络空闲
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        // 忽略超时
      });

      // 4. 等待可能的JS渲染
      await this.waitForDynamicContent(page);

      // 5. 滚动页面触发懒加载
      await this.scrollPage(page);

      // 6. 获取渲染后的HTML
      this.page.html = await page.content();

      await context.close();

    } catch (error: any) {
      console.warn(`    ⚠️  静态渲染失败: ${error.message}`);
      // 保留原始HTML
    }
  }

  /**
   * 准备本地HTML（替换资源路径为本地）
   */
  private prepareLocalHtml(): string {
    let html = this.page.html;

    // 替换图片路径
    for (const img of this.page.images) {
      const localPath = `file://${this.options.outputDir}/${img.localPath}`;
      html = html.replace(new RegExp(this.escapeRegex(img.url), 'g'), localPath);
    }

    // 替换字体路径
    for (const font of this.page.fonts) {
      const localPath = `file://${this.options.outputDir}/${font.localPath}`;
      html = html.replace(new RegExp(this.escapeRegex(font.url), 'g'), localPath);
    }

    return html;
  }

  /**
   * 等待动态内容渲染完成
   */
  private async waitForDynamicContent(page: Page): Promise<void> {
    // 策略1: 等待特定时间让JS执行
    await page.waitForTimeout(1000);

    // 策略2: 检测常见动态内容加载
    const dynamicSelectors = [
      // React/Vue 应用
      '#root', '#app', '[data-v-app]',
      // 懒加载图片
      'img[loading="lazy"]',
      // 无限滚动容器
      '[class*="infinite"]', '[class*="load-more"]',
      // 动态表格
      'table[data-loaded]',
    ];

    for (const selector of dynamicSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          // 等待元素可见
          await page.waitForSelector(selector, { state: 'visible', timeout: 2000 }).catch(() => {});
        }
      } catch {
        // 忽略选择器错误
      }
    }

    // 策略3: 检测AJAX请求完成
    // 通过检查页面是否有loading状态变化
    await page.waitForFunction(() => {
      const loading = document.querySelector('[class*="loading"], [class*="skeleton"]');
      return !loading || window.getComputedStyle(loading).display === 'none';
    }, { timeout: 3000 }).catch(() => {});
  }

  /**
   * 滚动页面触发懒加载
   */
  private async scrollPage(page: Page): Promise<void> {
    try {
      await page.evaluate(async () => {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        // 逐步滚动，让懒加载生效
        const scrollHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        const steps = Math.ceil(scrollHeight / viewportHeight);
        
        for (let i = 0; i <= steps; i++) {
          window.scrollTo(0, i * viewportHeight);
          await delay(200);
        }
        
        // 滚回顶部
        window.scrollTo(0, 0);
        await delay(200);
      });
    } catch {
      // 忽略滚动错误
    }
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
