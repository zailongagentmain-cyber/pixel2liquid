/**
 * ProductBlock.ts - 产品页 Block
 *
 * 识别：产品标题、价格、图片、描述、变体选择器
 */
export class ProductBlock {
    name = 'Product Block';
    /**
     * 判断元素是否属于产品页内容
     */
    canHandle(element, cssAst) {
        const $ = element;
        const className = $.attr('class') || '';
        const id = $.attr('id') || '';
        const productIndicators = [
            'product', 'title', 'price', 'gallery', 'description',
            'variant', 'addtocart', 'add-to-cart', 'buy',
            'image', 'featured', 'summary', 'details',
        ];
        const combined = (className + ' ' + id).toLowerCase();
        return productIndicators.some(ind => combined.includes(ind));
    }
    /**
     * 从产品页元素中提取数据
     */
    extract(element, cssAst) {
        const $ = element;
        const el = $.get(0);
        const tag = el?.tagName?.toLowerCase() || '';
        const className = $.attr('class') || '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = { type: '' };
        // 根据元素类型和类名判断数据类型
        if (this.isTitle($, tag, className)) {
            data.type = 'title';
            data.text = $.text().trim();
            data.tag = tag;
        }
        else if (this.isPrice($, tag, className)) {
            data.type = 'price';
            data.text = $.text().trim();
            data.amount = this.extractPriceAmount($.text());
            data.currency = this.detectCurrency($.text());
        }
        else if (this.isImage($, tag, className)) {
            data.type = 'image';
            data.src = $.attr('src') || $.attr('data-src') || '';
            data.alt = $.attr('alt') || '';
            data.srcset = $.attr('srcset') || '';
        }
        else if (this.isDescription($, tag, className)) {
            data.type = 'description';
            data.html = $.html();
            data.text = $.text().trim();
        }
        else if (this.isVariantSelector($, tag, className)) {
            data.type = 'variant-selector';
            data.options = this.extractSelectOptions($);
        }
        else if (this.isButton($, tag, className)) {
            data.type = 'button';
            data.text = $.text().trim();
            data.action = $.attr('data-action') || '';
        }
        else if (tag === 'img') {
            data.type = 'image';
            data.src = $.attr('src') || '';
            data.alt = $.attr('alt') || '';
        }
        // 提取 CSS Grid/Flex 布局信息
        const cssMeta = {};
        if (cssAst?.layoutInfo) {
            const { gridSelectors, flexSelectors } = cssAst.layoutInfo;
            if (gridSelectors.some((s) => s.includes(className))) {
                cssMeta.display = 'grid';
            }
            else if (flexSelectors.some((s) => s.includes(className))) {
                cssMeta.display = 'flex';
            }
        }
        // 合并 CSS 变量
        if (cssAst?.cssVariables) {
            for (const [key, value] of Object.entries(cssAst.cssVariables)) {
                if (key.startsWith('--spacing') || key.startsWith('--gap') || key.startsWith('--color')) {
                    cssMeta[key] = value;
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
     * 生成 Product Liquid 模板
     */
    generateLiquid(data) {
        const { type, data: blockData } = data;
        switch (type) {
            case 'title':
                return `{{ product.title }}`;
            case 'price':
                return `{{ product.price | money }}`;
            case 'compare-price':
                return `{{ product.compare_at_price | money }}`;
            case 'image':
                if (blockData.alt?.includes('variant')) {
                    return `{{ product.selected_or_first_available_variant.image | image_url: '1024x1024' | default: product.featured_image | image_url: '1024x1024' }}`;
                }
                return `{{ product.featured_image | image_url: '1024x1024' }}`;
            case 'description':
                return `{{ product.description }}`;
            case 'variant-selector':
                return `{% render 'product-variant-options', product: product, selected_variant: product.selected_or_first_available_variant %}`;
            case 'button':
                return `{% render 'add-to-cart-button', product: product %}`;
            default:
                return `{{ product.${type} }}`;
        }
    }
    /**
     * 生成 Product Block Schema
     */
    generateSchema(data) {
        return {
            type: 'product-block',
            name: 'Product Block',
            settings: [
                { type: 'text', id: 'title', label: 'Title', default: 'Product Title' },
                { type: 'checkbox', id: 'show_price', label: 'Show Price', default: true },
                { type: 'checkbox', id: 'show_description', label: 'Show Description', default: true },
                { type: 'checkbox', id: 'show_variant_selector', label: 'Variant Selector', default: true },
                { type: 'checkbox', id: 'show_add_to_cart', label: 'Add to Cart Button', default: true },
                { type: 'select', id: 'image_aspect_ratio', label: 'Image Aspect Ratio', options: ['natural', 'square', 'portrait', 'landscape'] },
            ],
        };
    }
    isTitle($, tag, className) {
        return (tag === 'h1' || tag === 'h2') &&
            (className.includes('title') || className.includes('product') || className.includes('heading'));
    }
    isPrice($, tag, className) {
        const text = $.text().trim();
        return (className.includes('price') || className.includes('cost')) &&
            (text.includes('$') || text.includes('¥') || text.includes('€') || /\d/.test(text));
    }
    isImage($, tag, className) {
        return tag === 'img' || className.includes('image') || className.includes('photo') || className.includes('gallery');
    }
    isDescription($, tag, className) {
        return className.includes('description') || className.includes('detail') || className.includes('summary') ||
            className.includes('content') || tag === 'article';
    }
    isVariantSelector($, tag, className) {
        return tag === 'select' || className.includes('variant') || className.includes('option') || className.includes('selector');
    }
    isButton($, tag, className) {
        return tag === 'button' || className.includes('button') || className.includes('btn') ||
            className.includes('add-to-cart') || className.includes('buy');
    }
    extractPriceAmount(text) {
        const match = text.match(/[\d,]+\.?\d*/);
        return match ? match[0].replace(/,/g, '') : '';
    }
    detectCurrency(text) {
        if (text.includes('$'))
            return 'USD';
        if (text.includes('¥'))
            return 'JPY/CNY';
        if (text.includes('€'))
            return 'EUR';
        if (text.includes('£'))
            return 'GBP';
        return 'USD';
    }
    extractSelectOptions($) {
        const options = [];
        $('option').each((_, el) => {
            const text = $(el).text().trim();
            if (text && text !== 'Select...') {
                options.push(text);
            }
        });
        return options;
    }
    getSelector($) {
        const tag = $.get(0)?.tagName?.toLowerCase() || '';
        const className = $.attr('class');
        if (className) {
            const cleanClass = className.trim().split(/\s+/).slice(0, 2).join('.');
            return `${tag}.${cleanClass}`;
        }
        const id = $.attr('id');
        if (id)
            return `${tag}#${id}`;
        return tag;
    }
}
//# sourceMappingURL=ProductBlock.js.map