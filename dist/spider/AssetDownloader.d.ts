/**
 * Pixel2Liquid - AssetDownloader
 *
 * 资源下载器：并发下载图片/CSS/JS/字体资源
 */
import type { CollectedPage, Asset } from './types.js';
export declare class AssetDownloader {
    private assets;
    private concurrency;
    private page;
    private outputDir;
    constructor(page: CollectedPage, outputDir: string);
    /**
     * 下载页面所有资源
     */
    downloadAll(): Promise<Asset[]>;
    /**
     * 收集页面所有资源URL
     */
    private collectAssetUrls;
    /**
     * 从CSS中提取字体URL
     */
    private extractFontUrls;
    /**
     * 下载单个资源
     */
    private downloadAsset;
    /**
     * URL转文件名
     */
    private urlToFilename;
    /**
     * 字符串转哈希（用于生成唯一文件名）
     */
    private hashString;
    /**
     * 获取资源子目录
     */
    private getAssetSubdir;
    /**
     * 根据URL和Content-Type判断资源类型
     */
    private getAssetType;
    /**
     * Content-Type转文件扩展名
     */
    private contentTypeToExt;
    /**
     * 将数组分块
     */
    private chunkArray;
}
//# sourceMappingURL=AssetDownloader.d.ts.map