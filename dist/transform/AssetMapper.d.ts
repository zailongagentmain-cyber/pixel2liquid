/**
 * AssetMapper - 资源映射
 *
 * 解析 HTML 中的 Shopify CDN URL，生成 Liquid asset_url filter 引用
 */
import { AssetMapping } from './types.js';
export declare class AssetMapper {
    /**
     * 从 HTML 中提取所有 Shopify CDN URL
     */
    extractCdnUrls(html: string): string[];
    /**
     * 判断是否是 Shopify CDN URL
     */
    isShopifyCdn(url: string): boolean;
    /**
     * 解析 Shopify CDN URL，提取文件信息
     *
     * 格式: https://cdn.shopify.com/s/files/1/0913/4689/5219/files/base.css?v=123
     */
    parseCdnUrl(cdnUrl: string): {
        filename: string;
        path: string;
        assetType: AssetMapping['assetType'];
    };
    /**
     * 根据扩展名和目录判断资源类型
     */
    private getAssetType;
    /**
     * 生成 Liquid asset filter 引用
     */
    generateLiquidReference(filename: string, assetType: AssetMapping['assetType']): string;
    /**
     * 检查目标店铺是否有同名资源
     */
    checkAssetExists(filename: string, themeAssets: string[]): Promise<boolean>;
    /**
     * 构建资源映射表
     */
    buildAssetMappings(html: string, themeAssets: string[]): Promise<AssetMapping[]>;
}
//# sourceMappingURL=AssetMapper.d.ts.map