/**
 * ShopifyClient - GraphQL API 客户端
 */

import type { ShopifyConfig, ShopifyProduct } from './types.js';
export type { ShopifyProduct } from './types.js';

const API_VERSION = '2024-10';

export class ShopifyClient {
  private config: ShopifyConfig;
  private endpoint: string;

  constructor(config: ShopifyConfig) {
    this.config = config;
    this.endpoint = `https://${config.shop}/admin/api/${API_VERSION}/graphql.json`;
  }

  /**
   * 执行 GraphQL 查询
   */
  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.config.token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { data: T; errors?: { message: string }[] };

    if (result.errors?.length) {
      throw new Error(`GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return result.data;
  }

  /**
   * 按 handle 查询单个产品
   */
  async queryProductByHandle(handle: string): Promise<ShopifyProduct | null> {
    const query = `
      query GetProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          handle
          title
          descriptionHtml
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          featuredImage {
            url
            altText
          }
          images(first: 10) {
            edges {
              node {
                url
                altText
              }
            }
          }
          options {
            name
            values
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
              }
            }
          }
        }
      }
    `;

    const data = await this.graphql<{ productByHandle: ShopifyProduct | null }>(query, { handle });
    return data.productByHandle;
  }

  /**
   * 批量查询所有产品（分页）
   */
  async queryAllProducts(): Promise<ShopifyProduct[]> {
    const products: ShopifyProduct[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              id
              handle
              title
              descriptionHtml
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              featuredImage {
                url
                altText
              }
              images(first: 5) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
              options {
                name
                values
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    price
                    compareAtPrice
                  }
                }
              }
            }
          }
        }
      }
    `;

    while (hasNextPage) {
      const data = await this.graphql<{
        products: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          edges: { cursor: string; node: ShopifyProduct }[];
        };
      }>(query, { first: 250, after: cursor });

      products.push(...data.products.edges.map(e => e.node));
      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor;
    }

    return products;
  }

  /**
   * 创建产品
   */
  async createProduct(input: {
    title: string;
    handle: string;
    descriptionHtml?: string;
    vendor?: string;
    productType?: string;
    status?: 'DRAFT' | 'ACTIVE';
    images?: { url: string }[];
  }): Promise<ShopifyProduct> {
    const mutation = `
      mutation ProductCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            handle
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphql<{
      productCreate: {
        product: ShopifyProduct;
        userErrors: { field: string; message: string }[];
      };
    }>(mutation, { input });

    if (data.productCreate.userErrors.length > 0) {
      throw new Error(`Product creation failed: ${data.productCreate.userErrors.map(e => e.message).join(', ')}`);
    }

    return data.productCreate.product;
  }

  /**
   * 创建产品变体
   */
  async createProductVariants(productId: string, variants: {
    title: string;
    price: string;
    sku?: string;
    inventoryItem?: { tracked: boolean };
  }[]): Promise<void> {
    const mutation = `
      mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          product {
            id
          }
          productVariants {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphql<{
      productVariantsBulkCreate: {
        userErrors: { field: string; message: string }[];
      };
    }>(mutation, { productId, variants });

    if (data.productVariantsBulkCreate.userErrors.length > 0) {
      throw new Error(`Variant creation failed: ${data.productVariantsBulkCreate.userErrors.map(e => e.message).join(', ')}`);
    }
  }

  /**
   * 上传文件到 Shopify CDN
   * 返回公开的 CDN URL
   */
  async uploadFile(filename: string, content: Buffer): Promise<string> {
    // 1. 创建 staged upload target
    const mutation = `
      mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const stagedData = await this.graphql<{
      stagedUploadsCreate: {
        stagedTargets: {
          url: string;
          resourceUrl: string | null;
          parameters: { name: string; value: string }[];
        }[];
        userErrors: { field: string; message: string }[];
      };
    }>(mutation, {
      input: [{
        resource: 'FILE',
        filename,
        mimeType: getMimeType(filename),
        fileSize: content.length.toString(),
      }],
    });

    if (stagedData.stagedUploadsCreate.userErrors.length > 0) {
      throw new Error(`Staged upload failed: ${stagedData.stagedUploadsCreate.userErrors.map(e => e.message).join(', ')}`);
    }

    const target = stagedData.stagedUploadsCreate.stagedTargets[0];

    // 2. 上传文件到 staging URL
    const formData = new FormData();
    target.parameters.forEach(p => formData.append(p.name, p.value));
    formData.append('file', new Blob([content as unknown as ArrayBuffer]), filename);

    await fetch(target.url, {
      method: 'POST',
      body: formData,
    });

    // 3. 创建 file 记录
    if (!target.resourceUrl) {
      throw new Error('No resource URL returned from staged upload');
    }

    const fileMutation = `
      mutation FileCreate($input: FileInput!) {
        fileCreate(input: $input) {
          file {
            ... on MediaImage {
              image {
                url
              }
            }
            ... on GenericFile {
              url
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const fileData = await this.graphql<{
      fileCreate: {
        file: { url: string } | null;
        userErrors: { field: string; message: string }[];
      };
    }>(fileMutation, { input: { url: target.resourceUrl } });

    if (fileData.fileCreate.userErrors.length > 0) {
      throw new Error(`File creation failed: ${fileData.fileCreate.userErrors.map(e => e.message).join(', ')}`);
    }

    return fileData.fileCreate.file?.url || target.resourceUrl;
  }

  /**
   * 获取主题 assets 列表
   */
  async getThemeAssets(): Promise<string[]> {
    const query = `
      query {
        theme {
          assets(first: 250) {
            edges {
              node {
                key
              }
            }
          }
        }
      }
    `;

    try {
      const data = await this.graphql<{
        theme: {
          assets: {
            edges: { node: { key: string } }[];
          };
        } | null;
      }>(query);

      if (!data.theme) {
        return [];
      }

      return data.theme.assets.edges.map(e => e.node.key);
    } catch {
      // 如果不支持，返回空数组
      return [];
    }
  }
}

/**
 * 根据文件名获取 MIME 类型
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'css': 'text/css',
    'js': 'application/javascript',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
    'json': 'application/json',
    'html': 'text/html',
    'liquid': 'application/liquid',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
