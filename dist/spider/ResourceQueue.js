/**
 * Pixel2Liquid - Resource Queue
 *
 * 后台资源下载队列 - 不阻塞主流程
 */
import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import fse from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
export class ResourceQueue extends EventEmitter {
    queue = new Map();
    concurrency;
    maxRetries;
    isProcessing = false;
    outputDir;
    constructor(outputDir, concurrency = 3, maxRetries = 3) {
        super();
        this.outputDir = outputDir;
        this.concurrency = concurrency;
        this.maxRetries = maxRetries;
    }
    /**
     * 添加资源到队列
     */
    addResource(url, type, customPath) {
        const localPath = customPath || this.urlToLocalPath(url, type);
        // 检查是否已在队列中
        if (this.queue.has(url)) {
            return localPath;
        }
        const resource = {
            url,
            localPath,
            type,
            status: 'pending',
            retryCount: 0,
        };
        this.queue.set(url, resource);
        return localPath;
    }
    /**
     * 批量添加资源
     */
    addResources(resources) {
        for (const res of resources) {
            this.addResource(res.url, res.type, res.localPath);
        }
    }
    /**
     * 开始后台处理队列
     */
    async startProcessing() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        this.emit('start');
        this.processQueue();
    }
    /**
     * 停止处理队列
     */
    stopProcessing() {
        this.isProcessing = false;
        this.emit('stop');
    }
    /**
     * 获取队列统计
     */
    getStats() {
        const stats = { total: 0, pending: 0, downloading: 0, completed: 0, failed: 0 };
        for (const resource of this.queue.values()) {
            stats.total++;
            stats[resource.status]++;
        }
        return stats;
    }
    /**
     * 获取所有待下载的 URL（用于生成本地代理映射）
     */
    getPendingUrls() {
        const mapping = new Map();
        for (const [url, resource] of this.queue.entries()) {
            if (resource.status === 'completed') {
                mapping.set(url, resource.localPath);
            }
        }
        return mapping;
    }
    /**
     * 检查资源是否已下载
     */
    isDownloaded(url) {
        const resource = this.queue.get(url);
        return resource?.status === 'completed';
    }
    /**
     * 获取本地路径（同步）
     */
    getLocalPath(url) {
        const resource = this.queue.get(url);
        return resource?.localPath || null;
    }
    async processQueue() {
        const batch = this.getNextBatch();
        if (batch.length === 0) {
            this.isProcessing = false;
            this.emit('idle', this.getStats());
            return;
        }
        // 标记为下载中
        for (const url of batch) {
            const resource = this.queue.get(url);
            resource.status = 'downloading';
        }
        this.emit('progress', this.getStats());
        // 并发下载
        await Promise.all(batch.map(url => this.downloadResource(url)));
        // 继续处理下一批
        setImmediate(() => this.processQueue());
    }
    getNextBatch() {
        const batch = [];
        const downloading = Array.from(this.queue.values()).filter(r => r.status === 'downloading').length;
        if (downloading >= this.concurrency) {
            return [];
        }
        const slotsAvailable = this.concurrency - downloading;
        for (const [url, resource] of this.queue.entries()) {
            if (resource.status === 'pending' && batch.length < slotsAvailable) {
                batch.push(url);
            }
        }
        return batch;
    }
    async downloadResource(url) {
        const resource = this.queue.get(url);
        try {
            // 检查文件是否已存在
            const fullPath = path.join(this.outputDir, resource.localPath);
            if (await fse.pathExists(fullPath)) {
                resource.status = 'completed';
                resource.size = (await fse.stat(fullPath)).size;
                this.emit('resource-completed', resource);
                return;
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                },
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const buffer = await response.arrayBuffer();
            // 确保目录存在
            await fse.ensureDir(path.dirname(fullPath));
            await fse.writeFile(fullPath, Buffer.from(buffer));
            resource.status = 'completed';
            resource.size = buffer.byteLength;
            this.emit('resource-completed', resource);
            this.emit('progress', this.getStats());
        }
        catch (error) {
            resource.retryCount++;
            if (resource.retryCount < this.maxRetries) {
                resource.status = 'pending';
                // 指数退避重试
                setTimeout(() => { }, Math.pow(2, resource.retryCount) * 1000);
            }
            else {
                resource.status = 'failed';
                resource.error = error.message;
                this.emit('resource-failed', resource);
            }
        }
    }
    urlToLocalPath(url, type) {
        // 处理缺少协议前缀的URL (//cdn.shopify.com/...)
        let fullUrl = url;
        if (url.startsWith('//')) {
            fullUrl = 'https:' + url;
        }
        const subdir = this.getSubdir(type);
        try {
            const parsed = new URL(fullUrl);
            const pathname = parsed.pathname;
            let filename = path.basename(pathname);
            if (!filename || !path.extname(filename)) {
                const ext = this.guessExt(url, type);
                filename = `${this.hashString(url)}${ext}`;
            }
            filename = filename.replace(/[?#].*$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
            return path.join('assets', subdir, filename);
        }
        catch {
            return path.join('assets', subdir, `${this.hashString(url)}.bin`);
        }
    }
    getSubdir(type) {
        switch (type) {
            case 'image': return 'images';
            case 'font': return 'fonts';
            case 'css': return 'css';
            case 'js': return 'js';
            default: return 'misc';
        }
    }
    guessExt(url, type) {
        const extMap = {
            image: '.jpg',
            font: '.woff2',
            css: '.css',
            js: '.js',
        };
        // 从URL中提取扩展名
        const match = url.match(/\.[a-zA-Z0-9]+(?=\?|#|$)/);
        if (match) {
            return match[0];
        }
        return extMap[type] || '.bin';
    }
    hashString(str) {
        return crypto.createHash('md5').update(str).digest('hex').substring(0, 12);
    }
    /**
     * 保存队列状态到文件（用于断点续传）
     */
    async saveState(stateFile) {
        const state = {
            queue: Array.from(this.queue.entries()),
            savedAt: new Date().toISOString(),
        };
        await fse.writeJson(stateFile, state, { spaces: 2 });
    }
    /**
     * 从文件恢复队列状态
     */
    async loadState(stateFile) {
        try {
            const state = await fse.readJson(stateFile);
            this.queue = new Map(state.queue);
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=ResourceQueue.js.map