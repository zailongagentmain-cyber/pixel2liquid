/**
 * Pixel2Liquid - StaticRenderer
 *
 * JS静态化渲染：等待动态内容加载完成后提取HTML
 */
import { Browser } from '@playwright/test';
import type { CollectedPage, SpiderOptions } from './types.js';
export declare class StaticRenderer {
    private page;
    private browser;
    private options;
    constructor(page: CollectedPage, browser: Browser, options: Required<SpiderOptions>);
    /**
     * 渲染页面：等待JS执行完成，获取完整HTML
     */
    render(): Promise<void>;
    /**
     * 准备本地HTML（替换资源路径为本地）
     */
    private prepareLocalHtml;
    /**
     * 等待动态内容渲染完成
     */
    private waitForDynamicContent;
    /**
     * 滚动页面触发懒加载
     */
    private scrollPage;
    /**
     * 转义正则表达式特殊字符
     */
    private escapeRegex;
}
//# sourceMappingURL=StaticRenderer.d.ts.map