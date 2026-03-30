/**
 * HomeBlock.ts - 首页 Block
 *
 * 识别：hero banner、featured products、logo list
 */
import type { Block, BlockData, BlockSchema } from './Block.js';
export declare class HomeBlock implements Block {
    name: string;
    /**
     * 判断元素是否属于首页内容
     */
    canHandle(element: any, cssAst?: any): boolean;
    /**
     * 从首页元素中提取数据
     */
    extract(element: any, cssAst?: any): BlockData;
    /**
     * 生成 Home Liquid 模板
     */
    generateLiquid(data: BlockData): string;
    /**
     * 生成 Home Block Schema
     */
    generateSchema(data?: BlockData): BlockSchema;
    private isHeroBanner;
    private isFeaturedProducts;
    private isLogoList;
    private isTestimonial;
    private isImageGallery;
    private isAnnouncementBar;
    private isPromoBanner;
    private extractProductHandles;
    private extractLogos;
    private extractTestimonials;
    private extractGalleryImages;
    private getSelector;
}
//# sourceMappingURL=HomeBlock.d.ts.map