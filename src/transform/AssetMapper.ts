/**
 * AssetMapper - 资源映射
 * 
 * 解析 HTML 中的 Shopify CDN URL，生成 Liquid asset_url filter 引用
 */

import * as cheerio from 'cheerio';
import { AssetMapping } from './types.js';
import { ShopifyClient } from './ShopifyClient.js';

export class AssetMapper {
  /**
   * 从 HTML 中提取所有 Shopify CDN URL
   */
  extractCdnUrls(html: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];
    const seen = new Set<string>();

    // 从 img src 提取
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && this.isShopifyCdn(src) && !seen.has(src)) {
        seen.add(src);
        urls.push(src);
      }
    });

    // 从 link[href] 提取（CSS）
    $('link[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && this.isShopifyCdn(href) && !seen.has(href)) {
        seen.add(href);
        urls.push(href);
      }
    });

    // 从 script[src] 提取
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && this.isShopifyCdn(src) && !seen.has(src)) {
        seen.add(src);
        urls.push(src);
      }
    });

    // 从 style 内联样式中提取（background-image 等）
    $('[style]').each((_, el) => {
      const style = $(el).attr('style') || '';
      const matches = style.match(/url\(['"]?([^'")]+)['"]?\)/g) || [];
      matches.forEach(match => {
        const url = match.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
        if (this.isShopifyCdn(url) && !seen.has(url)) {
          seen.add(url);
          urls.push(url);
        }
      });
    });

    return urls;
  }

  /**
   * 判断是否是 Shopify CDN URL
   */
  isShopifyCdn(url: string): boolean {
    return url.includes('cdn.shopify.com');
  }

  /**
   * 解析 Shopify CDN URL，提取文件信息
   * 
   * 格式: https://cdn.shopify.com/s/files/1/0913/4689/5219/files/base.css?v=123
   */
  parseCdnUrl(cdnUrl: string): { filename: string; path: string; assetType: AssetMapping['assetType'] } {
    try {
      const url = new URL(cdnUrl);
      const pathname = url.pathname;

      // 路径格式: /s/files/{shop_id}/{path}/{filename}
      const parts = pathname.split('/').filter(Boolean);
      
      // 找到 "files" 之后的部分就是文件路径
      const filesIndex = parts.indexOf('files');
      const fileParts = parts.slice(filesIndex + 1);
      
      // fileParts[0] = shop_id, fileParts[1] = ...剩余路径, fileParts[n-1] = filename
      // 但实际上格式是 /files/{shop_id}/{path}/{filename}
      // 所以 filesIndex + 1 = shop_id, filesIndex + 2 开始是目录, 最后一个是文件名
      
      let filename = fileParts[fileParts.length - 1];
      const directory = fileParts.slice(1, -1).join('/'); // 除了 shop_id 和 filename 之外的目录
      const path = directory ? `${directory}/${filename}` : filename;

      // 去掉 query string
      filename = filename.split('?')[0];

      // 判断资源类型
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      const assetType = this.getAssetType(ext, directory);

      return { filename, path, assetType };
    } catch {
      return {
        filename: 'unknown',
        path: 'unknown',
        assetType: 'other',
      };
    }
  }

  /**
   * 根据扩展名和目录判断资源类型
   */
  private getAssetType(ext: string, directory: string): AssetMapping['assetType'] {
    if (['css', 'scss', 'sass', 'less'].includes(ext)) return 'css';
    if (['js', 'mjs'].includes(ext)) return 'js';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif', 'ico'].includes(ext)) return 'image';
    if (['woff', 'woff2', 'ttf', 'eot', 'otf'].includes(ext)) return 'font';
    return 'other';
  }

  /**
   * 生成 Liquid asset filter 引用
   */
  generateLiquidReference(filename: string, assetType: AssetMapping['assetType']): string {
    // 去掉 query string
    const cleanFilename = filename.split('?')[0];

    switch (assetType) {
      case 'image':
        // 图片用 image_url filter，支持动态尺寸
        return `{{ '${cleanFilename}' | image_url: '1024x1024' }}`;
      
      case 'css':
      case 'js':
      case 'font':
        // CSS/JS/Font 用 asset_url filter
        return `{{ '${cleanFilename}' | asset_url }}`;
      
      default:
        return `{{ '${cleanFilename}' | asset_url }}`;
    }
  }

  /**
   * 检查目标店铺是否有同名资源
   */
  async checkAssetExists(filename: string, themeAssets: string[]): Promise<boolean> {
    // 去掉 query string
    const cleanFilename = filename.split('?')[0];
    return themeAssets.includes(cleanFilename);
  }

  /**
   * 构建资源映射表
   */
  async buildAssetMappings(
    html: string,
    themeAssets: string[]
  ): Promise<AssetMapping[]> {
    const cdnUrls = this.extractCdnUrls(html);
    const mappings: AssetMapping[] = [];

    for (const cdnUrl of cdnUrls) {
      const { filename, assetType } = this.parseCdnUrl(cdnUrl);
      const exists = await this.checkAssetExists(filename, themeAssets);
      const liquidReference = this.generateLiquidReference(filename, assetType);

      mappings.push({
        cdnUrl,
        filename,
        assetType,
        targetAssetUrl: exists ? liquidReference : null,
        liquidReference,
      });
    }

    return mappings;
  }
}
