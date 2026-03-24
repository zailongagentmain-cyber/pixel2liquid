#!/usr/bin/env node
/**
 * fix-gempages.js
 * 
 * Replaces <gp-product> dynamic components in index.html with static <a> tags.
 * Uses cheerio to extract data, then does string replacement to preserve HTML structure.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_PATH = path.join(__dirname, '../fandomara-output/index.html');
const OUTPUT_PATH = path.join(__dirname, '../fandomara-output/index.html');

function formatPrice(cents, currency = 'USD') {
  if (cents == null) return '';
  if (currency === 'USD') return `$${(cents / 100).toFixed(2)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function makeStaticProductHTML(product) {
  const { gpData, gpContext } = product;
  
  const productUrl = gpData.productUrl || (gpData.productHandle ? `/products/${gpData.productHandle}` : '#');
  
  const variant = gpContext?.variantSelected || {};
  const name = variant.name || gpContext?.name || 'Product';
  const price = variant.price != null ? formatPrice(variant.price) : '';
  const compareAtPrice = variant.compare_at_price != null ? formatPrice(variant.compare_at_price) : '';
  
  const imageUrl =
    variant.featured_image?.src ||
    variant.featured_media?.preview_image?.src ||
    gpContext?.featured_image?.src ||
    '';
  const imageAlt = variant.featured_image?.alt || name;
  
  const discount = (compareAtPrice && price)
    ? Math.round((1 - parseFloat(price.replace('$','')) / parseFloat(compareAtPrice.replace('$',''))) * 100)
    : 0;
  
  let html = `<a href="${productUrl}" class="gp-product-static" style="display:block;position:relative;text-decoration:none;color:inherit;">`;
  
  if (imageUrl) {
    html += `<img src="${imageUrl}" alt="${imageAlt}" loading="lazy" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:var(--g-radius-small,4px);">`;
  } else {
    html += `<div style="width:100%;aspect-ratio:1/1;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:12px;color:#999;">No Image</div>`;
  }
  
  if (discount > 0) {
    html += `<span style="position:absolute;top:8px;right:8px;background:#121212;color:#fff;font-size:12px;padding:2px 6px;border-radius:4px;z-index:2;">${discount}% off</span>`;
  }
  
  html += `<div style="padding:8px 0;">`;
  html += `<div style="font-size:14px;font-weight:500;line-height:1.4;margin-bottom:4px;color:#121212;">${name}</div>`;
  
  if (price) {
    if (compareAtPrice) {
      html += `<div style="display:flex;align-items:center;gap:6px;">`;
      html += `<span style="font-size:14px;font-weight:600;color:#121212;">${price}</span>`;
      html += `<span style="font-size:12px;color:#888;text-decoration:line-through;">${compareAtPrice}</span>`;
      html += `</div>`;
    } else {
      html += `<div style="font-size:14px;font-weight:600;color:#121212;">${price}</div>`;
    }
  }
  
  html += `</div></a>`;
  return html;
}

function fixGempages() {
  console.log('📄 Reading index.html...');
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  
  const originalLength = html.length;
  let replacedCount = 0;
  let skippedCount = 0;
  
  // Step 1: Use cheerio to extract all gp-product data
  const $ = cheerio.load(html);
  const products = [];
  
  $('gp-product').each(function() {
    const el = $(this);
    const gpContextStr = el.attr('gp-context');
    const gpDataStr = el.attr('gp-data');
    
    if (!gpContextStr || !gpDataStr) return;
    
    let gpData, gpContext;
    try {
      gpData = JSON.parse(gpDataStr);
      gpContext = JSON.parse(gpContextStr);
    } catch(e) {
      return;
    }
    
    if (!gpData.productHandle) return;
    
    products.push({
      gpData,
      gpContext,
      // Cheerio's html() gives us the inner HTML of the element
      originalHTML: $.html(el[0])
    });
  });
  
  console.log(`Found ${products.length} gp-product elements`);
  
  // Step 2: Replace each gp-product block in the raw HTML
  let resultHtml = html;
  
  // Use a regex to find each gp-product block and replace it
  // The block ends with </form></gp-product>
  // We match from <gp-product to </form></gp-product>
  const gpProductBlockRegex = /<gp-product\b[\s\S]*?<\/form><\/gp-product>/g;
  
  let blockCount = 0;
  resultHtml = resultHtml.replace(gpProductBlockRegex, (match) => {
    // Find the corresponding product data for this block
    // Use cheerio again to parse the specific block
    const $block = cheerio.load(match);
    const el = $block('gp-product');
    const gpContextStr = el.attr('gp-context');
    const gpDataStr = el.attr('gp-data');
    
    if (!gpContextStr || !gpDataStr) {
      skippedCount++;
      return match;
    }
    
    let gpData, gpContext;
    try {
      gpData = JSON.parse(gpDataStr);
      gpContext = JSON.parse(gpContextStr);
    } catch(e) {
      skippedCount++;
      return match;
    }
    
    if (!gpData.productHandle) {
      skippedCount++;
      return match;
    }
    
    const staticHTML = makeStaticProductHTML({ gpData, gpContext });
    replacedCount++;
    blockCount++;
    return staticHTML;
  });
  
  // Step 3: Remove orphaned child components (these are siblings inside the grid)
  const orphanComponents = [
    /<gp-product-badge[^>]*>[\s\S]*?<\/gp-product-badge>\s*/gi,
    /<gp-product-title[^>]*>[\s\S]*?<\/gp-product-title>\s*/gi,
    /<gp-product-price[^>]*>[\s\S]*?<\/gp-product-price>\s*/gi,
    /<gp-product-button[^>]*>[\s\S]*?<\/gp-product-button>\s*/gi,
  ];
  
  orphanComponents.forEach(regex => {
    const before = resultHtml.length;
    resultHtml = resultHtml.replace(regex, '');
    if (resultHtml.length !== before) {
      console.log('🗑️  Removed orphaned component elements');
    }
  });
  
  // Step 4: Remove GP component JS scripts
  const gpScripts = [
    'gp-product-badge-v7-5.js',
    'gp-product-title-v7-5.js',
    'gp-product-price-v7-5.js',
    'gp-product-button-v7-5.js',
    'gp-product-v7-5.js'
  ];
  
  gpScripts.forEach(script => {
    const scriptRegex = new RegExp(`<script[^>]*src="https://assets\\.gemcommerce\\.com/assets-v2/${script}[^"]*"[^>]*></script>\\s*`, 'gi');
    const before = resultHtml.length;
    resultHtml = resultHtml.replace(scriptRegex, '');
    if (resultHtml.length !== before) {
      console.log(`🗑️  Removed ${script}`);
    }
  });
  
  // Step 5: Remove empty gp-row or items-repeat wrappers if they have no children
  // This is optional - we'll leave them as-is to preserve page structure
  
  fs.writeFileSync(OUTPUT_PATH, resultHtml, 'utf8');
  
  const newLength = resultHtml.length;
  console.log(`\n✅ Done!`);
  console.log(`   Replaced: ${replacedCount} gp-product blocks`);
  console.log(`   Skipped:  ${skippedCount} blocks`);
  console.log(`   Size:     ${originalLength} → ${newLength} bytes`);
  
  // Verify product URLs
  const urls = [
    '/products/love-and-deepspace-merch-body-pillow-cover',
    '/products/sylus-love-and-deepspace-body-pillow',
    '/products/love-and-deepspace-merch-20cm-doll-outfits',
    '/products/love-and-deepspace-merch-wallet',
    '/products/electronic-button-pin',
    '/products/large-lace-ita-bag',
    '/products/large-ita-backpack',
    '/products/love-and-deepspace-plushies-10cm',
    '/products/super-large-ita-backpack',
  ];
  
  console.log('\n🔗 Product URL verification:');
  urls.forEach(url => {
    const found = resultHtml.includes(`href="${url}"`) || resultHtml.includes(`href='${url}'`);
    console.log(`   ${found ? '✅' : '❌'} ${url}`);
  });
}

fixGempages();
