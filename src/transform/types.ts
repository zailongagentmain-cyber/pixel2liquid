/**
 * Pixel2Liquid Transform Module - Type Definitions
 */

// 区块映射表
export interface BlockMap {
  sourceSelector: string;    // ".product-card h3"
  liquidReference: string;  // "{{ product.title }}"
  dataType: 'text' | 'image' | 'price' | 'link' | 'title' | 'description';
}

// 页面结构
export interface PageStructure {
  pageType: 'product' | 'collection' | 'home' | 'blog';
  handle: string;           // URL handle
  sourceUrl: string;        // 源站 URL
  localPath: string;        // 本地文件路径
  blocks: BlockMap[];        // DOM 区块列表
  productHandles: string[]; // 页面中引用的产品 handle
}

// 资源映射
export interface AssetMapping {
  cdnUrl: string;           // 源站 CDN URL
  filename: string;         // "base.css"
  assetType: 'css' | 'js' | 'image' | 'font' | 'other';
  targetAssetUrl: string | null;  // null = 需上传
  liquidReference: string;   // "{{ 'base.css' | asset_url }}"
}

// 操作项
export interface OperationItem {
  type: 'create_product' | 'upload_asset';
  handle: string;           // 产品 handle 或文件名
  title?: string;            // 产品标题
  filename?: string;         // 资源文件名
  size?: string;            // 文件大小
  assetType?: 'css' | 'js' | 'image' | 'font' | 'other';
  estimatedCost: number;     // 预估 API 点数消耗
}

// 产品映射
export interface ProductMap {
  sourceHandle: string;      // "love-and-deepspace-body-pillow"
  sourceUrl: string;         // 源站产品页 URL
  targetProductId: string | null;  // null = 待创建
  targetProductHandle: string | null;
  matched: boolean;          // 是否在目标店铺找到
  assetMappings: AssetMapping[];
}

// Shopify 产品数据
export interface ShopifyProduct {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  featuredImage: { url: string; altText: string | null } | null;
  images: { url: string; altText: string | null }[];
  options: { name: string; values: string[] }[];
  variants: {
    id: string;
    title: string;
    price: string;
    compareAtPrice: string | null;
  }[];
}

// Shopify GraphQL 响应
export interface ShopifyProductsResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { cursor: string; node: ShopifyProduct }[];
  };
}

export interface ShopifyProductResponse {
  productByHandle: ShopifyProduct | null;
}

// 操作项
export interface OperationItem {
  type: 'create_product' | 'upload_asset';
  handle: string;           // 产品 handle 或文件名
  title?: string;            // 产品标题
  filename?: string;         // 资源文件名
  size?: string;            // 文件大小
  assetType?: 'css' | 'js' | 'image' | 'font' | 'other';
  estimatedCost: number;     // 预估 API 点数消耗
}

// 操作清单
export interface OperationSummary {
  generatedAt: string;
  sourceUrl: string;
  readOnly: {
    productsFound: number;      // 找到的产品数
    assetsFound: number;        // 找到的资源数
    liquidTemplates: string[];   // 将生成的模板列表
  };
  requiresConfirmation: {
    productsToCreate: OperationItem[];
    assetsToUpload: OperationItem[];
    estimatedTotalCost: number;
  };
}

// Shopify 配置
export interface ShopifyConfig {
  shop: string;      // "your-store.myshopify.com"
  token: string;     // Admin API access token (shpat_xxx)
}

// Transform 配置
export interface TransformConfig {
  sourceDir: string;        // 采集结果目录
  outputDir: string;          // 主题输出目录
  shopify: ShopifyConfig;
  dryRun: boolean;           // 只生成清单，不执行
}
