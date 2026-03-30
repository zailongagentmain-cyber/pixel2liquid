/**
 * HtmlParser - HTML 结构解析
 *
 * 解析采集的 HTML，识别页面类型、结构和产品引用
 */
import * as cheerio from 'cheerio';
export class HtmlParser {
    /**
     * 解析 HTML 文件
     */
    parse(html, url, localPath) {
        const pageType = this.detectPageType(url, html);
        const handle = this.extractHandle(url);
        const blocks = this.extractBlocks(html, pageType);
        const productHandles = this.extractProductHandles(html);
        return {
            pageType,
            handle,
            sourceUrl: url,
            localPath,
            blocks,
            productHandles,
        };
    }
    /**
     * 检测页面类型
     */
    detectPageType(url, html) {
        const $ = cheerio.load(html);
        // URL 路径判断
        if (url.includes('/products/'))
            return 'product';
        if (url.includes('/collections/'))
            return 'collection';
        if (url.includes('/blogs/'))
            return 'blog';
        // 特殊页面检测
        if ($('[data-section-type="product"]').length > 0)
            return 'product';
        if ($('[data-section-type="collection"]').length > 0)
            return 'collection';
        if ($('.shopify-section--highlighted').length > 0)
            return 'home';
        // 默认首页
        if (url === '/' || url.endsWith('/'))
            return 'home';
        return 'home';
    }
    /**
     * 从 URL 提取 handle
     */
    extractHandle(url) {
        const match = url.match(/\/(products|collections|blogs)\/([^\/\?]+)/);
        return match ? match[2] : 'unknown';
    }
    /**
     * 提取所有 gp-product 组件的产品 handle
     */
    extractGpProducts(html) {
        const $ = cheerio.load(html);
        const handles = [];
        $('gp-product').each(function () {
            const el = $(this);
            const gpDataStr = el.attr('gp-data');
            if (!gpDataStr)
                return;
            try {
                const gpData = JSON.parse(gpDataStr);
                if (gpData.productHandle) {
                    handles.push(gpData.productHandle);
                }
            }
            catch { }
        });
        return handles;
    }
    /**
     * 提取产品链接中的 handle
     */
    extractProductLinks(html) {
        const $ = cheerio.load(html);
        const handles = [];
        $('a[href*="/products/"]').each(function () {
            const href = $(this).attr('href');
            if (!href)
                return;
            const match = href.match(/\/products\/([^\/\?]+)/);
            if (match) {
                handles.push(match[1]);
            }
        });
        return [...new Set(handles)]; // 去重
    }
    /**
     * 提取页面中所有产品 handle（gp-product + 链接）
     */
    extractProductHandles(html) {
        const gpHandles = this.extractGpProducts(html);
        const linkHandles = this.extractProductLinks(html);
        return [...new Set([...gpHandles, ...linkHandles])];
    }
    /**
     * 提取产品展示区块
     */
    extractProductBlocks(html) {
        const $ = cheerio.load(html);
        const blocks = [];
        // 检测产品标题区块
        $('.product__title h1, .product-title, h1[class*="product"]').each((_, el) => {
            blocks.push({
                sourceSelector: this.getSelector($, el),
                liquidReference: '{{ product.title }}',
                dataType: 'text',
            });
        });
        // 检测价格区块
        $('.product__price, .price, [class*="price"]').each((_, el) => {
            blocks.push({
                sourceSelector: this.getSelector($, el),
                liquidReference: '{{ product.price | money }}',
                dataType: 'price',
            });
        });
        // 检测图片区块
        $('.product__image, .product-image, [class*="featured-image"] img').each((_, el) => {
            blocks.push({
                sourceSelector: this.getSelector($, el),
                liquidReference: '{{ product.featured_image | image_url: \'1024x1024\' }}',
                dataType: 'image',
            });
        });
        // 检测描述区块
        $('.product__description, .product-description, [class*="description"]').each((_, el) => {
            blocks.push({
                sourceSelector: this.getSelector($, el),
                liquidReference: '{{ product.description }}',
                dataType: 'text',
            });
        });
        return blocks;
    }
    /**
     * 提取页面区块（根据页面类型）
     */
    extractBlocks(html, pageType) {
        const $ = cheerio.load(html);
        const blocks = [];
        switch (pageType) {
            case 'product':
                return this.extractProductBlocks(html);
            case 'collection':
                // Collection 页：产品网格区块
                $('.product-grid-item, .product-card, [class*="product-item"]').each((_, el) => {
                    blocks.push({
                        sourceSelector: this.getSelector($, el),
                        liquidReference: '{% for product in collection.products %}...{% endfor %}',
                        dataType: 'text',
                    });
                });
                break;
            case 'home':
                // 首页：hero、featured-products 等
                $('[class*="hero"], [class*="banner"], [class*="featured"]').each((_, el) => {
                    blocks.push({
                        sourceSelector: this.getSelector($, el),
                        liquidReference: '{% section \'homepage-section\' %}',
                        dataType: 'text',
                    });
                });
                break;
            case 'blog':
                // Blog 页：文章列表
                $('.article-card, [class*="blog-post"]').each((_, el) => {
                    blocks.push({
                        sourceSelector: this.getSelector($, el),
                        liquidReference: '{% for article in blog.articles %}...{% endfor %}',
                        dataType: 'text',
                    });
                });
                break;
        }
        // 通用区块检测
        $('h1, h2, h3, img[src], a[href]').each((_, el) => {
            const tag = $(el).get(0)?.tagName;
            const href = $(el).attr('href');
            const src = $(el).attr('src');
            if (tag === 'H1' || tag === 'H2') {
                blocks.push({
                    sourceSelector: this.getSelector($, el),
                    liquidReference: `{{ page.title }}`,
                    dataType: 'text',
                });
            }
            else if (src && !src.startsWith('data:')) {
                blocks.push({
                    sourceSelector: this.getSelector($, el),
                    liquidReference: `{{ '${this.extractFilename(src)}' | asset_url }}`,
                    dataType: 'image',
                });
            }
            else if (href && href.includes('/products/')) {
                blocks.push({
                    sourceSelector: this.getSelector($, el),
                    liquidReference: `{{ product.url }}`,
                    dataType: 'link',
                });
            }
        });
        return blocks;
    }
    /**
     * 生成唯一选择器
     */
    getSelector($, el) {
        const node = $(el);
        const tag = el.tagName.toLowerCase();
        // 优先用 class
        const className = node.attr('class');
        if (className) {
            const cleanClass = className.trim().split(/\s+/).slice(0, 2).join('.');
            return `${tag}.${cleanClass}`;
        }
        // 用 id
        const id = node.attr('id');
        if (id) {
            return `${tag}#${id}`;
        }
        // 回退：用父级路径
        return tag;
    }
    /**
     * 从 URL 提取文件名
     */
    extractFilename(url) {
        try {
            const pathname = new URL(url).pathname;
            const parts = pathname.split('/');
            const lastPart = parts[parts.length - 1];
            // 去掉 query string
            return lastPart.split('?')[0];
        }
        catch {
            return 'unknown';
        }
    }
}
//# sourceMappingURL=HtmlParser.js.map