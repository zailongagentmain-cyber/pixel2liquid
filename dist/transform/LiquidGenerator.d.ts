/**
 * LiquidGenerator - Liquid 模板生成
 *
 * 生成 Shopify Liquid 主题模板
 */
import { PageStructure, BlockMap, ProductMap, AssetMapping } from './types.js';
export declare class LiquidGenerator {
    /**
     * 生成产品页 Liquid 模板
     */
    generateProductTemplate(page: PageStructure): string;
    /**
     * 生成 Collection 页 Liquid 模板
     */
    generateCollectionTemplate(page: PageStructure): string;
    /**
     * 生成首页 Liquid 模板
     */
    generateHomeTemplate(page: PageStructure): string;
    /**
     * 生成 product.json (Section 配置)
     */
    generateProductJson(page: PageStructure, productMap: ProductMap): string;
    /**
     * 生成 Section schema
     */
    generateSectionSchema(blocks: BlockMap[]): string;
    /**
     * 生成 Collection schema
     */
    generateCollectionSchema(): string;
    /**
     * 生成产品区块 HTML
     */
    private generateProductBlocks;
    /**
     * 生成首页区块
     */
    private generateHomeBlocks;
    /**
     * 替换 HTML 中的 CDN URL 为 Liquid filter
     */
    replaceCdnWithLiquid(html: string, assetMappings: AssetMapping[]): string;
    /**
     * 生成主题目录结构
     */
    generateThemeStructure(): Record<string, string>;
    /**
     * 转义正则字符串
     */
    private escapeRegex;
}
//# sourceMappingURL=LiquidGenerator.d.ts.map