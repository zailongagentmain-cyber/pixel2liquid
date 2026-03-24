/**
 * Pixel2Liquid - Spider Module Types
 */

// 资源类型
export interface Asset {
  url: string;
  localPath: string;
  type: 'image' | 'font' | 'js' | 'css';
  size?: number;
  mimeType?: string;
}

// 页面元数据
export interface PageMeta {
  title?: string;
  description?: string;
  viewport?: string;
  charset?: string;
}

// 单个采集页面
export interface CollectedPage {
  url: string;
  localPath: string;
  html: string;
  css: CssBundle;
  images: Asset[];
  fonts: Asset[];
  js: Asset[];
  links: string[];
  metadata: PageMeta;
}

// CSS捆绑包
export interface CssBundle {
  all: string;
  inline: string;
  external: string[];
  critical: string;
  nonCritical: string;
}

// 站点地图
export interface SiteMap {
  pages: CollectedPage[];
  entryUrl: string;
  collectedAt: Date;
  totalAssets: number;
}

// Spider配置
export interface SpiderOptions {
  url: string;
  outputDir: string;
  maxPages?: number;
  followExternal?: boolean;
  proxy?: string;
  timeout?: number;
  userAgent?: string;
  headless?: boolean;
  progressFile?: string;  // 进度文件路径
  asyncMode?: boolean;    // 异步模式：HTML采集后立即返回，资源后台下载
  startProxyServer?: boolean;  // 是否启动本地预览服务器
  proxyPort?: number;     // 预览服务器端口
}

// Spider进度
export interface SpiderProgress {
  status: 'running' | 'completed' | 'failed' | 'idle';
  url: string;
  outputDir: string;
  total: number;
  current: number;
  currentPage: string;
  collectedUrls: string[];
  errors: string[];
  startedAt: string;
  updatedAt: string;
  error?: string;
}

// 内部状态
export interface SpiderState {
  visited: Set<string>;
  pending: string[];
  context: any; // BrowserContext
}
