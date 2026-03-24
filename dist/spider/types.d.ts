/**
 * Pixel2Liquid - Spider Module Types
 */
export interface Asset {
    url: string;
    localPath: string;
    type: 'image' | 'font' | 'js' | 'css';
    size?: number;
    mimeType?: string;
}
export interface PageMeta {
    title?: string;
    description?: string;
    viewport?: string;
    charset?: string;
}
export interface CollectedPage {
    url: string;
    localPath: string;
    html: string;
    css: CssBundle;
    images: Asset[];
    fonts: Asset[];
    js: Asset[];
    links: string[];
    metadata: PageMeta;
}
export interface CssBundle {
    all: string;
    inline: string;
    external: string[];
    critical: string;
    nonCritical: string;
}
export interface SiteMap {
    pages: CollectedPage[];
    entryUrl: string;
    collectedAt: Date;
    totalAssets: number;
}
export interface SpiderOptions {
    url: string;
    outputDir: string;
    maxPages?: number;
    followExternal?: boolean;
    proxy?: string;
    timeout?: number;
    userAgent?: string;
    headless?: boolean;
    progressFile?: string;
    asyncMode?: boolean;
    startProxyServer?: boolean;
    proxyPort?: number;
}
export interface SpiderProgress {
    status: 'running' | 'completed' | 'failed' | 'idle';
    url: string;
    outputDir: string;
    total: number;
    current: number;
    currentPage: string;
    collectedUrls: string[];
    errors: string[];
    startedAt: string;
    updatedAt: string;
    error?: string;
}
export interface SpiderState {
    visited: Set<string>;
    pending: string[];
    context: any;
}
//# sourceMappingURL=types.d.ts.map