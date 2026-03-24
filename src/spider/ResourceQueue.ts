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

export class ResourceQueue extends EventEmitter {
  private queue: Map<string, QueuedResource> = new Map();
  private concurrency: number;
  private maxRetries: number;
  private isProcessing: boolean = false;
  private outputDir: string;

  constructor(outputDir: string, concurrency: number = 3, maxRetries: number = 3) {
    super();
    this.outputDir = outputDir;
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
  }

  /**
   * 添加资源到队列
   */
  addResource(url: string, type: Asset['type'], customPath?: string): string {
    const localPath = customPath || this.urlToLocalPath(url, type);
    
    // 检查是否已在队列中
    if (this.queue.has(url)) {
      return localPath;
    }

    const resource: QueuedResource = {
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
  addResources(resources: Array<{ url: string; type: Asset['type']; localPath?: string }>): void {
    for (const res of resources) {
      this.addResource(res.url, res.type, res.localPath);
    }
  }

  /**
   * 开始后台处理队列
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.emit('start');
    
    this.processQueue();
  }

  /**
   * 停止处理队列
   */
  stopProcessing(): void {
    this.isProcessing = false;
    this.emit('stop');
  }

  /**
   * 获取队列统计
   */
  getStats(): QueueStats {
    const stats: QueueStats = { total: 0, pending: 0, downloading: 0, completed: 0, failed: 0 };
    
    for (const resource of this.queue.values()) {
      stats.total++;
      stats[resource.status]++;
    }

    return stats;
  }

  /**
   * 获取所有待下载的 URL（用于生成本地代理映射）
   */
  getPendingUrls(): Map<string, string> {
    const mapping = new Map<string, string>();
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
  isDownloaded(url: string): boolean {
    const resource = this.queue.get(url);
    return resource?.status === 'completed';
  }

  /**
   * 获取本地路径（同步）
   */
  getLocalPath(url: string): string | null {
    const resource = this.queue.get(url);
    return resource?.localPath || null;
  }

  private async processQueue(): Promise<void> {
    const batch = this.getNextBatch();
    
    if (batch.length === 0) {
      this.isProcessing = false;
      this.emit('idle', this.getStats());
      return;
    }

    // 标记为下载中
    for (const url of batch) {
      const resource = this.queue.get(url)!;
      resource.status = 'downloading';
    }

    this.emit('progress', this.getStats());

    // 并发下载
    await Promise.all(batch.map(url => this.downloadResource(url)));

    // 继续处理下一批
    setImmediate(() => this.processQueue());
  }

  private getNextBatch(): string[] {
    const batch: string[] = [];
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

  private async downloadResource(url: string): Promise<void> {
    const resource = this.queue.get(url)!;
    
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

    } catch (error: any) {
      resource.retryCount++;
      
      if (resource.retryCount < this.maxRetries) {
        resource.status = 'pending';
        // 指数退避重试
        setTimeout(() => {}, Math.pow(2, resource.retryCount) * 1000);
      } else {
        resource.status = 'failed';
        resource.error = error.message;
        this.emit('resource-failed', resource);
      }
    }
  }

  private urlToLocalPath(url: string, type: Asset['type']): string {
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
    } catch {
      return path.join('assets', subdir, `${this.hashString(url)}.bin`);
    }
  }

  private getSubdir(type: Asset['type']): string {
    switch (type) {
      case 'image': return 'images';
      case 'font': return 'fonts';
      case 'css': return 'css';
      case 'js': return 'js';
      default: return 'misc';
    }
  }

  private guessExt(url: string, type: Asset['type']): string {
    const extMap: Record<string, string> = {
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

  private hashString(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 12);
  }

  /**
   * 保存队列状态到文件（用于断点续传）
   */
  async saveState(stateFile: string): Promise<void> {
    const state = {
      queue: Array.from(this.queue.entries()),
      savedAt: new Date().toISOString(),
    };
    await fse.writeJson(stateFile, state, { spaces: 2 });
  }

  /**
   * 从文件恢复队列状态
   */
  async loadState(stateFile: string): Promise<boolean> {
    try {
      const state = await fse.readJson(stateFile);
      this.queue = new Map(state.queue);
      return true;
    } catch {
      return false;
    }
  }
}
