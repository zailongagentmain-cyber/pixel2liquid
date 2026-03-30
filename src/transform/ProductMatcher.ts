/**
 * ProductMatcher - 产品匹配
 * 
 * 从目标 Shopify 店铺获取产品列表，本地匹配源站产品
 */

import { ShopifyClient, ShopifyProduct } from './ShopifyClient.js';
import { ProductMap } from './types.js';

const CACHE_FILE = 'products-cache.json';

export class ProductMatcher {
  private shopifyClient: ShopifyClient;
  private cacheDir: string;

  constructor(shopifyClient: ShopifyClient, cacheDir: string = '.') {
    this.shopifyClient = shopifyClient;
    this.cacheDir = cacheDir;
  }

  /**
   * 拉取目标店铺所有产品
   * 优先从本地缓存读取
   */
  async fetchTargetProducts(forceRefresh: boolean = false): Promise<Map<string, ShopifyProduct>> {
    const cachePath = `${this.cacheDir}/${CACHE_FILE}`;
    
    // 如果缓存存在且不强制刷新，读取缓存
    if (!forceRefresh) {
      try {
        const { readFileSync } = await import('fs');
        const { existsSync } = await import('fs');
        
        if (existsSync(cachePath)) {
          const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as {
            products: ShopifyProduct[];
            fetchedAt: string;
          };
          
          const productMap = new Map<string, ShopifyProduct>();
          for (const p of cached.products) {
            productMap.set(p.handle, p);
          }
          console.log(`📦 从缓存加载 ${productMap.size} 个产品`);
          return productMap;
        }
      } catch {}
    }

    console.log('🌐 从 Shopify API 拉取产品列表...');
    const products = await this.shopifyClient.queryAllProducts();

    const productMap = new Map<string, ShopifyProduct>();
    for (const p of products) {
      productMap.set(p.handle, p);
    }

    // 保存到缓存
    try {
      const { writeFileSync, mkdirSync } = await import('fs');
      mkdirSync(this.cacheDir, { recursive: true });
      writeFileSync(cachePath, JSON.stringify({
        products,
        fetchedAt: new Date().toISOString(),
      }, null, 2), 'utf-8');
      console.log(`💾 已缓存 ${products.length} 个产品到 ${cachePath}`);
    } catch (e) {
      console.warn('⚠️  无法保存产品缓存:', e);
    }

    return productMap;
  }

  /**
   * 本地匹配源站产品和目标店铺产品
   */
  match(
    sourceHandles: string[],
    targetProducts: Map<string, ShopifyProduct>
  ): ProductMap[] {
    const matches: ProductMap[] = [];

    for (const handle of sourceHandles) {
      const targetProduct = targetProducts.get(handle);
      
      matches.push({
        sourceHandle: handle,
        sourceUrl: `/products/${handle}`,
        targetProductId: targetProduct?.id || null,
        targetProductHandle: targetProduct?.handle || null,
        matched: !!targetProduct,
        assetMappings: [],
      });
    }

    return matches;
  }

  /**
   * 找出需要创建的产品
   */
  getMissingProducts(matches: ProductMap[]): ProductMap[] {
    return matches.filter(m => !m.matched);
  }

  /**
   * 统计匹配情况
   */
  getMatchStats(matches: ProductMap[]): { matched: number; missing: number } {
    return {
      matched: matches.filter(m => m.matched).length,
      missing: matches.filter(m => !m.matched).length,
    };
  }
}
