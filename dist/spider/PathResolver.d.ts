/**
 * Pixel2Liquid - PathResolver
 *
 * 路径修复：将相对路径转为本地绝对路径
 */
import type { CollectedPage } from './types.js';
export declare class PathResolver {
    private page;
    private outputDir;
    private resolvedHtml;
    constructor(page: CollectedPage, outputDir: string);
    /**
     * 执行所有路径修复
     */
    resolve(): void;
    /**
     * 修复图片路径
     */
    private resolveImages;
    /**
     * 修复CSS路径
     */
    private resolveStylesheets;
    /**
     * 修复JS路径
     */
    private resolveScripts;
    /**
     * 修复链接
     */
    private resolveLinks;
    /**
     * 修复srcset属性
     */
    private resolveSrcset;
    /**
     * 解析srcset字符串
     */
    private resolveSrcsetString;
    /**
     * 解析资源路径
     */
    private resolveAssetPath;
    /**
     * 解析页面链接路径
     */
    private resolvePagePath;
    /**
     * 修复CSS内的URL
     */
    private resolveCssUrls;
    /**
     * 判断是否为内部链接
     */
    private isInternalLink;
    /**
     * 获取修复后的HTML
     */
    getResolvedHtml(): string;
}
//# sourceMappingURL=PathResolver.d.ts.map