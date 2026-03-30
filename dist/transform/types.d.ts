/**
 * Pixel2Liquid Transform Module - Type Definitions
 */
export interface BlockMap {
    sourceSelector: string;
    liquidReference: string;
    dataType: 'text' | 'image' | 'price' | 'link' | 'title' | 'description';
}
export interface PageStructure {
    pageType: 'product' | 'collection' | 'home' | 'blog';
    handle: string;
    sourceUrl: string;
    localPath: string;
    blocks: BlockMap[];
    productHandles: string[];
}
export interface AssetMapping {
    cdnUrl: string;
    filename: string;
    assetType: 'css' | 'js' | 'image' | 'font' | 'other';
    targetAssetUrl: string | null;
    liquidReference: string;
}
export interface OperationItem {
    type: 'create_product' | 'upload_asset';
    handle: string;
    title?: string;
    filename?: string;
    size?: string;
    assetType?: 'css' | 'js' | 'image' | 'font' | 'other';
    estimatedCost: number;
}
export interface ProductMap {
    sourceHandle: string;
    sourceUrl: string;
    targetProductId: string | null;
    targetProductHandle: string | null;
    matched: boolean;
    assetMappings: AssetMapping[];
}
export interface ShopifyProduct {
    id: string;
    handle: string;
    title: string;
    descriptionHtml: string;
    priceRange: {
        minVariantPrice: {
            amount: string;
            currencyCode: string;
        };
    };
    featuredImage: {
        url: string;
        altText: string | null;
    } | null;
    images: {
        url: string;
        altText: string | null;
    }[];
    options: {
        name: string;
        values: string[];
    }[];
    variants: {
        id: string;
        title: string;
        price: string;
        compareAtPrice: string | null;
    }[];
}
export interface ShopifyProductsResponse {
    products: {
        pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
        };
        edges: {
            cursor: string;
            node: ShopifyProduct;
        }[];
    };
}
export interface ShopifyProductResponse {
    productByHandle: ShopifyProduct | null;
}
export interface OperationItem {
    type: 'create_product' | 'upload_asset';
    handle: string;
    title?: string;
    filename?: string;
    size?: string;
    assetType?: 'css' | 'js' | 'image' | 'font' | 'other';
    estimatedCost: number;
}
export interface OperationSummary {
    generatedAt: string;
    sourceUrl: string;
    readOnly: {
        productsFound: number;
        assetsFound: number;
        liquidTemplates: string[];
    };
    requiresConfirmation: {
        productsToCreate: OperationItem[];
        assetsToUpload: OperationItem[];
        estimatedTotalCost: number;
    };
}
export interface ShopifyConfig {
    shop: string;
    token: string;
}
export interface TransformConfig {
    sourceDir: string;
    outputDir: string;
    shopify: ShopifyConfig;
    dryRun: boolean;
}
//# sourceMappingURL=types.d.ts.map