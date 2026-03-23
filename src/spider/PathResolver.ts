/**
 * Pixel2Liquid - PathResolver
 * 
 * 路径修复：将相对路径转为本地绝对路径
 */

import * as cheerio from 'cheerio';
import * as path from 'path';

import type { CollectedPage } from './types.js';

export class PathResolver {
  private page: CollectedPage;
  private outputDir: string;
  private resolvedHtml: string;

  constructor(page: CollectedPage, outputDir: string) {
    this.page = page;
    this.outputDir = outputDir;
    this.resolvedHtml = page.html;
  }

  /**
   * 执行所有路径修复
   */
  resolve(): void {
    const $ = cheerio.load(this.resolvedHtml);

    // 1. 修复图片路径
    this.resolveImages($);

    // 2. 修复CSS路径
    this.resolveStylesheets($);

    // 3. 修复JS路径
    this.resolveScripts($);

    // 4. 修复href链接（站内链接转为相对路径）
    this.resolveLinks($);

    // 5. 修复srcset
    this.resolveSrcset($);

    this.resolvedHtml = $.html();
  }

  /**
   * 修复图片路径
   */
  private resolveImages($: cheerio.CheerioAPI): void {
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;

      const resolved = this.resolveAssetPath(src);
      $(el).attr('src', resolved);

      // 同时处理 srcset
      const srcset = $(el).attr('srcset');
      if (srcset) {
        $(el).attr('srcset', this.resolveSrcsetString(srcset));
      }
    });

    // 处理 picture 标签
    $('picture source[srcset]').each((_, el) => {
      const srcset = $(el).attr('srcset');
      if (srcset) {
        $(el).attr('srcset', this.resolveSrcsetString(srcset));
      }
    });
  }

  /**
   * 修复CSS路径
   */
  private resolveStylesheets($: cheerio.CheerioAPI): void {
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // 外部CSS保持绝对路径（需要网络）
      if (href.startsWith('http') || href.startsWith('//')) {
        return;
      }

      const resolved = this.resolveAssetPath(href);
      $(el).attr('href', resolved);
    });

    // 处理 <style> 标签内的路径（如果有的话）
    $('style').each((_, el) => {
      let css = $(el).html() || '';
      css = this.resolveCssUrls(css);
      $(el).html(css);
    });
  }

  /**
   * 修复JS路径
   */
  private resolveScripts($: cheerio.CheerioAPI): void {
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;

      // 外部JS保持绝对路径
      if (src.startsWith('http') || src.startsWith('//')) {
        return;
      }

      const resolved = this.resolveAssetPath(src);
      $(el).attr('src', resolved);
    });
  }

  /**
   * 修复链接
   */
  private resolveLinks($: cheerio.CheerioAPI): void {
    const baseUrl = this.page.url;

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // 跳过锚点、协议外部链接
      if (href.startsWith('#') || href.startsWith('mailto:') || 
          href.startsWith('tel:') || href.startsWith('javascript:')) {
        return;
      }

      // 站内链接转为相对路径
      if (this.isInternalLink(href, baseUrl)) {
        const resolved = this.resolvePagePath(href, baseUrl);
        $(el).attr('href', resolved);
      }
    });
  }

  /**
   * 修复srcset属性
   */
  private resolveSrcset($: cheerio.CheerioAPI): void {
    $('[srcset]').each((_, el) => {
      const srcset = $(el).attr('srcset');
      if (srcset) {
        $(el).attr('srcset', this.resolveSrcsetString(srcset));
      }
    });
  }

  /**
   * 解析srcset字符串
   */
  private resolveSrcsetString(srcset: string): string {
    return srcset.split(',').map(part => {
      const trimmed = part.trim();
      const spaceIndex = trimmed.lastIndexOf(' ');
      
      if (spaceIndex === -1) {
        return this.resolveAssetPath(trimmed);
      }
      
      const url = trimmed.slice(0, spaceIndex);
      const descriptor = trimmed.slice(spaceIndex);
      return this.resolveAssetPath(url) + descriptor;
    }).join(', ');
  }

  /**
   * 解析资源路径
   */
  private resolveAssetPath(src: string): string {
    // 已经是绝对路径或外部链接
    if (src.startsWith('http') || src.startsWith('//') || src.startsWith('data:')) {
      return src;
    }

    // 相对路径
    if (src.startsWith('/')) {
      // 以assets开头的路径，保持原样
      if (src.startsWith('/assets/')) {
        return src;
      }
      // 转为相对于输出根目录的路径
      return `/assets${src}`;
    }

    // 相对路径
    return `/assets/${src}`;
  }

  /**
   * 解析页面链接路径
   */
  private resolvePagePath(href: string, baseUrl: string): string {
    try {
      const base = new URL(baseUrl);
      const target = new URL(href, base);
      
      // 计算相对路径
      const basePath = base.pathname.replace(/\/[^/]*$/, '/');
      const targetPath = target.pathname.replace(/\/[^/]*$/, '/');
      
      if (base.pathname === target.pathname) {
        // 同一页面
        return href;
      }

      // 计算相对路径
      const relPath = path.relative(basePath, targetPath);
      
      // 确保指向.html文件
      if (!relPath.endsWith('.html') && !relPath.endsWith('/')) {
        return relPath + '.html';
      }
      
      return relPath;
    } catch {
      return href;
    }
  }

  /**
   * 修复CSS内的URL
   */
  private resolveCssUrls(css: string): string {
    // 匹配 url(...) 模式
    const urlRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
    
    return css.replace(urlRegex, (match, url) => {
      // 跳过data URI和外部URL
      if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:')) {
        return match;
      }
      
      const resolved = this.resolveAssetPath(url);
      return `url("${resolved}")`;
    });
  }

  /**
   * 判断是否为内部链接
   */
  private isInternalLink(href: string, baseUrl: string): boolean {
    try {
      const base = new URL(baseUrl);
      const target = new URL(href, base);
      return target.hostname === base.hostname;
    } catch {
      // 相对路径默认是内部的
      return !href.startsWith('http');
    }
  }

  /**
   * 获取修复后的HTML
   */
  getResolvedHtml(): string {
    return this.resolvedHtml;
  }
}
