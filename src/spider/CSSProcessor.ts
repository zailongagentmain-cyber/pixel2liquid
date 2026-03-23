/**
 * Pixel2Liquid - CSSProcessor
 * 
 * CSS处理：提取、合并、去重、优化
 */

import * as cheerio from 'cheerio';
import { parse, walk } from 'css-tree';

import type { CssBundle } from './types.js';

export class CSSProcessor {
  private html: string;

  constructor(html: string) {
    this.html = html;
  }

  /**
   * 捆绑CSS：提取内联CSS和外部CSS（已下载）
   */
  async bundle(): Promise<CssBundle> {
    const $ = cheerio.load(this.html);
    const allCss: string[] = [];

    // 1. 收集内联样式
    const inlineStyles = $('style').map((_: any, el: any) => $(el).html() || '').get();
    allCss.push(...inlineStyles);

    // 2. 合并所有CSS
    const mergedCss = this.mergeCss(allCss);

    // 3. 提取关键CSS（首屏渲染所需）
    const critical = this.extractCriticalCss(mergedCss);

    // 4. 分离非关键CSS
    const nonCritical = this.extractNonCritical(mergedCss, critical);

    return {
      all: mergedCss,
      inline: inlineStyles.join('\n'),
      external: [],
      critical,
      nonCritical,
    };
  }

  /**
   * 合并多个CSS字符串
   */
  private mergeCss(styles: string[]): string {
    const rules: string[] = [];
    const seenRules = new Set<string>();
    
    for (const style of styles) {
      if (!style.trim()) continue;
      
      try {
        // 使用css-tree解析
        const ast = parse(style, { parseValue: true });
        
        // 遍历并收集规则
        walk(ast, (node: any) => {
          if (node.type === 'Rule') {
            // 简单规则字符串化
            const ruleStr = this.stringifyRule(node);
            if (ruleStr && !seenRules.has(ruleStr)) {
              rules.push(ruleStr);
              seenRules.add(ruleStr);
            }
          }
        });
      } catch (error) {
        // 如果解析失败，直接添加原始内容
        rules.push(style);
      }
    }

    return rules.join('\n\n');
  }

  /**
   * 简单规则字符串化
   */
  private stringifyRule(node: any): string {
    try {
      const prelude = this.stringifyPrelude(node.prelude);
      const block = this.stringifyBlock(node.block);
      return `${prelude} ${block}`;
    } catch {
      return '';
    }
  }

  /**
   * 字符串化选择器
   */
  private stringifyPrelude(prelude: any): string {
    if (!prelude) return '';
    if (typeof prelude === 'string') return prelude;
    if (Array.isArray(prelude)) {
      return prelude.map((p: any) => this.stringifyPrelude(p)).join(', ');
    }
    return '';
  }

  /**
   * 字符串化CSS块
   */
  private stringifyBlock(block: any): string {
    if (!block || !block.children) return '{}';
    const declarations: string[] = [];
    for (const child of block.children) {
      if (child.type === 'Declaration') {
        const prop = child.property;
        const value = this.stringifyValue(child.value);
        declarations.push(`${prop}: ${value}`);
      }
    }
    return `{ ${declarations.join('; ')} }`;
  }

  /**
   * 字符串化值
   */
  private stringifyValue(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      return value.map((v: any) => this.stringifyValue(v)).join(' ');
    }
    return '';
  }

  /**
   * 提取关键CSS（首屏渲染所需）
   */
  private extractCriticalCss(css: string): string {
    const criticalSelectors = new Set([
      ':root', 'html', 'body',
      'header', 'main', 'footer', 'nav',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'a', 'button', 'input', 'form',
      'img', 'video', 'section', 'article',
      'div', 'span', 'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'td',
    ]);

    const criticalRules: string[] = [];
    const processedSelectors = new Set<string>();

    try {
      const ast = parse(css, { parseValue: true });
      
      walk(ast, (node: any) => {
        if (node.type === 'Rule') {
          const selectorStr = this.stringifyPrelude(node.prelude);
          
          // 检查选择器是否包含关键选择器
          const isCritical = this.isSelectorCritical(selectorStr, criticalSelectors);
          
          if (isCritical && !processedSelectors.has(selectorStr)) {
            const ruleStr = this.stringifyRule(node);
            if (ruleStr) {
              criticalRules.push(ruleStr);
              processedSelectors.add(selectorStr);
            }
          }
        }
      });
    } catch (error) {
      // 解析失败时返回原始CSS
      return css;
    }

    return criticalRules.length > 0 ? criticalRules.join('\n\n') : css;
  }

  /**
   * 判断选择器是否为关键的
   */
  private isSelectorCritical(
    selectorStr: string, 
    criticalSelectors: Set<string>
  ): boolean {
    // 检查是否包含任何关键选择器
    for (const critical of criticalSelectors) {
      if (selectorStr.includes(critical)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 提取非关键CSS
   */
  private extractNonCritical(allCss: string, criticalCss: string): string {
    if (criticalCss === allCss) {
      return '';
    }
    return allCss.replace(criticalCss, '').trim();
  }

  /**
   * 提取CSS变量
   */
  extractCssVariables(css: string): Record<string, string> {
    const variables: Record<string, string> = {};

    try {
      const ast = parse(css, { parseValue: true });
      
      walk(ast, (node: any) => {
        if (node.type === 'Declaration') {
          const prop = node.property;
          if (prop && prop.startsWith('--')) {
            variables[prop] = this.stringifyValue(node.value);
          }
        }
      });
    } catch (error) {
      // 忽略解析错误
    }

    return variables;
  }

  /**
   * 最小化CSS（移除注释和空白）
   */
  minify(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // 移除注释
      .replace(/\s+/g, ' ')              // 合并空白
      .replace(/\s*([{}:;,])\s*/g, '$1') // 移除多余空白
      .replace(/;}/g, '}')              // 移除尾部分号
      .trim();
  }
}
