/**
 * LiquidGenerator - Liquid 模板生成
 * 
 * 生成 Shopify Liquid 主题模板
 */

import { PageStructure, BlockMap, ProductMap, AssetMapping } from './types.js';

export class LiquidGenerator {
  /**
   * 生成产品页 Liquid 模板
   */
  generateProductTemplate(page: PageStructure): string {
    const blocks = page.blocks.filter(b => b.dataType !== 'link');
    const schema = this.generateSectionSchema(blocks);

    return `{% comment %} ${page.handle} - Product Page {% endcomment %}
{% layout 'theme' %}

<section class="product-section" data-handle="${page.handle}">
  <div class="product-container">
    ${this.generateProductBlocks(blocks)}
  </div>
</section>

${schema}
`;
  }

  /**
   * 生成 Collection 页 Liquid 模板
   */
  generateCollectionTemplate(page: PageStructure): string {
    const schema = this.generateCollectionSchema();

    return `{% comment %} ${page.handle} - Collection Page {% endcomment %}
{% layout 'theme' %}

<section class="collection-section" data-handle="${page.handle}">
  <header class="collection-header">
    <h1>{{ collection.title }}</h1>
    <p>{{ collection.description }}</p>
  </header>
  
  <div class="product-grid">
    {% for product in collection.products %}
      <div class="product-card">
        <a href="{{ product.url }}">
          {{ product.featured_image | image_url: '400x' | image_tag: class: 'product-image' }}
        </a>
        <h3><a href="{{ product.url }}">{{ product.title }}</a></h3>
        <p>{{ product.price | money }}</p>
      </div>
    {% else %}
      <p>No products found.</p>
    {% endfor %}
  </div>
</section>

${schema}
`;
  }

  /**
   * 生成首页 Liquid 模板
   */
  generateHomeTemplate(page: PageStructure): string {
    return `{% comment %} Home Page {% endcomment %}
{% layout 'theme' %}

<section class="home-section" data-handle="${page.handle}">
  ${page.blocks.map(b => `<!-- Block: ${b.dataType} -->`).join('\n  ')}
  
  <div class="home-content">
    ${this.generateHomeBlocks(page.blocks)}
  </div>
</section>

{% schema %}
{
  "name": "Home",
  "sections": {
    "main": {
      "type": "home-template",
      "blocks": []
    }
  },
  "order": ["main"]
}
{% endschema %}
`;
  }

  /**
   * 生成 product.json (Section 配置)
   */
  generateProductJson(page: PageStructure, productMap: ProductMap): string {
    return JSON.stringify({
      name: page.handle,
      sections: {
        main: {
          type: 'product-template',
          settings: {
            product: productMap.targetProductId || '',
          },
        },
      },
      order: ['main'],
    }, null, 2);
  }

  /**
   * 生成 Section schema
   */
  generateSectionSchema(blocks: BlockMap[]): string {
    const schemaBlocks = blocks.map(block => ({
      type: block.dataType,
      name: block.dataType.charAt(0).toUpperCase() + block.dataType.slice(1),
      settings: [
        {
          type: 'checkbox',
          id: 'show_' + block.dataType,
          label: 'Show ' + block.dataType,
          default: true,
        },
      ],
    }));

    return `{% schema %}
{
  "name": "Product Section",
  "tag": "section",
  "class": "product-section",
  "settings": [
    {
      "type": "header",
      "content": "Product Display"
    }
  ],
  "blocks": ${JSON.stringify(schemaBlocks, null, 4)},
  "presets": [
    {
      "name": "Product Default",
      "blocks": [
        ${schemaBlocks.map((b, i) => `{
          "type": "${b.type}",
          "settings": {}
        }`).join(',\n        ')}
      ]
    }
  ]
}
{% endschema %}`;
  }

  /**
   * 生成 Collection schema
   */
  generateCollectionSchema(): string {
    return `{% schema %}
{
  "name": "Collection",
  "tag": "section",
  "class": "collection-section",
  "settings": [
    {
      "type": "header",
      "content": "Collection Settings"
    },
    {
      "type": "collection_picker"
    }
  ],
  "presets": [
    {
      "name": "Collection Grid"
    }
  ]
}
{% endschema %}`;
  }

  /**
   * 生成产品区块 HTML
   */
  private generateProductBlocks(blocks: BlockMap[]): string {
    const sections: string[] = [];

    for (const block of blocks) {
      switch (block.dataType) {
        case 'title':
          sections.push(`<h1 class="product-title">{{ product.title }}</h1>`);
          break;
        case 'price':
          sections.push(`<p class="product-price">{{ product.price | money }}</p>`);
          sections.push(`<p class="product-compare-price">{{ product.compare_at_price | money }}</p>`);
          break;
        case 'image':
          sections.push(`<div class="product-image">
  {{ product.featured_image | image_url: '1024x1024' | image_tag: class: 'featured-image', loading: 'lazy' }}
</div>`);
          break;
        case 'description':
          sections.push(`<div class="product-description">
  {{ product.description }}
</div>`);
          break;
        default:
          sections.push(`<!-- Block: ${block.dataType} -->`);
      }
    }

    // 确保有 add-to-cart 区块
    if (!blocks.find(b => b.dataType === 'price')) {
      sections.push(`<div class="product-add-to-cart">
  {% form 'product', product %}
    <button type="submit" class="btn">Add to Cart</button>
  {% endform %}
</div>`);
    }

    return sections.join('\n    ');
  }

  /**
   * 生成首页区块
   */
  private generateHomeBlocks(blocks: BlockMap[]): string {
    return blocks.map(b => `<!-- ${b.dataType}: ${b.sourceSelector} -->`).join('\n    ');
  }

  /**
   * 替换 HTML 中的 CDN URL 为 Liquid filter
   */
  replaceCdnWithLiquid(html: string, assetMappings: AssetMapping[]): string {
    let result = html;

    for (const mapping of assetMappings) {
      if (mapping.targetAssetUrl) {
        // 替换 CDN URL 为 Liquid filter
        result = result.replace(
          new RegExp(this.escapeRegex(mapping.cdnUrl), 'g'),
          mapping.liquidReference.replace(/'/g, '"')
        );
      }
    }

    return result;
  }

  /**
   * 生成主题目录结构
   */
  generateThemeStructure(): Record<string, string> {
    return {
      'layout/theme.liquid': `{% comment %} Main Theme Layout {% endcomment %}
<!DOCTYPE html>
<html lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {{ content_for_header }}
  {{ 'base.css' | asset_url | stylesheet_tag }}
</head>
<body>
  {% section 'header' %}
  {{ content_for_layout }}
  {% section 'footer' %}
  {{ 'base.js' | asset_url | script_tag }}
</body>
</html>`,

      'sections/header.liquid': `{% comment %} Header Section {% endcomment %}
<header class="site-header">
  <div class="header-container">
    <a href="/" class="logo">{{ shop.name }}</a>
    <nav class="nav-menu">
      {% for link in linklists.main-menu.links %}
        <a href="{{ link.url }}">{{ link.title }}</a>
      {% endfor %}
    </nav>
  </div>
</header>`,

      'sections/footer.liquid': `{% comment %} Footer Section {% endcomment %}
<footer class="site-footer">
  <p>&copy; {{ shop.name }}</p>
</footer>`,

      'config/settings_data.json': JSON.stringify({
        current: {
          sections: {
            header: { type: 'header' },
            footer: { type: 'footer' },
          },
        },
      }, null, 2),
    };
  }

  /**
   * 转义正则字符串
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
