/**
 * Block.ts - 基类接口
 * 
 * 所有 Block 类必须实现此接口
 */

export interface BlockData {
  /** Block 名称 */
  name: string;
  /** Block 类型 */
  type: string;
  /** 原始选择器 */
  selector?: string;
  /** 提取到的数据 */
  data: Record<string, any>;
  /** CSS 元信息 */
  cssMeta?: Record<string, string>;
}

export interface BlockSchema {
  type: string;
  name: string;
  settings?: Record<string, any>[];
  blocks?: BlockSchema[];
}

export interface Block {
  /** Block 名称 */
  name: string;
  
  /**
   * 判断此 Block 是否能处理给定的元素
   * @param element Cheerio 元素
   * @param cssAst 可选的 CSS AST 分析结果
   * @returns true = 能处理，false = 不能处理
   */
  canHandle(element: any, cssAst?: any): boolean;
  
  /**
   * 从元素中提取 Block 数据
   * @param element Cheerio 元素
   * @param cssAst 可选的 CSS AST 分析结果
   * @returns 提取的 BlockData
   */
  extract(element: any, cssAst?: any): BlockData;
  
  /**
   * 生成 Liquid 模板片段
   * @param data BlockData
   * @returns Liquid 模板字符串
   */
  generateLiquid(data: BlockData): string;
  
  /**
   * 生成 Shopify Block Schema（用于 section settings）
   * @param data BlockData
   * @returns BlockSchema
   */
  generateSchema(data?: BlockData): BlockSchema;
}
