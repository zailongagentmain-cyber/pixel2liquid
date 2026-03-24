/**
 * Pixel2Liquid - Spider Main Class
 *
 * 采集目标：完整站点镜像，支持子页面递归采集
 * 渐进式采集：Phase 1 快速扫描 + Phase 2 逐页完整采集
 */
import type { SpiderOptions, SiteMap } from './types.js';
export declare class Spider {
    private options;
    private browser;
    private state;
    private resourceQueue;
    private proxyServer;
    private proxyPort;
    constructor(options: SpiderOptions);
    /**
     * 执行渐进式站点采集
     * Phase 1: 快速扫描获取URL列表
     * Phase 2: 逐页完整采集（含资源下载）
     *
     * 异步模式 (asyncMode=true):
     * - HTML采集后立即返回，不等待资源下载
     * - 资源进入后台队列下载
     * - 可选启动本地预览服务器
     */
    crawl(): Promise<SiteMap>;
    /**
     * 初始化异步模式组件
     */
    private initAsyncMode;
    /**
     * Phase 1: 快速扫描 - 只获取URL列表，不下载资源
     */
    private phase1QuickScan;
    /**
     * Phase 2: 渐进式完整采集 - 每页独立浏览器，完成后清理
     */
    private phase2ProgressiveCollect;
    /**
     * 启动独立浏览器（用于单页采集）
     */
    private launchIsolatedBrowser;
    /**
     * 采集单个页面（含资源下载）
     *
     * 异步模式 (asyncMode=true):
     * - 采集HTML后立即返回
     * - 资源URL加入队列，后台下载
     * - HTML中的资源URL保持原始地址（或替换为代理地址）
     */
    private collectSinglePage;
    /**
     * 收集HTML中的所有资源URL
     */
    private collectAssetUrls;
    /**
     * 将HTML中的资源URL替换为代理服务器地址
     */
    private replaceUrlsWithProxy;
    private prepareOutputDir;
    private launchBrowser;
    private closeBrowser;
    /**
     * 标记任务失败（供CLI调用）
     */
    fail(error: string): Promise<void>;
    private saveSiteMap;
}
//# sourceMappingURL=Spider.d.ts.map