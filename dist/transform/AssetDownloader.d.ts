/**
 * AssetDownloader - Download assets from source CDN
 */
export interface DownloadedAsset {
    cdnUrl: string;
    localPath: string;
    filename: string;
}
export declare class AssetDownloader {
    private outputDir;
    private maxConcurrency;
    private downloadedAssets;
    constructor(outputDir: string, maxConcurrency?: number);
    /**
     * Extract all CDN URLs from HTML content
     */
    extractCdnUrls(html: string): string[];
    /**
     * Check if URL is a downloadable asset
     */
    private isAssetUrl;
    /**
     * Download a single asset
     */
    downloadAsset(cdnUrl: string): Promise<DownloadedAsset | null>;
    /**
     * Get filename from URL
     */
    private getFilenameFromUrl;
    /**
     * Get local path structure for asset
     */
    private getLocalPath;
    /**
     * Download all assets with concurrency control
     */
    downloadAll(urls: string[]): Promise<DownloadedAsset[]>;
    /**
     * Get download summary
     */
    getSummary(): {
        total: number;
        cdnUrl: string;
        localPath: string;
    }[];
}
//# sourceMappingURL=AssetDownloader.d.ts.map