/**
 * HtmlParser - HTML 结构解析
 *
 * 解析采集的 HTML，识别页面类型、结构和产品引用
 */
import { PageStructure, BlockMap } from './types.js';
export declare class HtmlParser {
    /**
     * 解析 HTML 文件
     */
    parse(html: string, url: string, localPath: string): PageStructure;
    /**
     * 检测页面类型
     */
    detectPageType(url: string, html: string): 'product' | 'collection' | 'home' | 'blog';
    /**
     * 从 URL 提取 handle
     */
    extractHandle(url: string): string;
    /**
     * 提取所有 gp-product 组件的产品 handle
     */
    extractGpProducts(html: string): string[];
    /**
     * 提取产品链接中的 handle
     */
    extractProductLinks(html: string): string[];
    /**
     * 提取页面中所有产品 handle（gp-product + 链接）
     */
    extractProductHandles(html: string): string[];
    /**
     * 提取产品展示区块
     */
    extractProductBlocks(html: string): BlockMap[];
    /**
     * 提取页面区块（根据页面类型）
     */
    extractBlocks(html: string, pageType: 'product' | 'collection' | 'home' | 'blog'): BlockMap[];
    /**
     * 生成唯一选择器
     */
    private getSelector;
    /**
     * 从 URL 提取文件名
     */
    private extractFilename;
}
//# sourceMappingURL=HtmlParser.d.ts.map