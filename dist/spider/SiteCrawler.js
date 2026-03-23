/**
 * Pixel2Liquid - SiteCrawler
 *
 * 站点爬虫：递归采集所有子页面
 */
import * as cheerio from 'cheerio';
import * as path from 'path';
export class SiteCrawler {
    browser;
    options;
    state;
    constructor(browser, options, state) {
        this.browser = browser;
        this.options = options;
        this.state = state;
        // 初始化待采集队列
        if (this.state.pending.length === 0) {
            this.state.pending.push(options.url);
        }
    }
    /**
     * 采集所有页面
     */
    async crawlAll() {
        const pages = [];
        while (this.state.pending.length > 0) {
            // 检查是否达到最大页面数
            if (pages.length >= this.options.maxPages) {
                console.log(`  ⚠️  达到最大页面数限制 (${this.options.maxPages})`);
                break;
            }
            const url = this.state.pending.shift();
            // 跳过已访问的URL
            if (this.state.visited.has(url)) {
                continue;
            }
            this.state.visited.add(url);
            // 采集页面
            const page = await this.crawlPage(url);
            if (page) {
                pages.push(page);
                // 收集新链接
                const newLinks = this.extractLinks(page);
                for (const link of newLinks) {
                    if (!this.state.visited.has(link)) {
                        this.state.pending.push(link);
                    }
                }
                console.log(`  ✅ ${page.url}`);
            }
            else {
                console.log(`  ❌ ${url}`);
            }
        }
        return pages;
    }
    /**
     * 采集单个页面
     */
    async crawlPage(url) {
        try {
            const context = await this.browser.newContext({
                userAgent: this.options.userAgent || undefined,
                viewport: { width: 1920, height: 1080 },
            });
            const page = await context.newPage();
            // 设置超时
            page.setDefaultTimeout(this.options.timeout);
            // 访问页面
            const response = await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: this.options.timeout,
            });
            if (!response || !response.ok()) {
                await context.close();
                return null;
            }
            // 获取完整HTML
            const html = await this.getFullHtml(page);
            // 提取元数据
            const metadata = this.extractMetadata(html, url);
            // 生成本地路径
            const localPath = this.urlToLocalPath(url);
            // 提取页面链接
            const links = this.extractLinksFromHtml(html, url);
            const collectedPage = {
                url,
                localPath,
                html,
                css: {
                    all: '',
                    inline: '',
                    external: [],
                    critical: '',
                    nonCritical: '',
                },
                images: [],
                fonts: [],
                js: [],
                links,
                metadata,
            };
            await context.close();
            return collectedPage;
        }
        catch (error) {
            console.error(`  ❌ 采集失败: ${error.message}`);
            return null;
        }
    }
    /**
     * 获取完整HTML（包含动态渲染内容）
     */
    async getFullHtml(page) {
        // 等待网络空闲
        await page.waitForLoadState('networkidle');
        // 滚动页面触发懒加载
        await this.scrollPage(page);
        // 获取HTML
        return await page.content();
    }
    /**
     * 滚动页面触发懒加载内容
     */
    async scrollPage(page) {
        try {
            await page.evaluate(async () => {
                const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                // 滚动到底部
                window.scrollTo(0, document.body.scrollHeight);
                await delay(500);
                // 再滚动回顶部
                window.scrollTo(0, 0);
                await delay(500);
            });
        }
        catch {
            // 忽略滚动错误
        }
    }
    /**
     * 从HTML中提取链接
     */
    extractLinksFromHtml(html, baseUrl) {
        const $ = cheerio.load(html);
        const links = [];
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            if (!href)
                return;
            const fullUrl = this.resolveUrl(href, baseUrl);
            if (this.isInternalUrl(fullUrl)) {
                links.push(fullUrl);
            }
        });
        return [...new Set(links)];
    }
    /**
     * 从页面对象提取链接
     */
    extractLinks(page) {
        return page.links;
    }
    /**
     * 提取页面元数据
     */
    extractMetadata(html, url) {
        const $ = cheerio.load(html);
        const metadata = {};
        metadata.title = $('title').text().trim();
        metadata.description = $('meta[name="description"]').attr('content') || '';
        metadata.viewport = $('meta[name="viewport"]').attr('content') || '';
        metadata.charset = $('meta[charset]').attr('charset') ||
            $('meta[http-equiv="Content-Type"]').attr('content') || '';
        return metadata;
    }
    /**
     * 解析URL为绝对路径
     */
    resolveUrl(href, baseUrl) {
        try {
            return new URL(href, baseUrl).href;
        }
        catch {
            return href;
        }
    }
    /**
     * 判断是否为内部链接
     */
    isInternalUrl(url) {
        if (this.options.followExternal)
            return true;
        try {
            const parsed = new URL(url);
            const base = new URL(this.options.url);
            return parsed.hostname === base.hostname;
        }
        catch {
            return false;
        }
    }
    /**
     * 将URL转换为本地文件路径
     */
    urlToLocalPath(url) {
        try {
            const parsed = new URL(url);
            let pathname = parsed.pathname;
            // 移除末尾斜杠
            pathname = pathname.replace(/\/$/, '');
            // 根路径返回index.html
            if (pathname === '' || pathname === '/') {
                return 'index.html';
            }
            // 保持路径结构
            pathname = pathname.slice(1); // 移除开头的/
            // 如果是目录，添加index.html
            if (!path.extname(pathname)) {
                pathname = path.join(pathname, 'index.html');
            }
            // 确保是.html结尾（因为我们采集的是页面）
            if (!pathname.endsWith('.html')) {
                pathname += '.html';
            }
            return pathname;
        }
        catch {
            return 'index.html';
        }
    }
}
//# sourceMappingURL=SiteCrawler.js.map