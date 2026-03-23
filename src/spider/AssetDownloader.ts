/**
 * Pixel2Liquid - AssetDownloader
 * 
 * 资源下载器：并发下载图片/CSS/JS/字体资源
 */

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import fse from 'fs-extra';
import * as path from 'path';
import { pipeline } from 'stream/promises';

import type { CollectedPage, Asset } from './types.js';

export class AssetDownloader {
  private assets: Asset[] = [];
  private concurrency = 5; // 并发数限制
  private page: CollectedPage;
  private outputDir: string;

  constructor(page: CollectedPage, outputDir: string) {
    this.page = page;
    this.outputDir = outputDir;
  }

  /**
   * 下载页面所有资源
   */
  async downloadAll(): Promise<Asset[]> {
    const urls = this.collectAssetUrls();
    
    console.log(`    📦 发现 ${urls.length} 个资源`);

    // 分批并发下载
    const chunks = this.chunkArray(urls, this.concurrency);
    let downloaded = 0;

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(url => this.downloadAsset(url))
      );
      
      downloaded += results.filter(Boolean).length;
      console.log(`    ⬇️  下载进度: ${downloaded}/${urls.length}`);
    }

    return this.assets;
  }

  /**
   * 收集页面所有资源URL
   */
  private collectAssetUrls(): string[] {
    const $ = cheerio.load(this.page.html);
    const urlSet = new Set<string>();

    // 图片
    $('img[src]').each((_: any, el: any) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('data:')) {
        urlSet.add(src);
      }
    });

    // 图片 (srcset)
    $('img[srcset]').each((_: any, el: any) => {
      const srcset = $(el).attr('srcset') || '';
      const re = /https?:\/\/[^\s,]+/g;
      const matches = srcset.match(re);
      if (matches) {
        for (const src of matches) {
          urlSet.add(src);
        }
      }
    });

    // CSS
    $('link[rel="stylesheet"][href]').each((_: any, el: any) => {
      const href = $(el).attr('href');
      if (href) {
        urlSet.add(href);
      }
    });

    // JS
    $('script[src]').each((_: any, el: any) => {
      const src = $(el).attr('src');
      if (src) {
        urlSet.add(src);
      }
    });

    // 字体 (从CSS中提取)
    const fontUrls = this.extractFontUrls($);
    for (const url of fontUrls) {
      urlSet.add(url);
    }

    return Array.from(urlSet);
  }

  /**
   * 从CSS中提取字体URL
   */
  private extractFontUrls($: cheerio.CheerioAPI): string[] {
    const urls: string[] = [];
    const fontRe = /url\(['"]?(https?:\/\/[^'")]+)['"]?\)/g;

    // 查找所有包含 @font-face 的 style 标签
    $('style').each((_: any, el: any) => {
      const css = $(el).html() || '';
      let match;
      while ((match = fontRe.exec(css)) !== null) {
        urls.push(match[1]);
      }
    });

    // 查找外部样式表中的字体
    $('link[rel="stylesheet"][href]').each((_: any, el: any) => {
      const href = $(el).attr('href');
      if (href) {
        const fontMatchRe = /font|typography|css\/ui/;
        if (fontMatchRe.test(href)) {
          urls.push(href);
        }
      }
    });

    return urls;
  }

  /**
   * 下载单个资源
   */
  private async downloadAsset(url: string): Promise<Asset | null> {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || '';
      const filename = this.urlToFilename(url, contentType);
      const assetType = this.getAssetType(url, contentType);

      // 根据类型决定保存目录
      const subdir = this.getAssetSubdir(assetType);
      const localPath = path.join('assets', subdir, filename);

      // 保存文件
      const fullPath = path.join(this.outputDir, localPath);
      await fse.ensureDir(path.dirname(fullPath));
      await fse.writeFile(fullPath, Buffer.from(buffer));

      const asset: Asset = {
        url,
        localPath,
        type: assetType,
        size: buffer.byteLength,
        mimeType: contentType,
      };

      this.assets.push(asset);
      return asset;

    } catch (error: any) {
      console.warn(`    ⚠️  下载失败: ${url} - ${error.message}`);
      return null;
    }
  }

  /**
   * URL转文件名
   */
  private urlToFilename(url: string, contentType: string): string {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      
      // 从路径提取文件名
      let filename = path.basename(pathname);
      
      // 如果没有文件名或扩展名，生成一个
      if (!filename || !path.extname(filename)) {
        const ext = this.contentTypeToExt(contentType);
        filename = `asset-${this.hashString(url)}${ext}`;
      }

      // 清理特殊字符
      filename = filename.replace(/[?#].*$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      
      return filename;
    } catch {
      return `asset-${this.hashString(url)}.bin`;
    }
  }

  /**
   * 字符串转哈希（用于生成唯一文件名）
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取资源子目录
   */
  private getAssetSubdir(type: Asset['type']): string {
    switch (type) {
      case 'image': return 'images';
      case 'font': return 'fonts';
      case 'css': return 'css';
      case 'js': return 'js';
      default: return 'misc';
    }
  }

  /**
   * 根据URL和Content-Type判断资源类型
   */
  private getAssetType(url: string, contentType: string): Asset['type'] {
    // 根据Content-Type判断
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.includes('font')) return 'font';
    if (contentType.includes('css')) return 'css';
    if (contentType.includes('javascript')) return 'js';

    // 根据URL判断
    if (/\.(jpg|jpeg|png|gif|svg|webp|avif|ico)$/i.test(url)) return 'image';
    if (/\.(woff|woff2|ttf|otf|eot)$/i.test(url)) return 'font';
    if (/\.css(\?.*)?$/i.test(url)) return 'css';
    if (/\.js(\?.*)?$/i.test(url)) return 'js';

    return 'image';
  }

  /**
   * Content-Type转文件扩展名
   */
  private contentTypeToExt(contentType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/svg+xml': '.svg',
      'image/webp': '.webp',
      'font/woff': '.woff',
      'font/woff2': '.woff2',
      'font/ttf': '.ttf',
      'font/otf': '.otf',
      'text/css': '.css',
      'application/javascript': '.js',
      'text/javascript': '.js',
    };

    return map[contentType] || '.bin';
  }

  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
