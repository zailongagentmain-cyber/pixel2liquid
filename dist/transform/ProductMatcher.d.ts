/**
 * ProductMatcher - 产品匹配
 *
 * 从目标 Shopify 店铺获取产品列表，本地匹配源站产品
 */
import { ShopifyClient, ShopifyProduct } from './ShopifyClient.js';
import { ProductMap } from './types.js';
export declare class ProductMatcher {
    private shopifyClient;
    private cacheDir;
    constructor(shopifyClient: ShopifyClient, cacheDir?: string);
    /**
     * 拉取目标店铺所有产品
     * 优先从本地缓存读取
     */
    fetchTargetProducts(forceRefresh?: boolean): Promise<Map<string, ShopifyProduct>>;
    /**
     * 本地匹配源站产品和目标店铺产品
     */
    match(sourceHandles: string[], targetProducts: Map<string, ShopifyProduct>): ProductMap[];
    /**
     * 找出需要创建的产品
     */
    getMissingProducts(matches: ProductMap[]): ProductMap[];
    /**
     * 统计匹配情况
     */
    getMatchStats(matches: ProductMap[]): {
        matched: number;
        missing: number;
    };
}
//# sourceMappingURL=ProductMatcher.d.ts.map