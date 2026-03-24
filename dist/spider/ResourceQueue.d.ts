/**
 * Pixel2Liquid - Resource Queue
 *
 * 后台资源下载队列 - 不阻塞主流程
 */
import { EventEmitter } from 'events';
import type { Asset } from './types.js';
export interface QueuedResource {
    url: string;
    localPath: string;
    type: Asset['type'];
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    size?: number;
    error?: string;
    retryCount: number;
}
export interface QueueStats {
    total: number;
    pending: number;
    downloading: number;
    completed: number;
    failed: number;
}
export declare class ResourceQueue extends EventEmitter {
    private queue;
    private concurrency;
    private maxRetries;
    private isProcessing;
    private outputDir;
    constructor(outputDir: string, concurrency?: number, maxRetries?: number);
    /**
     * 添加资源到队列
     */
    addResource(url: string, type: Asset['type'], customPath?: string): string;
    /**
     * 批量添加资源
     */
    addResources(resources: Array<{
        url: string;
        type: Asset['type'];
        localPath?: string;
    }>): void;
    /**
     * 开始后台处理队列
     */
    startProcessing(): Promise<void>;
    /**
     * 停止处理队列
     */
    stopProcessing(): void;
    /**
     * 获取队列统计
     */
    getStats(): QueueStats;
    /**
     * 获取所有待下载的 URL（用于生成本地代理映射）
     */
    getPendingUrls(): Map<string, string>;
    /**
     * 检查资源是否已下载
     */
    isDownloaded(url: string): boolean;
    /**
     * 获取本地路径（同步）
     */
    getLocalPath(url: string): string | null;
    private processQueue;
    private getNextBatch;
    private downloadResource;
    private urlToLocalPath;
    private getSubdir;
    private guessExt;
    private hashString;
    /**
     * 保存队列状态到文件（用于断点续传）
     */
    saveState(stateFile: string): Promise<void>;
    /**
     * 从文件恢复队列状态
     */
    loadState(stateFile: string): Promise<boolean>;
}
//# sourceMappingURL=ResourceQueue.d.ts.map