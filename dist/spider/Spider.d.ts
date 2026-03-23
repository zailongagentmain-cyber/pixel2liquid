/**
 * Pixel2Liquid - Spider Main Class
 *
 * 采集目标：完整站点镜像，支持子页面递归采集
 */
import type { SpiderOptions, SiteMap } from './types.js';
export declare class Spider {
    private options;
    private browser;
    private state;
    constructor(options: SpiderOptions);
    /**
     * 执行完整站点采集
     */
    crawl(): Promise<SiteMap>;
    /**
     * 创建输出目录结构
     */
    private prepareOutputDir;
    /**
     * 启动浏览器
     */
    private launchBrowser;
    /**
     * 关闭浏览器
     */
    private closeBrowser;
    /**
     * 处理单个页面：下载资源、合并CSS、修复路径
     */
    private processPage;
    /**
     * 保存站点地图
     */
    private saveSiteMap;
}
//# sourceMappingURL=Spider.d.ts.map