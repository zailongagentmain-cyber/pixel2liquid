# Pixel2Liquid MVP 实现方案

## 技术选型

### 核心栈（生态契合）
| 组件 | 技术 | 原因 |
|------|------|------|
| 语言 | Node.js 20+ / TypeScript | Shopify生态契合 |
| 包管理 | pnpm | 快，Shopify CLI使用 |
| CLI框架 | Commander.js | 轻量，主流 |
| 测试 | Vitest | 快，ESM支持 |
| 类型 | TypeScript | 类型安全 |

### 采集模块
| 组件 | 技术 | 原因 |
|------|------|------|
| 浏览器 | Playwright | 反检测强，官方维护 |
| 反检测 | @cloudscraper/puppeteer-extra-plugin-stealth | 反Cloudflare |
| HTML解析 | Cheerio | 快，轻量 |
| CSS提取 | PostCSS | AST解析 |
| 图片下载 | node-fetch + stream | 并行下载 |

### 转换模块
| 组件 | 技术 | 原因 |
|------|------|------|
| HTML→Liquid | AST + 正则 | 自研，无现成 |
| Liquid引擎 | LiquidJS | Shopify兼容 |
| Schema生成 | Zod | 类型验证 |
| 文件处理 | fs-extra | Promise化 |
| 路径处理 | upath | 跨平台 |

---

## 项目初始化

```bash
mkdir pixel2liquid && cd pixel2liquid
pnpm init
pnpm add -D typescript @types/node ts-node
pnpm add playwright @playwright/test
pnpm add cheerio css-tree postcss
pnpm add liquidjs zod
pnpm add commander fs-extra node-fetch
pnpm add -D vitest
```

---

## MVP验收标准

| 模块 | 指标 | 目标 |
|------|------|------|
| 采集 | 单页面完整度 | **100%**（像素级复制） |
| 采集 | 子页面完整度 | **100%**（所有相关页面） |
| 采集 | 样式完整度 | **100%**（CSS/字体/图片） |
| 采集 | 路径正确性 | **100%**（本地可访问） |
| 采集 | 成功率 | >70%（有防护网站） |
| 转换 | 结构保留 | >90% |
| 转换 | 可运行主题 | .liquid文件输出 |

---

## 采集模块 (Spider) v2 - 完整站点采集

### 设计目标

> **采集后的文件应能完全独立运行，无需网络访问，完整保留原始页面的视觉效果和结构**

### 目录结构
```
src/spider/
├── index.ts              # 入口
├── Spider.ts             # 主类
├── SiteCrawler.ts       # 站点爬虫（采集所有子页面）
├── PageCollector.ts       # 单页面采集
├── ContentExtractor.ts   # 内容提取
├── StaticRenderer.ts    # JS静态化渲染
├── AssetDownloader.ts    # 资源下载
├── PathResolver.ts       # 路径修复
├── CSSProcessor.ts      # CSS提取与合并
└── utils/
    ├── headers.ts        # 请求头生成
    └── delay.ts          # 随机延迟
```

### 核心类设计

```typescript
// src/spider/Spider.ts
export interface SpiderOptions {
  url: string;                    // 起始URL
  outputDir: string;              // 输出目录
  maxPages?: number;              // 最大采集页面数（默认50）
  followExternal?: boolean;       // 是否跟随外部链接（默认否）
  proxy?: string;                // 代理地址
  timeout?: number;               // 超时时间
  userAgent?: string;             // 自定义User-Agent
}

export interface CollectedPage {
  url: string;
  localPath: string;              // 本地保存路径
  html: string;                   // 完整HTML（含内联CSS/JS）
  css: CssBundle;                 // 合并后的CSS
  images: Asset[];                // 图片资源
  fonts: Asset[];                 // 字体资源
  js: Asset[];                    // JS资源
  links: string[];                // 页面内链接（待采集）
  metadata: PageMeta;              // 元数据
}

export interface SiteMap {
  pages: CollectedPage[];          // 所有采集的页面
  entryUrl: string;              // 入口URL
  collectedAt: Date;              // 采集时间
  totalAssets: number;            // 资源总数
}

export class Spider {
  constructor(private options: SpiderOptions) {}
  
  async crawl(): Promise<SiteMap> {
    // 1. 启动浏览器
    const browser = await this.launchBrowser();
    
    // 2. 初始化站点爬虫
    const crawler = new SiteCrawler(browser, this.options);
    
    // 3. 采集所有页面（递归跟随链接）
    const pages = await crawler.crawlAll();
    
    // 4. 处理每个页面的资源和样式
    for (const page of pages) {
      await this.processPage(page);
    }
    
    // 5. 生成站点地图
    const siteMap = {
      pages,
      entryUrl: this.options.url,
      collectedAt: new Date(),
      totalAssets: pages.reduce((sum, p) => 
        sum + p.images.length + p.fonts.length + p.js.length, 0)
    };
    
    await browser.close();
    return siteMap;
  }
  
  private async processPage(page: CollectedPage): Promise<void> {
    // 1. 提取和合并CSS
    const cssProcessor = new CSSProcessor(page.html);
    page.css = await cssProcessor.bundle();
    
    // 2. 静态化JS渲染内容
    const renderer = new StaticRenderer(page);
    await renderer.render();
    
    // 3. 下载所有资源
    const downloader = new AssetDownloader(page);
    await downloader.downloadAll();
    
    // 4. 修复路径
    const pathResolver = new PathResolver(page);
    pathResolver.resolve();
    
    // 5. 内联关键CSS和JS
    await this.inlineCriticalAssets(page);
  }
}
```

### 反检测实现

```typescript
// src/spider/StealthContext.ts
import stealth from '@cloudscraper/puppeteer-extra-plugin-stealth';

export function createStealthContext(browser: Browser) {
  // 使用 stealth 插件自动应用所有反检测
  const context = browser.createIncognitoBrowserContext();
  
  // 随机化视口
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
  ];
  
  return context;
}
```

### 内容提取

```typescript
// src/spider/ContentExtractor.ts
import * as cheerio from 'cheerio';

export interface ExtractedContent {
  html: string;
  inlineStyles: string[];
  externalStyles: { url: string; content: string }[];
  scripts: { url: string; content: string }[];
  images: { src: string; alt: string; width?: number; height?: number }[];
}

export function extractContent(html: string, baseUrl: string): ExtractedContent {
  const $ = cheerio.load(html);
  
  // 移除script标签内容（保留src引用）
  $('script').each((_, el) => {
    const src = $(el).attr('src');
    if (!src) $(el).remove();
  });
  
  // 收集内联样式
  const inlineStyles = $('style').map((_, el) => $(el).html()).get();
  
  // 收集外部样式
  const externalStyles = $('link[rel="stylesheet"]').map((_, el) => ({
    url: $(el).attr('href'),
    content: '' // 后续下载
  })).get();
  
  // 收集图片
  const images = $('img').map((_, el) => ({
    src: resolveUrl($(el).attr('src'), baseUrl),
    alt: $(el).attr('alt') || '',
    width: $(el).attr('width'),
    height: $(el).attr('height')
  })).get();
  
  return { html: $.html(), inlineStyles, externalStyles, scripts: [], images };
}
```

### 站点爬虫（子页面采集）

```typescript
// src/spider/SiteCrawler.ts

export class SiteCrawler {
  private visited = new Set<string>();
  private pending: string[] = [];
  private browser: Browser;
  private options: SpiderOptions;
  
  constructor(browser: Browser, options: SpiderOptions) {
    this.browser = browser;
    this.options = options;
    this.pending.push(options.url);
  }
  
  async crawlAll(): Promise<CollectedPage[]> {
    const pages: CollectedPage[] = [];
    
    while (this.pending.length > 0) {
      // 检查是否达到最大页面数
      if (pages.length >= (this.options.maxPages || 50)) {
        break;
      }
      
      const url = this.pending.shift()!;
      
      // 跳过已访问的URL
      if (this.visited.has(url)) continue;
      this.visited.add(url);
      
      // 采集页面
      const page = await this.crawlPage(url);
      if (page) {
        pages.push(page);
        
        // 收集待采集链接
        const newLinks = this.extractLinks(page);
        for (const link of newLinks) {
          if (!this.visited.has(link)) {
            this.pending.push(link);
          }
        }
      }
    }
    
    return pages;
  }
  
  private extractLinks(page: CollectedPage): string[] {
    const $ = cheerio.load(page.html);
    const links: string[] = [];
    
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      
      // 只处理站内链接
      const fullUrl = this.resolveUrl(href);
      if (this.isInternalUrl(fullUrl)) {
        links.push(fullUrl);
      }
    });
    
    return [...new Set(links)]; // 去重
  }
  
  private isInternalUrl(url: string): boolean {
    if (this.options.followExternal) return true;
    
    try {
      const parsed = new URL(url);
      const base = new URL(this.options.url);
      return parsed.hostname === base.hostname;
    } catch {
      return false;
    }
  }
}
```

### JS静态化渲染

```typescript
// src/spider/StaticRenderer.ts

export class StaticRenderer {
  constructor(private page: CollectedPage) {}
  
  async render(): Promise<void> {
    // 对于单页应用(SPA)，等待JS执行完成后再提取HTML
    // 使用Playwright等待网络空闲
    
    // 1. 注入等待脚本，确保所有动态内容渲染完成
    await this.waitForDynamicContent();
    
    // 2. 捕获AJAX/Fetch填充的数据
    await this.captureAjaxData();
    
    // 3. 获取渲染后的完整HTML
    this.page.html = await this.getRenderedHTML();
  }
  
  private async waitForDynamicContent(): Promise<void> {
    // 等待条件：
    // 1. 网络空闲（无进行中的请求）
    // 2. 无加载中的资源
    // 3. 可选：等待特定元素出现
  }
}
```

### CSS处理与合并

```typescript
// src/spider/CSSProcessor.ts

export interface CssBundle {
  all: string;                    // 合并后的完整CSS
  inline: string;                 // 内联样式
  external: string[];              // 外部样式
  critical: string;                // 关键CSS（首屏用）
  nonCritical: string;             // 非关键CSS（异步加载）
}

export class CSSProcessor {
  constructor(private html: string) {}
  
  async bundle(): Promise<CssBundle> {
    const $ = cheerio.load(this.html);
    
    // 1. 收集所有CSS（内联+外部）
    const allCss: string[] = [];
    
    // 内联样式
    $('style').each((_, el) => {
      allCss.push($(el).html() || '');
    });
    
    // 外部样式（已下载）
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.endsWith('.css')) {
        // 读取已下载的CSS文件
        const css = await this.readCssFile(href);
        if (css) allCss.push(css);
      }
    });
    
    // 2. 合并所有CSS
    const mergedCss = this.mergeCss(allCss);
    
    // 3. 提取关键CSS（首屏渲染所需）
    const critical = this.extractCriticalCss(mergedCss);
    
    // 4. 分离非关键CSS
    const nonCritical = this.extractNonCritical(mergedCss);
    
    return {
      all: mergedCss,
      inline: $('style').map((_, el) => $(el).html()).get().join('\n'),
      external: [],
      critical,
      nonCritical
    };
  }
  
  private mergeCss(styles: string[]): string {
    // 使用PostCSS解析并合并
    const root = postcss.parse(styles.join('\n'));
    // 去重、合并重复规则
    return postcss.stringify(root);
  }
}
```

### 路径修复

```typescript
// src/spider/PathResolver.ts

export class PathResolver {
  constructor(private page: CollectedPage) {}
  
  resolve(): void {
    const $ = cheerio.load(this.page.html);
    const baseUrl = this.page.url;
    
    // 1. 修复图片路径
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        $(el).attr('src', this.resolveAssetPath(src));
      }
    });
    
    // 2. 修复CSS路径
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.endsWith('.css')) {
        $(el).attr('href', this.resolveAssetPath(href));
      }
    });
    
    // 3. 修复JS路径
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        $(el).attr('src', this.resolveAssetPath(src));
      }
    });
    
    // 4. 修复href链接
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && this.isInternalLink(href)) {
        // 子页面链接转为本地相对路径
        $(el).attr('href', this.resolvePagePath(href));
      }
    });
    
    this.page.html = $.html();
  }
  
  private resolveAssetPath(src: string): string {
    if (src.startsWith('http')) {
      // 外部资源：保持绝对路径（需网络）
      return src;
    }
    if (src.startsWith('//')) {
      return 'https:' + src;
    }
    if (src.startsWith('/')) {
      // 本地资源：转为相对于输出目录的路径
      return `/assets${src}`;
    }
    return src;
  }
}
```

### 资源下载

```typescript
// src/spider/AssetDownloader.ts
import fetch from 'node-fetch';
import * as fs from 'fs-extra';
import * as path from 'path';
import { pipeline } from 'stream/promises';

export interface Asset {
  url: string;
  localPath: string;
  type: 'image' | 'font' | 'js' | 'css';
  size?: number;
  mimeType?: string;
}

export class AssetDownloader {
  private assets: Asset[] = [];
  private concurrency = 5; // 并发限制
  
  constructor(
    private page: CollectedPage,
    private outputDir: string
  ) {}
  
  async downloadAll(): Promise<Asset[]> {
    await fs.ensureDir(path.join(this.outputDir, 'assets'));
    await fs.ensureDir(path.join(this.outputDir, 'assets/images'));
    await fs.ensureDir(path.join(this.outputDir, 'assets/fonts'));
    await fs.ensureDir(path.join(this.outputDir, 'assets/js'));
    await fs.ensureDir(path.join(this.outputDir, 'assets/css'));
    
    // 收集所有资源URL
    const urls = this.collectAssetUrls();
    
    // 并发下载
    const chunks = this.chunkArray(urls, this.concurrency);
    for (const chunk of chunks) {
      await Promise.all(chunk.map(url => this.downloadAsset(url)));
    }
    
    return this.assets;
  }
  
  private collectAssetUrls(): string[] {
    const urls = new Set<string>();
    const $ = cheerio.load(this.page.html);
    
    // 图片
    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) urls.add(src);
    });
    
    // CSS
    $('link[rel="stylesheet"][href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) urls.add(href);
    });
    
    // JS
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) urls.add(src);
    });
    
    // 字体
    // ... 提取 @font-face 中的URL
    
    return Array.from(urls);
  }
  
  private async downloadAsset(url: string): Promise<Asset | null> {
    if (!url || url.startsWith('data:')) return null;
    
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const buffer = await response.arrayBuffer();
      const filename = this.urlToFilename(url);
      
      // 根据URL类型决定保存目录
      let subdir = 'misc';
      if (url.includes('/images/') || this.isImageExt(url)) subdir = 'images';
      else if (url.includes('/fonts/') || this.isFontExt(url)) subdir = 'fonts';
      else if (url.endsWith('.css')) subdir = 'css';
      else if (url.endsWith('.js')) subdir = 'js';
      
      const localPath = path.join(this.outputDir, 'assets', subdir, filename);
      await fs.ensureDir(path.dirname(localPath));
      await fs.writeFile(localPath, Buffer.from(buffer));
      
      const asset: Asset = {
        url,
        localPath: `/assets/${subdir}/${filename}`,
        type: this.getAssetType(url),
        size: buffer.byteLength
      };
      
      this.assets.push(asset);
      return asset;
    } catch (error) {
      console.warn(`Failed to download: ${url}`);
      return null;
    }
  }
  
  private isImageExt(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|svg|webp|avif)$/i.test(url);
  }
  
  private isFontExt(url: string): boolean {
    return /\.(woff|woff2|ttf|otf|eot)$/i.test(url);
  }
  
  private getAssetType(url: string): Asset['type'] {
    if (this.isImageExt(url)) return 'image';
    if (this.isFontExt(url)) return 'font';
    if (url.endsWith('.css')) return 'css';
    if (url.endsWith('.js')) return 'js';
    return 'image';
  }
}
```

### CLI接口

```typescript
// src/spider/cli.ts
import { Command } from 'commander';
import { Spider } from './Spider';

export const spiderCommand = new Command('spider')
  .description('采集网页（含所有子页面）')
  .argument('<url>', '目标URL')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-p, --proxy <proxy>', '代理地址')
  .option('-m, --max-pages <number>', '最大采集页面数', '50')
  .option('--follow-external', '跟随外部链接（默认否）')
  .option('--no-headless', '显示浏览器窗口')
  .action(async (url, options) => {
    const spider = new Spider({
      url,
      outputDir: options.output,
      proxy: options.proxy,
      maxPages: parseInt(options.maxPages),
      followExternal: options.followExternal
    });
    
    console.log(`🔍 开始采集: ${url}`);
    console.log(`📦 最大页面数: ${options.maxPages}`);
    
    const siteMap = await spider.crawl();
    
    console.log(`\n✅ 采集完成!`);
    console.log(`📄 采集页面: ${siteMap.pages.length}`);
    console.log(`🎨 CSS: ${siteMap.totalAssets} 个资源`);
    console.log(`📁 输出目录: ${options.output}`);
    
    // 输出站点地图
    console.log(`\n📋 页面列表:`);
    siteMap.pages.forEach((page, i) => {
      console.log(`  ${i + 1}. ${page.url} -> ${page.localPath}`);
    });
  });
```

---

## 转换模块 (Transformer) v2 - 可扩展架构

### 设计原则

| 原则 | 说明 |
|------|------|
| **模块化** | 每个电商元素独立Section，可单独编辑 |
| **可扩展** | 支持新增Element类型和Block |
| **拖拽友好** | Schema设计支持拖拽排序 |
| **生态契合** | 完全兼容Shopify Section/Block架构 |
| **内容与样式分离** | 支持从不同来源组合元素和样式 |
| **元素可复用** | 分解后的元素存入Element Library |

### 目录结构
```
src/transformer/
├── index.ts              # 入口
├── Transformer.ts        # 主类
├── HTMLToLiquid.ts       # HTML→Liquid转换
├── StyleProcessor.ts     # 样式处理
├── SchemaBuilder.ts      # Shopify Schema生成器
├── ElementRegistry.ts    # 电商元素注册表
├── blocks/
│   ├── Block.ts          # Block基类
│   ├── Banner.ts          # Banner元素
│   ├── Logo.ts            # Logo元素
│   ├── Product.ts         # Product元素
│   ├── Category.ts        # Category元素
│   ├── RichText.ts       # 富文本元素
│   ├── Image.ts          # 图片元素
│   ├── Video.ts          # 视频元素
│   └── Custom.ts         # 自定义元素
└── utils/
    ├── dom.ts
    ├── liquid.ts
    └── schema.ts

### 元素库与模板混合系统

#### 核心概念

```
┌─────────────────────────────────────────────────────────────┐
│                    Pixel2Liquid 元素系统                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   采集结果A            采集结果B            采集结果C          │
│   (样式参考)          (内容来源)          (更多元素)         │
│       │                   │                   │             │
│       ▼                   ▼                   ▼             │
│   ┌─────────┐        ┌─────────┐        ┌─────────┐        │
│   │样式属性 │        │电商元素 │        │更多元素 │        │
│   │(Colors │        │(Products│        │(Footer │        │
│   │Fonts   │        │Categories│        │Header │        │
│   │Spacing│        │Banners) │        │etc)   │        │
│   │Layout)│        │         │        │        │        │
│   └────┬────┘        └────┬────┘        └────┬────┘        │
│        │                   │                   │             │
│        └───────────────────┼───────────────────┘             │
│                           ▼                               │
│                 ┌─────────────────────┐                    │
│                 │   元素库 (Library)   │                    │
│                 │  ┌───────────────┐  │                    │
│                 │  │ Header Style  │  │                    │
│                 │  │ Product Card │  │                    │
│                 │  │ Banner Style  │  │                    │
│                 │  │ Footer Style  │  │                    │
│                 │  └───────────────┘  │                    │
│                 └──────────┬──────────┘                    │
│                            │                               │
│                            ▼                               │
│                 ┌─────────────────────┐                    │
│                 │   转换引擎          │                    │
│                 │  用户指定:           │                    │
│                 │  - 样式来源: A     │                    │
│                 │  - 内容来源: B     │                    │
│                 │  - 额外元素: C     │                    │
│                 └──────────┬──────────┘                    │
│                            │                               │
│                            ▼                               │
│                 ┌─────────────────────┐                    │
│                 │   混合结果         │                    │
│                 │  样式:A + 内容:B   │                    │
│                 │  最终Shopify主题   │                    │
│                 └─────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

#### 元素分解器

```typescript
// src/transformer/ElementExtractor.ts

export interface ExtractedElement {
  id: string;              // 唯一ID
  type: ElementType;      // 元素类型
  name: string;           // 元素名称
  html: string;          // 原始HTML
  css: string;           // 相关CSS
  js?: string;           // 相关JS
  children: ExtractedElement[];  // 子元素
  parent?: string;        // 父元素ID
  metadata: {
    selector?: string;   // CSS选择器
    styles?: string;      // 内联样式
    className?: string;   // 类名
  };
}

export type ElementType = 
  | 'header' | 'footer' | 'nav' | 'banner' | 'hero'
  | 'product' | 'product_grid' | 'product_card'
  | 'category' | 'category_grid' | 'category_card'
  | 'image' | 'image_with_text' | 'gallery'
  | 'video' | 'richtext' | 'testimonial'
  | 'logo_list' | 'social_links' | 'newsletter'
  | 'custom';

export class ElementExtractor {
  
  extract(page: CollectedPage): ExtractedElement[] {
    const $ = cheerio.load(page.html);
    const elements: ExtractedElement[] = [];
    
    // 1. 智能识别主要结构区域
    const sections = this.identifySections($);
    
    // 2. 递归分解每个区域
    for (const section of sections) {
      const element = this.decompose(section, $);
      elements.push(element);
    }
    
    // 3. 提取全局样式
    const globalStyles = this.extractGlobalStyles(page.css);
    
    return elements;
  }
  
  private identifySections($: cheerio.CheerioAPI): cheerio.Element[] {
    const sections: cheerio.Element[] = [];
    
    $('header, nav, [class*="header"], [class*="nav"]').each((_, el) => sections.push(el));
    $('[class*="hero"], [class*="banner"], [class*="slider"]').each((_, el) => sections.push(el));
    $('[class*="product"], [class*="shop"], [class*="catalog"]').each((_, el) => sections.push(el));
    
    return sections;
  }
}
```

#### 元素库 (Element Library)

```typescript
// src/transformer/ElementLibrary.ts

export interface LibraryElement {
  id: string;
  type: ElementType;
  name: string;
  description: string;
  
  content?: {
    text?: string;
    image?: string;
    link?: string;
    data?: any;
  };
  
  style?: {
    css: string;
    variables?: Record<string, string>;
    theme?: string;
  };
  
  ecommerce?: {
    productId?: string;
    collectionId?: string;
    variantId?: string;
  };
  
  source: {
    url: string;
    page: string;
    extractedAt: Date;
  };
}

export class ElementLibrary {
  private elements: Map<string, LibraryElement> = new Map();
  
  add(element: LibraryElement): void {
    this.elements.set(element.id, element);
  }
  
  getByType(type: ElementType): LibraryElement[] {
    return Array.from(this.elements.values()).filter(el => el.type === type);
  }
  
  getStyles(themeId: string): LibraryElement | undefined {
    return Array.from(this.elements.values()).find(el => el.style?.theme === themeId);
  }
  
  export(): string {
    return JSON.stringify(Array.from(this.elements.values()), null, 2);
  }
  
  import(json: string): void {
    const elements = JSON.parse(json) as LibraryElement[];
    elements.forEach(el => this.add(el));
  }
}
```

#### 模板混合器 (Template Mixer)

```typescript
// src/transformer/TemplateMixer.ts

export interface MixingConfig {
  styleSource: {
    libraryId: string;
    elements: string[];
  };
  
  contentSource: {
    libraryId: string;
    elements: string[];
  };
  
  additionalElements?: {
    libraryId: string;
    elements: string[];
  };
  
  replacements?: {
    [originalId: string]: string;
  };
}

export class TemplateMixer {
  
  mix(config: MixingConfig, library: ElementLibrary): MixedTemplate {
    const result: MixedTemplate = {
      sections: [],
      globalCss: '',
      assets: []
    };
    
    const styleElements = this.collectStyles(config.styleSource, library);
    result.globalCss = this.mergeStyles(styleElements);
    
    const contentElements = this.collectContent(config.contentSource, library);
    const replacedElements = this.applyReplacements(contentElements, config.replacements);
    result.sections = this.assembleSections(replacedElements);
    
    return result;
  }
  
  private collectStyles(config: MixingConfig['styleSource'], library: ElementLibrary): LibraryElement[] {
    const elements: LibraryElement[] = [];
    for (const elementId of config.elements) {
      const element = library.get(elementId);
      if (element?.style) elements.push(element);
    }
    return elements;
  }
  
  private mergeStyles(elements: LibraryElement[]): string {
    const cssVars: Record<string, string> = {};
    const cssRules: string[] = [];
    
    for (const el of elements) {
      if (el.style?.variables) Object.assign(cssVars, el.style.variables);
      if (el.style?.css) cssRules.push(el.style.css);
    }
    
    const varSection = ':root {\n' + 
      Object.entries(cssVars).map(([k, v]) => `  ${k}: ${v};`).join('\n') + 
      '\n}';
    
    return varSection + '\n' + cssRules.join('\n');
  }
}
```

#### 使用示例

```bash
# 采集多个站点
pixel2liquid spider https://site-a.com -o ./collection/site-a
pixel2liquid spider https://site-b.com -o ./collection/site-b

# 提取元素到库
pixel2liquid extract ./collection/site-a -o ./library
pixel2liquid extract ./collection/site-b -o ./library

# 混合元素
pixel2liquid mix \
  --style-source header-styles,product-card-styles \
  --content-source banner-with-text,product-grid \
  -o ./final-theme

# 交互式混合
pixel2liquid mix --interactive
```

### 核心类设计

```typescript
// src/transformer/Transformer.ts
export interface TransformOptions {
  themeName: string;
  enableDragDrop: boolean;      // 启用拖拽编辑
  enableEcommerceElements: boolean; // 启用电商元素
  customElements?: ElementDefinition[]; // 自定义元素
}

export interface TransformResult {
  themeDir: string;
  sections: Section[];
  blocks: Map<string, Block[]>;  // block库
  config: ThemeConfig;
  pageLayout: PageLayout;         // 页面布局配置
}

export class Transformer {
  constructor(
    private collected: CollectedPage,
    private options: TransformOptions
  ) {
    // 初始化元素注册表
    this.registry = new ElementRegistry(options);
  }
  
  async transform(): Promise<TransformResult> {
    // 1. 分析页面结构，识别可转换区域
    const zones = this.analyzeZones();
    
    // 2. 为每个区域匹配电商元素
    const elements = this.matchElements(zones);
    
    // 3. 生成Section和Block
    const sections = await this.buildSections(elements);
    
    // 4. 生成页面布局（JSON模板）
    const layout = await this.buildPageLayout(sections);
    
    return { sections, blocks, config, layout };
  }
}
```

### 电商元素注册表

```typescript
// src/transformer/ElementRegistry.ts

// 预定义电商元素
export const ECOMMERC_ELEMENTS = {
  banner: {
    type: 'banner',
    name: 'Banner / Hero',
    icon: '🖼️',
    defaultBlocks: ['image', 'heading', 'subheading', 'button', 'text'],
    schema: {
      settings: [
        { id: 'image', type: 'image', label: 'Image' },
        { id: 'heading', type: 'text', label: 'Heading' },
        { id: 'subheading', type: 'text', label: 'Subheading' },
        { id: 'text_align', type: 'select', options: ['left', 'center', 'right'] },
        { id: 'full_width', type: 'checkbox', label: 'Full width' },
      ]
    }
  },
  
  logo: {
    type: 'logo',
    name: 'Logo List',
    icon: '🏢',
    defaultBlocks: ['logo_item'],
    schema: {
      max_blocks: 10,
      settings: [
        { id: 'title', type: 'text', label: 'Section Title' },
        { id: 'layout', type: 'select', options: ['grid', 'carousel'] },
      ]
    }
  },
  
  product: {
    type: 'product',
    name: 'Product Grid',
    icon: '📦',
    defaultBlocks: ['product_card'],
    schema: {
      settings: [
        { id: 'title', type: 'text', label: 'Section Title' },
        { id: 'products_count', type: 'range', min: 1, max: 12 },
        { id: 'columns', type: 'range', min: 2, max: 5 },
        { id: 'show_vendor', type: 'checkbox' },
        { id: 'show_price', type: 'checkbox' },
      ]
    }
  },
  
  category: {
    type: 'category',
    name: 'Category / Collection',
    icon: '📂',
    defaultBlocks: ['category_card'],
    schema: {
      settings: [
        { id: 'title', type: 'text', label: 'Title' },
        { id: 'collection', type: 'collection' },
        { id: 'show_image', type: 'checkbox' },
        { id: 'show_description', type: 'checkbox' },
      ]
    }
  },
  
  richtext: {
    type: 'richtext',
    name: 'Rich Text',
    icon: '📝',
    defaultBlocks: [],
    schema: {
      settings: [
        { id: 'text', type: 'richtext', label: 'Content' },
        { id: 'alignment', type: 'select', options: ['left', 'center', 'right'] },
      ]
    }
  },
  
  image: {
    type: 'image',
    name: 'Image with Text',
    icon: '🖼️',
    defaultBlocks: ['image', 'text'],
    schema: {
      settings: [
        { id: 'image', type: 'image', label: 'Image' },
        { id: 'image_position', type: 'select', options: ['left', 'right'] },
        { id: 'text', type: 'richtext', label: 'Text' },
      ]
    }
  },
  
  video: {
    type: 'video',
    name: 'Video',
    icon: '🎬',
    defaultBlocks: [],
    schema: {
      settings: [
        { id: 'video_url', type: 'url', label: 'Video URL' },
        { id: 'cover_image', type: 'image', label: 'Cover Image' },
        { id: 'autoplay', type: 'checkbox' },
      ]
    }
  },
  
  testimonials: {
    type: 'testimonials',
    name: 'Testimonials',
    icon: '💬',
    defaultBlocks: ['testimonial'],
    schema: {
      max_blocks: 10,
      settings: [
        { id: 'title', type: 'text', label: 'Title' },
        { id: 'layout', type: 'select', options: ['grid', 'slider'] },
      ]
    }
  },
  
  footer: {
    type: 'footer',
    name: 'Footer',
    icon: '📋',
    defaultBlocks: ['link_list', 'text_column'],
    schema: {
      settings: [
        { id: 'show_logo', type: 'checkbox' },
        { id: 'show_social', type: 'checkbox' },
        { id: 'copyright', type: 'text', label: 'Copyright' },
      ]
    }
  },
  
  header: {
    type: 'header',
    name: 'Header / Navigation',
    icon: '📌',
    defaultBlocks: ['nav_item', 'header_action'],
    schema: {
      settings: [
        { id: 'logo', type: 'image', label: 'Logo' },
        { id: 'menu', type: 'link_list', label: 'Menu' },
        { id: 'sticky', type: 'checkbox', label: 'Sticky Header' },
      ]
    }
  }
};

// 元素注册表类
export class ElementRegistry {
  private elements: Map<string, ElementDefinition> = new Map();
  
  constructor(options: TransformOptions) {
    // 注册预定义元素
    Object.entries(ECOMMERCE_ELEMENTS).forEach(([key, element]) => {
      this.register(key, element);
    });
    
    // 注册自定义元素
    if (options.customElements) {
      options.customElements.forEach(el => this.register(el.type, el));
    }
  }
  
  register(type: string, definition: ElementDefinition) {
    this.elements.set(type, definition);
  }
  
  get(type: string): ElementDefinition | undefined {
    return this.elements.get(type);
  }
  
  list(): ElementDefinition[] {
    return Array.from(this.elements.values());
  }
}
```

### Block系统设计

```typescript
// src/transformer/blocks/Block.ts

export interface BlockDefinition {
  type: string;
  name: string;
  settings: SettingDefinition[];
  template: string;  // Liquid模板
}

export interface Block extends BlockDefinition {
  id: string;
  settings: Record<string, any>;
}

// Block基类
export abstract class BaseBlock implements BlockDefinition {
  abstract type: string;
  abstract name: string;
  abstract settings: SettingDefinition[];
  abstract template: string;
  
  render(settings: Record<string, any>): string {
    return this.compileTemplate(settings);
  }
  
  protected compileTemplate(settings: Record<string, any>): string {
    // 简单模板编译
    return this.template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return settings[key] ?? `{{ block.settings.${key} }}`;
    });
  }
}
```

### 具体Block实现

```typescript
// src/transformer/blocks/ProductCard.ts

export class ProductCardBlock extends BaseBlock {
  type = 'product_card';
  name = 'Product Card';
  
  settings: SettingDefinition[] = [
    { id: 'product', type: 'product', label: 'Product' },
    { id: 'show_image', type: 'checkbox', default: true },
    { id: 'show_title', type: 'checkbox', default: true },
    { id: 'show_vendor', type: 'checkbox', default: false },
    { id: 'show_price', type: 'checkbox', default: true },
    { id: 'show_button', type: 'checkbox', default: true },
  ];
  
  template = `
<div class="product-card">
  {% if block.settings.show_image and product.featured_image %}
    <img src="{{ product.featured_image | image_url: '400x' }}" 
         alt="{{ product.title }}" />
  {% endif %}
  
  {% if block.settings.show_title %}
    <h3>{{ product.title }}</h3>
  {% endif %}
  
  {% if block.settings.show_vendor %}
    <p class="vendor">{{ product.vendor }}</p>
  {% endif %}
  
  {% if block.settings.show_price %}
    <p class="price">{{ product.price | money }}</p>
  {% endif %}
  
  {% if block.settings.show_button %}
    <a href="{{ product.url }}" class="btn">View Product</a>
  {% endif %}
</div>
`;
}

// src/transformer/blocks/LogoItem.ts

export class LogoItemBlock extends BaseBlock {
  type = 'logo_item';
  name = 'Logo';
  
  settings: SettingDefinition[] = [
    { id: 'image', type: 'image', label: 'Logo Image' },
    { id: 'link', type: 'url', label: 'Link' },
    { id: 'alt', type: 'text', label: 'Alt Text' },
  ];
  
  template = `
<div class="logo-item">
  {% if block.settings.link %}
    <a href="{{ block.settings.link }}">
  {% endif %}
  
  <img src="{{ block.settings.image | image_url: '200x' }}" 
       alt="{{ block.settings.alt }}" />
  
  {% if block.settings.link %}
    </a>
  {% endif %}
</div>
`;
}
```

### Section生成器

```typescript
// src/transformer/SchemaBuilder.ts

export interface SectionDefinition {
  name: string;
  type: string;  // 对应 ElementRegistry 中的 type
  settings: SettingDefinition[];
  blocks?: BlockDefinition[];
  maxBlocks?: number;
  presets?: Preset[];
}

export function buildSection(element: ElementDefinition, options: TransformOptions): string {
  const schema = {
    name: element.name,
    tag: 'section',
    class: `section-${element.type}`,
    settings: element.settings.map(s => convertSetting(s)),
    blocks: element.defaultBlocks?.map(blockType => ({
      type: blockType,
      name: blockType.replace('_', ' ').toUpperCase(),
      settings: []
    })),
    max_blocks: element.maxBlocks || 50,
  };
  
  return `
{% schema %}
${JSON.stringify(schema, null, 2)}
{% endschema %}

${element.template}
`;
}

// 转换设置类型
function convertSetting(setting: SettingDefinition) {
  const map: Record<string, string> = {
    'text': 'text',
    'image': 'image_picker',
    'checkbox': 'checkbox',
    'select': 'select',
    'url': 'url',
    'range': 'range',
    'richtext': 'richtext',
    'product': 'product',
    'collection': 'collection',
    'link_list': 'link_list',
  };
  
  return {
    type: map[setting.type] || 'text',
    id: setting.id,
    label: setting.label,
    default: setting.default
  };
}
```

### 页面布局（JSON模板）

```typescript
// src/transformer/PageLayout.ts

export interface PageLayout {
  sections: SectionInstance[];
}

export interface SectionInstance {
  type: string;
  settings: Record<string, any>;
  blocks?: BlockInstance[];
}

export function buildPageLayout(sections: Section[]): PageLayout {
  return {
    sections: sections.map(section => ({
      type: section.type,
      settings: section.defaultSettings || {},
      blocks: section.blocks?.map(block => ({
        type: block.type,
        settings: block.defaultSettings || {}
      }))
    }))
  };
}

// 生成JSON模板文件
export async function generateJSONTemplate(layout: PageLayout, outputDir: string) {
  const template = {
    name: 'Main',
    sections: layout.sections,
    order: layout.sections.map(s => s.type)
  };
  
  await fs.writeJson(
    path.join(outputDir, 'templates/page.json'),
    template,
    { spaces: 2 }
  );
}
```

### HTML→Liquid 转换策略（增强版）

```typescript
// src/transformer/HTMLToLiquid.ts

interface ConversionRule {
  pattern: RegExp;
  replacement: string | ConversionFn;
  element?: string;  // 关联的电商元素类型
  priority: number;
}

type ConversionFn = (match: string, ...args: string[]) => string;

export class HTMLToLiquid {
  
  private rules: ConversionRule[] = [
    // 1. Hero/Banner 区域识别
    {
      pattern: /<header[^>]*class="[^"]*hero[^"]*"[^>]*>.*?<\/header>/is,
      replacement: '<section id="hero">{{ section.content }}</section>',
      element: 'banner',
      priority: 1
    },
    
    // 2. Logo列表识别
    {
      pattern: /<div[^>]*class="[^"]*logos?[^"]*"[^>]*>.*?<\/div>/is,
      replacement: '<section id="logo-list">{{ section.content }}</section>',
      element: 'logo',
      priority: 2
    },
    
    // 3. 产品网格识别
    {
      pattern: /<div[^>]*class="[^"]*product[s]?[^"]*"[^>]*>.*?<\/div>/is,
      replacement: '<section id="product-grid">{{ section.content }}</section>',
      element: 'product',
      priority: 3
    },
    
    // 4. 分类/集合识别
    {
      pattern: /<div[^>]*class="[^"]*categor(?:y|ies)[^"]*"[^>]*>.*?<\/div>/is,
      replacement: '<section id="category-grid">{{ section.content }}</section>',
      element: 'category',
      priority: 4
    },
    
    // 5. 富文本识别
    {
      pattern: /<div[^>]*class="[^"]*rich-text[^"]*"[^>]*>.*?<\/div>/is,
      replacement: '<section id="rich-text">{{ section.content }}</section>',
      element: 'richtext',
      priority: 5
    },
    
    // 6. 图片+文字识别
    {
      pattern: /<div[^>]*class="[^"]*image-text[^"]*"[^>]*>.*?<\/div>/is,
      replacement: '<section id="image-with-text">{{ section.content }}</section>',
      element: 'image',
      priority: 6
    },
    
    // 7. 页脚识别
    {
      pattern: /<footer[^>]*>.*?<\/footer>/is,
      replacement: '{% section "footer" %}',
      element: 'footer',
      priority: 7
    },
    
    // 8. 导航识别
    {
      pattern: /<nav[^>]*>.*?<\/nav>/is,
      replacement: '{% section "header" %}',
      element: 'header',
      priority: 8
    },
    
    // 9. 通用元素转换
    ...BASIC_RULES  // 基础规则（见原设计）
  ];
  
  convert(html: string, zone: HTMLElement): ConversionResult {
    const detected: DetectedElement[] = [];
    let result = html;
    
    // 按优先级排序处理
    const sortedRules = this.rules.sort((a, b) => a.priority - b.priority);
    
    for (const rule of sortedRules) {
      if (rule.element) {
        // 识别为电商元素
        const match = result.match(rule.pattern);
        if (match) {
          detected.push({
            type: rule.element,
            original: match[0],
            converted: this.applyReplacement(rule, match[0])
          });
        }
      }
      result = result.replace(rule.pattern, rule.replacement);
    }
    
    return { html: result, detected };
  }
}
```

### Schema生成示例

```typescript
// 生成完整的Section文件示例

// sections/banner.liquid
{% comment %}
  Banner / Hero Section
  Type: {{ 'sections.banner' | t }}
{% endcomment %}

<section id="{{ section.id }}" 
         class="section-banner"
         style="--banner-height: {{ section.settings.height | default: '600px' }}">
  
  <div class="banner-content" 
       style="text-align: {{ section.settings.text_align | default: 'center' }}">
    
    {% if section.settings.image %}
      <img src="{{ section.settings.image | image_url: '1920x' }}"
           alt="{{ section.settings.image.alt | default: '' }}"
           loading="lazy" />
    {% endif %}
    
    <div class="banner-overlay"></div>
    
    <div class="banner-text">
      <h1>{{ section.settings.heading }}</h1>
      <p>{{ section.settings.subheading }}</p>
      
      {% if section.settings.button_text %}
        <a href="{{ section.settings.button_link | default: '#' }}"
           class="btn">
          {{ section.settings.button_text }}
        </a>
      {% endif %}
    </div>
  </div>
</section>

{% schema %}
{
  "name": "Banner",
  "tag": "section",
  "class": "section-banner",
  "settings": [
    {
      "type": "image_picker",
      "id": "image",
      "label": "Background Image"
    },
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Welcome"
    },
    {
      "type": "text",
      "id": "subheading", 
      "label": "Subheading",
      "default": "Discover our products"
    },
    {
      "type": "text",
      "id": "button_text",
      "label": "Button Text"
    },
    {
      "type": "url",
      "id": "button_link",
      "label": "Button Link"
    },
    {
      "type": "select",
      "id": "text_align",
      "label": "Text Alignment",
      "options": [
        { "value": "left", "label": "Left" },
        { "value": "center", "label": "Center" },
        { "value": "right", "label": "Right" }
      ]
    }
  ],
  "presets": [
    {
      "name": "Default",
      "settings": {
        "heading": "Welcome",
        "text_align": "center"
      }
    },
    {
      "name": "Full Width",
      "settings": {
        "heading": "Welcome",
        "full_width": true
      }
    }
  ]
}
{% endschema %}
```

### 主题结构生成

```typescript
// src/transformer/ThemeBuilder.ts
import * as fs from 'fs-extra';
import * as path from 'path';

export async function createThemeStructure(name: string, outputDir: string): Promise<void> {
  const themeDir = path.join(outputDir, name);
  
  const structure = {
    'layout/theme.liquid': generateLayout(),
    'sections/': [],
    'templates/page.json': generatePageTemplate(),
    'assets/base.css': '',
    'assets/theme.js': '',
    'config/settings_schema.json': '[]',
    'config/settings_data.json': '{}',
    'locales/en.default.json': '{}',
  };
  
  for (const [filePath, content] of Object.entries(structure)) {
    const fullPath = path.join(themeDir, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    if (typeof content === 'string') {
      await fs.writeFile(fullPath, content);
    }
  }
}
```

### CLI接口

```typescript
// src/transformer/cli.ts
import { Command } from 'commander';
import { Transformer } from './Transformer';

export const transformCommand = new Command('transform')
  .description('转换采集内容为Shopify主题')
  .argument('<inputDir>', '采集内容目录')
  .option('-o, --output <dir>', '输出目录', './theme')
  .option('-n, --name <name>', '主题名称', 'pixel-theme')
  .option('--no-schema', '不生成配置schema')
  .action(async (inputDir, options) => {
    const transformer = new Transformer(inputDir, {
      themeName: options.name,
      generateSchema: options.schema !== false,
      includeSections: true
    });
    
    console.log(`🔄 开始转换...`);
    const result = await transformer.transform();
    
    console.log(`✅ 转换完成!`);
    console.log(`📁 主题目录: ${result.themeDir}`);
    console.log(`📦 Sections: ${result.sections.length}`);
  });
```

---

## 主CLI入口

```typescript
// src/cli.ts
import { Command } from 'commander';
import { spiderCommand } from './spider/cli';
import { transformCommand } from './transformer/cli';
import { pushCommand } from './cli/shopify-push';

const program = new Command();

program
  .name('pixel2liquid')
  .description('将网站像素级克隆为Shopify Liquid主题')
  .version('0.1.0');

program.addCommand(spiderCommand);
program.addCommand(transformCommand);
program.addCommand(pushCommand);

program.parse();
```

### 使用示例

```bash
# 1. 采集网页（含所有子页面）
pixel2liquid spider https://example.com -o ./output

# 2. 采集指定页面数（不跟随外部链接）
pixel2liquid spider https://example.com -o ./output -m 20

# 3. 转换为主题
pixel2liquid transform ./output -n my-theme -o ./theme

# 4. 推送到Shopify
pixel2liquid push ./theme --store my-store.myshopify.com --token xxx
```

---

## 开发计划

### Week 1: 采集模块
- [ ] 项目初始化
- [ ] Playwright集成
- [ ] 单页面采集
- [ ] 子页面爬虫（递归跟随链接）
- [ ] 资源下载（图片/CSS/JS/字体）
- [ ] 路径修复

### Week 2: 采集模块增强
- [ ] CSS提取与合并
- [ ] JS静态化渲染
- [ ] 反检测优化
- [ ] 站点地图生成

### Week 3: 转换模块
- [ ] HTML→Liquid转换
- [ ] CSS处理
- [ ] Schema生成
- [ ] 主题结构生成
- [ ] 电商元素支持

### Week 4: Shopify集成
- [ ] Shopify CLI集成
- [ ] theme push
- [ ] theme check
- [ ] 基础测试

### Week 5: 优化&发布
- [ ] 错误处理
- [ ] 日志系统
- [ ] README文档
- [ ] NPM发布

---

## 文件清单

```
pixel2liquid/
├── src/
│   ├── cli.ts                    # CLI入口
│   ├── spider/
│   │   ├── index.ts
│   │   ├── Spider.ts
│   │   ├── StealthContext.ts
│   │   ├── ContentExtractor.ts
│   │   ├── AssetDownloader.ts
│   │   └── utils/
│   ├── transformer/
│   │   ├── index.ts
│   │   ├── Transformer.ts
│   │   ├── HTMLToLiquid.ts
│   │   ├── StyleProcessor.ts
│   │   ├── SchemaBuilder.ts
│   │   └── ThemeBuilder.ts
│   └── cli/
│       └── shopify-push.ts
├── tests/
│   ├── spider.test.ts
│   └── transformer.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

*最后更新: 2026-03-24*
