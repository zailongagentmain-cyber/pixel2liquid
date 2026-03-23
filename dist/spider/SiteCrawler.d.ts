/**
 * Pixel2Liquid - SiteCrawler
 *
 * 站点爬虫：递归采集所有子页面
 */
import { Browser } from '@playwright/test';
import type { SpiderOptions, CollectedPage } from './types.js';
export declare class SiteCrawler {
    private browser;
    private options;
    private state;
    constructor(browser: Browser, options: Required<SpiderOptions>, state: {
        visited: Set<string>;
        pending: string[];
    });
    /**
     * 采集所有页面
     */
    crawlAll(): Promise<CollectedPage[]>;
    /**
     * 采集单个页面
     */
    private crawlPage;
    /**
     * 获取完整HTML（包含动态渲染内容）
     */
    private getFullHtml;
    /**
     * 滚动页面触发懒加载内容
     */
    private scrollPage;
    /**
     * 从HTML中提取链接
     */
    private extractLinksFromHtml;
    /**
     * 从页面对象提取链接
     */
    private extractLinks;
    /**
     * 提取页面元数据
     */
    private extractMetadata;
    /**
     * 解析URL为绝对路径
     */
    private resolveUrl;
    /**
     * 判断是否为内部链接
     */
    private isInternalUrl;
    /**
     * 将URL转换为本地文件路径
     */
    private urlToLocalPath;
}
//# sourceMappingURL=SiteCrawler.d.ts.map