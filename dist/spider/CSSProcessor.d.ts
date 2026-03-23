/**
 * Pixel2Liquid - CSSProcessor
 *
 * CSS处理：提取、合并、去重、优化
 */
import type { CssBundle } from './types.js';
export declare class CSSProcessor {
    private html;
    constructor(html: string);
    /**
     * 捆绑CSS：提取内联CSS和外部CSS（已下载）
     */
    bundle(): Promise<CssBundle>;
    /**
     * 合并多个CSS字符串
     */
    private mergeCss;
    /**
     * 简单规则字符串化
     */
    private stringifyRule;
    /**
     * 字符串化选择器
     */
    private stringifyPrelude;
    /**
     * 字符串化CSS块
     */
    private stringifyBlock;
    /**
     * 字符串化值
     */
    private stringifyValue;
    /**
     * 提取关键CSS（首屏渲染所需）
     */
    private extractCriticalCss;
    /**
     * 判断选择器是否为关键的
     */
    private isSelectorCritical;
    /**
     * 提取非关键CSS
     */
    private extractNonCritical;
    /**
     * 提取CSS变量
     */
    extractCssVariables(css: string): Record<string, string>;
    /**
     * 最小化CSS（移除注释和空白）
     */
    minify(css: string): string;
}
//# sourceMappingURL=CSSProcessor.d.ts.map