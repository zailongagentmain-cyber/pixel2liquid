/**
 * AssetDownloader - Download assets from source CDN
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
export class AssetDownloader {
    outputDir;
    maxConcurrency;
    downloadedAssets = [];
    constructor(outputDir, maxConcurrency = 3) {
        this.outputDir = outputDir;
        this.maxConcurrency = maxConcurrency;
    }
    /**
     * Extract all CDN URLs from HTML content
     */
    extractCdnUrls(html) {
        const urls = new Set();
        // Match cdn.shopify.com URLs
        const regex = /cdn\.shopify\.com\/[^\s"'<>]+/g;
        const matches = html.match(regex) || [];
        for (const url of matches) {
            // Clean up URL
            let cleanUrl = url.replace(/[&?].*$/, '').replace(/["']/g, '');
            if (this.isAssetUrl(cleanUrl)) {
                urls.add(cleanUrl);
            }
        }
        return [...urls];
    }
    /**
     * Check if URL is a downloadable asset
     */
    isAssetUrl(url) {
        const ext = url.split('.').pop()?.toLowerCase();
        return ['css', 'js', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'woff', 'woff2', 'ttf'].includes(ext || '');
    }
    /**
     * Download a single asset
     */
    async downloadAsset(cdnUrl) {
        try {
            // Convert CDN URL to local path
            const filename = this.getFilenameFromUrl(cdnUrl);
            const localPath = this.getLocalPath(cdnUrl);
            const fullPath = join(this.outputDir, 'assets', localPath);
            // Skip if already downloaded
            if (existsSync(fullPath)) {
                return { cdnUrl, localPath: join('assets', localPath), filename };
            }
            // Create directory
            mkdirSync(dirname(fullPath), { recursive: true });
            // Download
            const url = cdnUrl.startsWith('http') ? cdnUrl : `https://${cdnUrl}`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                }
            });
            if (!response.ok) {
                console.warn(`   ⚠️  Failed to download: ${url} (${response.status})`);
                return null;
            }
            const buffer = await response.arrayBuffer();
            writeFileSync(fullPath, Buffer.from(buffer));
            return { cdnUrl, localPath: join('assets', localPath), filename };
        }
        catch (e) {
            console.warn(`   ⚠️  Download error: ${cdnUrl} - ${e.message}`);
            return null;
        }
    }
    /**
     * Get filename from URL
     */
    getFilenameFromUrl(url) {
        const parts = url.split('/');
        return parts[parts.length - 1].split('?')[0];
    }
    /**
     * Get local path structure for asset
     */
    getLocalPath(cdnUrl) {
        // Extract path after store ID
        const match = cdnUrl.match(/files\/\d+\/(.+)/);
        if (match) {
            return match[1].split('?')[0];
        }
        // For theme assets like /t/9/assets/
        const themeMatch = cdnUrl.match(/t\/\d+\/(.+)/);
        if (themeMatch) {
            return themeMatch[1].split('?')[0];
        }
        return this.getFilenameFromUrl(cdnUrl);
    }
    /**
     * Download all assets with concurrency control
     */
    async downloadAll(urls) {
        const uniqueUrls = [...new Set(urls)];
        console.log(`📦 Downloading ${uniqueUrls.length} assets...`);
        const results = [];
        let completed = 0;
        // Process in batches
        for (let i = 0; i < uniqueUrls.length; i += this.maxConcurrency) {
            const batch = uniqueUrls.slice(i, i + this.maxConcurrency);
            const batchResults = await Promise.all(batch.map(url => this.downloadAsset(url)));
            for (const result of batchResults) {
                if (result) {
                    results.push(result);
                    completed++;
                }
            }
            console.log(`   Progress: ${completed}/${uniqueUrls.length}`);
        }
        this.downloadedAssets = results;
        console.log(`✅ Downloaded ${results.length} assets\n`);
        return results;
    }
    /**
     * Get download summary
     */
    getSummary() {
        return this.downloadedAssets.map(a => ({
            total: this.downloadedAssets.length,
            cdnUrl: a.cdnUrl,
            localPath: a.localPath
        }));
    }
}
//# sourceMappingURL=AssetDownloader.js.map