/**
 * ProductBlock.ts - 产品页 Block
 *
 * 识别：产品标题、价格、图片、描述、变体选择器
 */
import type { Block, BlockData, BlockSchema } from './Block.js';
export declare class ProductBlock implements Block {
    name: string;
    /**
     * 判断元素是否属于产品页内容
     */
    canHandle(element: any, cssAst?: any): boolean;
    /**
     * 从产品页元素中提取数据
     */
    extract(element: any, cssAst?: any): BlockData;
    /**
     * 生成 Product Liquid 模板
     */
    generateLiquid(data: BlockData): string;
    /**
     * 生成 Product Block Schema
     */
    generateSchema(data?: BlockData): BlockSchema;
    private isTitle;
    private isPrice;
    private isImage;
    private isDescription;
    private isVariantSelector;
    private isButton;
    private extractPriceAmount;
    private detectCurrency;
    private extractSelectOptions;
    private getSelector;
}
//# sourceMappingURL=ProductBlock.d.ts.map