/**
 * OperationSummaryGenerator - 操作清单生成
 *
 * 生成需要用户确认的操作清单（消耗 API 点数的操作）
 */
import { PageStructure, ProductMap, AssetMapping, OperationSummary } from './types.js';
import { ShopifyClient } from './ShopifyClient.js';
export declare class OperationSummaryGenerator {
    /**
     * 生成操作清单
     */
    generate(pages: PageStructure[], productMatches: ProductMap[], assetMappings: AssetMapping[], shopifyClient: ShopifyClient): Promise<OperationSummary>;
    /**
     * 生成操作清单的友好展示
     */
    formatSummary(summary: OperationSummary): string;
    /**
     * 把 handle 转换成可读标题
     */
    private handleToTitle;
}
//# sourceMappingURL=OperationSummary.d.ts.map