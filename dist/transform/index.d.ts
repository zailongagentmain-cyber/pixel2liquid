/**
 * Transform - Pixel2Liquid 转换引擎
 *
 * 将采集的 HTML 转换为 Shopify Liquid 主题
 */
import { TransformConfig, OperationSummary } from './types.js';
export declare class Transformer {
    private config;
    private shopifyClient;
    private htmlParser;
    private assetMapper;
    private productMatcher;
    private liquidGenerator;
    private summaryGenerator;
    constructor(config: TransformConfig);
    /**
     * 执行完整 Transform 流程
     */
    transform(): Promise<OperationSummary>;
    /**
     * 执行已确认的操作
     */
    executeConfirmed(summary: OperationSummary): Promise<void>;
    /**
     * 生成 Liquid 主题文件（本地，无 API 消耗）
     */
    generateThemeFiles(): Promise<void>;
    /**
     * 解析 HTML 文件
     */
    private parseHtmlFiles;
    /**
     * 读取 HTML 文件
     */
    private readHtml;
    /**
     * 查找所有 HTML 文件
     */
    private findHtmlFiles;
    /**
     * 从本地路径推断 URL
     */
    private getUrlFromPath;
}
/**
 * CLI 入口函数
 */
export declare function runTransform(sourceDir: string, outputDir: string, shop: string, token: string): Promise<void>;
//# sourceMappingURL=index.d.ts.map