/**
 * Pixel2Liquid - Local Proxy Server
 *
 * 本地预览服务器，代理资源请求
 * - 已下载的资源 → 直接返回本地文件
 * - 未下载的资源 → 按需下载后返回
 */
import type { ResourceQueue } from './ResourceQueue.js';
export interface ProxyServerOptions {
    port: number;
    outputDir: string;
    baseUrl: string;
    resourceQueue: ResourceQueue;
}
export declare class LocalProxyServer {
    private server;
    private options;
    private pendingRequests;
    constructor(options: ProxyServerOptions);
    /**
     * 启动代理服务器
     */
    start(): Promise<number>;
    /**
     * 停止代理服务器
     */
    stop(): Promise<void>;
    /**
     * 获取代理后的 URL（将原始 URL 转换为本地代理 URL）
     */
    getProxyUrl(originalUrl: string): string;
    private handleRequest;
    /**
     * 处理代理请求 - 转发到原始服务器
     */
    private handleProxyRequest;
    /**
     * 处理静态文件请求
     */
    private handleStaticRequest;
    /**
     * 从原始服务器获取资源
     */
    private fetchAndServe;
    /**
     * 服务本地文件
     */
    private serveLocalFile;
    /**
     * 根据文件路径获取 MIME 类型
     */
    private getMimeType;
}
//# sourceMappingURL=LocalProxyServer.d.ts.map