/**
 * CollectionBlock.ts - Collection 页 Block
 * 
 * 识别：产品网格、分页、筛选栏、collection 标题
 */

import * as cheerio from 'cheerio';
import type { Block, BlockData, BlockSchema } from './Block.js';

export class CollectionBlock implements Block {
  name = 'Collection Block';
  
  /**
   * 判断元素是否属于 Collection 页内容
   */
  canHandle(element: any, cssAst?: any): boolean {
    const $ = element;
    const className = ($.attr('class') || '').toLowerCase();
    const id = ($.attr('id') || '').toLowerCase();
    const combined = className + ' ' + id;
    
    const collectionIndicators = [
      'collection', 'product-grid', 'product-item', 'product-card',
      'grid', 'list', 'filter', 'sort', 'toolbar', 'pagination',
      'paginator', 'page-num', 'results',
    ];
    
    return collectionIndicators.some(ind => combined.includes(ind));
  }
  
  /**
   * 从 Collection 页元素中提取数据
   */
  extract(element: any, cssAst?: any): BlockData {
    const $ = element;
    const className = $.attr('class') || '';
    const data: Record<string, any> = {};
    
    if (this.isProductGrid($, className)) {
      data.type = 'product-grid';
      data.children = this.extractProductItems($, cssAst);
      data.count = data.children.length;
    } else if (this.isFilterBar($, className)) {
      data.type = 'filter-bar';
      data.filters = this.extractFilters($);
    } else if (this.isSortDropdown($, className)) {
      data.type = 'sort-dropdown';
      data.options = this.extractSortOptions($);
    } else if (this.isPagination($, className)) {
      data.type = 'pagination';
      data.pages = this.extractPages($);
    } else if (this.isCollectionHeader($, className)) {
      data.type = 'collection-header';
      data.title = $('h1, h2').first().text().trim();
      data.description = $('p').first().text().trim();
    } else if (this.isToolbar($, className)) {
      data.type = 'toolbar';
    }
    
    // CSS Grid/Flex 布局信息
    const cssMeta: Record<string, string> = {};
    if (cssAst?.layoutInfo) {
      const { gridSelectors, flexSelectors, productGridSelectors } = cssAst.layoutInfo;
      
      if (productGridSelectors.some((s: string) => className.includes(s.replace('.', '')))) {
        cssMeta.display = 'grid';
      } else if (gridSelectors.some((s: string) => className.includes(s.replace('.', '')))) {
        cssMeta.display = 'grid';
      } else if (flexSelectors.some((s: string) => className.includes(s.replace('.', '')))) {
        cssMeta.display = 'flex';
      }
    }
    
    // 响应式断点
    if (cssAst?.mediaQueries?.length) {
      for (const mq of cssAst.mediaQueries) {
        if (mq.expression.includes('min-width')) {
          cssMeta.mediaQuery = mq.expression;
          break;
        }
      }
    }
    
    return {
      name: this.name,
      type: data.type || 'unknown',
      selector: this.getSelector($),
      data,
      cssMeta,
    };
  }
  
  /**
   * 生成 Collection Liquid 模板
   */
  generateLiquid(data: BlockData): string {
    const { type, data: blockData } = data;
    
    switch (type) {
      case 'product-grid':
        return `{% for product in collection.products %}{% render 'product-card', product: product %}{% endfor %}`;
        
      case 'product-card':
        return `{% render 'product-card', product: product %}`;
        
      case 'filter-bar':
        return `{% render 'collection-filters', collection: collection %}`;
        
      case 'sort-dropdown':
        return `{% render 'collection-sort', collection: collection %}`;
        
      case 'pagination':
        return `{% render 'pagination', paginate: paginate %}`;
        
      case 'collection-header':
        return `{{ collection.title }}\n{{ collection.description }}`;
        
      case 'toolbar':
        return `{% render 'collection-toolbar', collection: collection %}`;
        
      default:
        return `{{ collection.${type} }}`;
    }
  }
  
  /**
   * 生成 Collection Block Schema
   */
  generateSchema(data?: BlockData): BlockSchema {
    return {
      type: 'collection-block',
      name: 'Collection Block',
      settings: [
        { type: 'text', id: 'title', label: 'Title' },
        { type: 'checkbox', id: 'show_description', label: 'Show Description', default: true },
        { type: 'select', id: 'products_per_row', label: 'Products Per Row', options: ['2', '3', '4', '5'] },
        { type: 'checkbox', id: 'show_filters', label: 'Show Filters', default: true },
        { type: 'checkbox', id: 'show_sort', label: 'Show Sort', default: true },
        { type: 'checkbox', id: 'show_pagination', label: 'Show Pagination', default: true },
        { type: 'select', id: 'grid_gap', label: 'Grid Gap', options: ['small', 'medium', 'large'] },
      ],
    };
  }
  
  private isProductGrid($: any, className: string): boolean {
    return className.includes('product-grid') || className.includes('product-item') ||
      className.includes('product-card') || className.includes('items-grid') ||
      className.includes('collection-grid');
  }
  
  private isFilterBar($: any, className: string): boolean {
    return className.includes('filter') || className.includes('facet') ||
      className.includes('refine') || className.includes('swatch');
  }
  
  private isSortDropdown($: any, className: string): boolean {
    return className.includes('sort') || className.includes('order') ||
      className.includes('dropdown') || $('select').length > 0;
  }
  
  private isPagination($: any, className: string): boolean {
    return className.includes('pagination') || className.includes('paginator') ||
      className.includes('page-num') || $('nav').length > 0;
  }
  
  private isCollectionHeader($: any, className: string): boolean {
    return className.includes('header') || className.includes('title') ||
      className.includes('banner') || className.includes('hero');
  }
  
  private isToolbar($: any, className: string): boolean {
    return className.includes('toolbar') || className.includes('bar') ||
      (className.includes('top') && className.includes('collection'));
  }
  
  private extractProductItems($: any, cssAst?: any): any[] {
    const items: any[] = [];
    $('[class*="product"], [class*="item"], [class*="card"]').each((_: any, el: any) => {
      const $el = $(el);
      const handle = $el.find('a[href*="/products/"]').attr('href')?.split('/').pop() || '';
      const title = $el.find('[class*="title"], [class*="name"], h2, h3').first().text().trim();
      const price = $el.find('[class*="price"]').first().text().trim();
      const image = $el.find('img').first().attr('src') || '';
      
      items.push({ handle, title, price, image });
    });
    return items;
  }
  
  private extractFilters($: any): string[] {
    const filters: string[] = [];
    $('[class*="filter"], [class*="facet"]').each((_: any, el: any) => {
      const label = $(el).find('label, .label, span').first().text().trim();
      if (label) filters.push(label);
    });
    return filters;
  }
  
  private extractSortOptions($: any): string[] {
    const options: string[] = [];
    $('select option').each((_: any, el: any) => {
      const text = $(el).text().trim();
      if (text) options.push(text);
    });
    return options;
  }
  
  private extractPages($: any): number[] {
    const pages: number[] = [];
    $('a[href*="page="]').each((_: any, el: any) => {
      const match = $(el).attr('href')?.match(/page=(\d+)/);
      if (match) pages.push(parseInt(match[1]));
    });
    return [...new Set(pages)].sort((a, b) => a - b);
  }
  
  private getSelector($: any): string {
    const tag = $.get(0)?.tagName?.toLowerCase() || '';
    const className = $.attr('class');
    if (className) {
      const cleanClass = className.trim().split(/\s+/).slice(0, 2).join('.');
      return `${tag}.${cleanClass}`;
    }
    const id = $.attr('id');
    if (id) return `${tag}#${id}`;
    return tag;
  }
}
