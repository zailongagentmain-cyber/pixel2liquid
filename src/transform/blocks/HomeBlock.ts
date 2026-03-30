/**
 * HomeBlock.ts - 首页 Block
 * 
 * 识别：hero banner、featured products、logo list
 */

import * as cheerio from 'cheerio';
import type { Block, BlockData, BlockSchema } from './Block.js';

export class HomeBlock implements Block {
  name = 'Home Block';
  
  /**
   * 判断元素是否属于首页内容
   */
  canHandle(element: any, cssAst?: any): boolean {
    const $ = element;
    const className = ($.attr('class') || '').toLowerCase();
    const id = ($.attr('id') || '').toLowerCase();
    const combined = className + ' ' + id;
    
    const homeIndicators = [
      'hero', 'banner', 'slideshow', 'slider', 'featured',
      'section', 'homepage', 'logo', 'brand', 'partner',
      'testimonial', 'review', 'about', 'contact',
      'gallery', 'image', 'promo', 'announcement',
    ];
    
    return homeIndicators.some(ind => combined.includes(ind));
  }
  
  /**
   * 从首页元素中提取数据
   */
  extract(element: any, cssAst?: any): BlockData {
    const $ = element;
    const className = $.attr('class') || '';
    const tag = $.get(0)?.tagName?.toLowerCase();
    const data: Record<string, any> = {};
    
    if (this.isHeroBanner($, className, tag)) {
      data.type = 'hero';
      data.title = $('h1, h2').first().text().trim();
      data.subtitle = $('p').first().text().trim();
      data.ctaText = $.find('a[class*="button"], button').first().text().trim();
      data.ctaLink = $.find('a[class*="button"]').first().attr('href') || '';
      data.backgroundImage = $.css('background-image')?.replace(/url\(['"]?(.+?)['"]?\)/, '$1') || '';
    } else if (this.isFeaturedProducts($, className)) {
      data.type = 'featured-products';
      data.title = $('h2, h3').first().text().trim();
      data.productHandles = this.extractProductHandles($);
      data.productCount = data.productHandles.length;
    } else if (this.isLogoList($, className)) {
      data.type = 'logo-list';
      data.logos = this.extractLogos($);
    } else if (this.isTestimonial($, className)) {
      data.type = 'testimonial';
      data.quotes = this.extractTestimonials($);
    } else if (this.isImageGallery($, className, tag)) {
      data.type = 'gallery';
      data.images = this.extractGalleryImages($);
    } else if (this.isAnnouncementBar($, className)) {
      data.type = 'announcement-bar';
      data.text = $.text().trim();
      data.link = $('a').first().attr('href') || '';
    } else if (this.isPromoBanner($, className)) {
      data.type = 'promo-banner';
      data.title = $('h2, h3').first().text().trim();
      data.description = $('p').first().text().trim();
      data.ctaText = $('a').first().text().trim();
    } else if (tag === 'section') {
      data.type = 'section';
      data.sectionId = $.attr('id') || className.split(' ')[0] || 'section';
    }
    
    // CSS 布局信息
    const cssMeta: Record<string, string> = {};
    if (cssAst?.layoutInfo) {
      const { gridSelectors, flexSelectors } = cssAst.layoutInfo;
      if (gridSelectors.some((s: string) => className.includes(s.replace('.', '')))) {
        cssMeta.display = 'grid';
      } else if (flexSelectors.some((s: string) => className.includes(s.replace('.', '')))) {
        cssMeta.display = 'flex';
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
   * 生成 Home Liquid 模板
   */
  generateLiquid(data: BlockData): string {
    const { type, data: blockData } = data;
    
    switch (type) {
      case 'hero':
        return `{% section 'homepage-hero' %}`;
        
      case 'featured-products':
        return `{% section 'featured-products' %}`;
        
      case 'logo-list':
        return `{% section 'logo-list' %}`;
        
      case 'testimonial':
        return `{% section 'testimonials' %}`;
        
      case 'gallery':
        return `{% section 'gallery' %}`;
        
      case 'announcement-bar':
        return `{% section 'announcement-bar' %}`;
        
      case 'promo-banner':
        return `{% section 'promo-banner' %}`;
        
      case 'section':
        return `{% section '${blockData.sectionId}' %}`;
        
      default:
        return `{% comment %} Home block: ${type} {% endcomment %}`;
    }
  }
  
  /**
   * 生成 Home Block Schema
   */
  generateSchema(data?: BlockData): BlockSchema {
    return {
      type: 'home-block',
      name: 'Home Block',
      settings: [
        { type: 'text', id: 'section_id', label: 'Section ID' },
        { type: 'checkbox', id: 'full_width', label: 'Full Width', default: false },
        { type: 'select', id: 'padding', label: 'Section Padding', options: ['none', 'small', 'medium', 'large'] },
        { type: 'color', id: 'background_color', label: 'Background Color' },
        { type: 'color', id: 'text_color', label: 'Text Color' },
      ],
    };
  }
  
  private isHeroBanner($: any, className: string, tag: string): boolean {
    return className.includes('hero') || className.includes('banner') ||
      className.includes('slideshow') || className.includes('slider') ||
      className.includes('hero-section') || tag === 'header';
  }
  
  private isFeaturedProducts($: any, className: string): boolean {
    return className.includes('featured-product') || className.includes('featured_products') ||
      className.includes('bestseller') || className.includes('popular') ||
      className.includes('recommend');
  }
  
  private isLogoList($: any, className: string): boolean {
    return className.includes('logo') || className.includes('brand') ||
      className.includes('partner') || className.includes('client');
  }
  
  private isTestimonial($: any, className: string): boolean {
    return className.includes('testimonial') || className.includes('review') ||
      className.includes('quote') || className.includes('feedback');
  }
  
  private isImageGallery($: any, className: string, tag: string): boolean {
    return className.includes('gallery') || className.includes('photos') ||
      className.includes('image-grid') || tag === 'figure';
  }
  
  private isAnnouncementBar($: any, className: string): boolean {
    return className.includes('announcement') || className.includes('notice') ||
      className.includes('alert-bar');
  }
  
  private isPromoBanner($: any, className: string): boolean {
    return className.includes('promo') || className.includes('sale') ||
      className.includes('offer') || className.includes('discount');
  }
  
  private extractProductHandles($: any): string[] {
    const handles: string[] = [];
    $('a[href*="/products/"]').each((_: any, el: any) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/\/products\/([^\/\?]+)/);
      if (match) handles.push(match[1]);
    });
    return [...new Set(handles)];
  }
  
  private extractLogos($: any): string[] {
    const logos: string[] = [];
    $('img').each((_: any, el: any) => {
      const src = $(el).attr('src') || '';
      const alt = $(el).attr('alt') || '';
      if (src) logos.push(src);
    });
    return logos;
  }
  
  private extractTestimonials($: any): any[] {
    const testimonials: any[] = [];
    $('[class*="testimonial"], [class*="review-item"]').each((_: any, el: any) => {
      const $el = $(el);
      testimonials.push({
        quote: $el.find('[class*="quote"], p').first().text().trim(),
        author: $el.find('[class*="author"], [class*="name"]').first().text().trim(),
        rating: $el.find('[class*="star"]').length || 5,
      });
    });
    return testimonials;
  }
  
  private extractGalleryImages($: any): string[] {
    const images: string[] = [];
    $('img').each((_: any, el: any) => {
      const src = $(el).attr('src') || '';
      if (src && !src.startsWith('data:')) images.push(src);
    });
    return images;
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
