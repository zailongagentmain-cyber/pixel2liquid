/**
 * ShopifyClient - GraphQL API 客户端
 */
import type { ShopifyConfig, ShopifyProduct } from './types.js';
export type { ShopifyProduct } from './types.js';
export declare class ShopifyClient {
    private config;
    private endpoint;
    constructor(config: ShopifyConfig);
    /**
     * 执行 GraphQL 查询
     */
    private graphql;
    /**
     * 按 handle 查询单个产品
     */
    queryProductByHandle(handle: string): Promise<ShopifyProduct | null>;
    /**
     * 批量查询所有产品（分页）
     */
    queryAllProducts(): Promise<ShopifyProduct[]>;
    /**
     * 创建产品
     */
    createProduct(input: {
        title: string;
        handle: string;
        descriptionHtml?: string;
        vendor?: string;
        productType?: string;
        status?: 'DRAFT' | 'ACTIVE';
        images?: {
            url: string;
        }[];
    }): Promise<ShopifyProduct>;
    /**
     * 创建产品变体
     */
    createProductVariants(productId: string, variants: {
        title: string;
        price: string;
        sku?: string;
        inventoryItem?: {
            tracked: boolean;
        };
    }[]): Promise<void>;
    /**
     * 上传文件到 Shopify CDN
     * 返回公开的 CDN URL
     */
    uploadFile(filename: string, content: Buffer): Promise<string>;
    /**
     * 获取主题 assets 列表
     */
    getThemeAssets(): Promise<string[]>;
}
//# sourceMappingURL=ShopifyClient.d.ts.map