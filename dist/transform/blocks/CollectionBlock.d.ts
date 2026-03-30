/**
 * CollectionBlock.ts - Collection 页 Block
 *
 * 识别：产品网格、分页、筛选栏、collection 标题
 */
import type { Block, BlockData, BlockSchema } from './Block.js';
export declare class CollectionBlock implements Block {
    name: string;
    /**
     * 判断元素是否属于 Collection 页内容
     */
    canHandle(element: any, cssAst?: any): boolean;
    /**
     * 从 Collection 页元素中提取数据
     */
    extract(element: any, cssAst?: any): BlockData;
    /**
     * 生成 Collection Liquid 模板
     */
    generateLiquid(data: BlockData): string;
    /**
     * 生成 Collection Block Schema
     */
    generateSchema(data?: BlockData): BlockSchema;
    private isProductGrid;
    private isFilterBar;
    private isSortDropdown;
    private isPagination;
    private isCollectionHeader;
    private isToolbar;
    private extractProductItems;
    private extractFilters;
    private extractSortOptions;
    private extractPages;
    private getSelector;
}
//# sourceMappingURL=CollectionBlock.d.ts.map