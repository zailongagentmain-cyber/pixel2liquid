# Pixel2Liquid - 网站像素级克隆到Shopify主题

## 项目概述

### 核心价值
将任意网站像素级复制并转换为Shopify Liquid主题，支持拖拽配置页面内容

### 目标用户
- Shopify独立站卖家
- 主题开发者
- 想要快速克隆参考网站的设计师

---

## 功能规划

### Phase 1: HTML采集与分析
- [ ] 单页面完整采集（HTML/CSS/JS/图片/字体）
- [ ] 子页面采集（跟随站内链接，采集所有相关页面）
- [ ] 页面结构解析（DOM树保留）
- [ ] CSS样式提取与合并（内联+外部+优先级）
- [ ] 响应式规则识别（media query保留）
- [ ] 静态化处理（JS渲染内容→静态HTML）
- [ ] 路径修复（相对路径→绝对路径/本地路径）
- [ ] 站点地图生成（可选，用于大型站点）

### Phase 2: 自动化转换
- [ ] 页面元素分解（从采集结果中提取可复用元素）
- [ ] 元素库管理（Element Library存储分解后的元素）
- [ ] 参考模板选择（用户指定主题样式来源）
- [ ] 元素内容映射（内容与样式分离，灵活组合）
- [ ] HTML → Liquid模板转换
- [ ] CSS → Shopify资产文件
- [ ] 静态内容 → 可配置section/schema
- [ ] 图片资源 → Shopify CDN上传

### Phase 3: Shopify主题适配
- [ ] 生成标准的Shopify主题结构
- [ ] 创建可配置的section和block
- [ ] 生成theme_schema.json
- [ ] 输出可直接导入的.zip
- [ ] **Shopify CLI集成** - 通过CLI上传到Shopify
  - [ ] 验证Shopify Token
  - [ ] 主题文件推送
  - [ ] 进度显示

### Phase 4: 可视化配置后台
- [ ] 拖拽式页面编辑器
- [ ] 内容配置面板
- [ ] 预览功能
- [ ] 一键导出

---

## 技术架构

```
输入: 任意网站URL
  ↓
采集层: Playwright/Cheerio 抓取网页
  ↓
解析层: DOM结构 + CSS分析
  ↓
转换层: HTML→Liquid + 内容识别
  ↓
适配层: Shopify主题结构生成
  ↓
输出: Shopify可导入主题.zip
  ↓
可选: Shopify CLI直接推送（需Token）
```

---

## 核心模块

### 1. PageSpider (采集模块)
- 功能：抓取完整网页资源
- 技术：Playwright + Cheerio

### 2. StyleAnalyzer (样式分析)
- 功能：提取、合并、去重CSS
- 技术：PostCSS + CSSTree

### 3. LiquidTransformer (转换引擎)
- 功能：HTML → Liquid语法转换
- 技术：AST解析 + 模板引擎

### 4. SectionBuilder (主题构建)
- 功能：生成Shopify section/schema
- 技术：Shopify Theme Kit

### 5. ConfigEditor (配置编辑器)
- 功能：可视化配置页面内容
- 技术：React + DnD Kit

### 6. ShopifyUploader (Shopify上传)
- 功能：通过Shopify CLI上传主题
- 技术：Shopify CLI + Node.js child_process
- 配置项：
  - Store URL: `your-store.myshopify.com`
  - Admin API Token: 私有应用Token
  - Theme ID: 可选（推送到指定主题）

### 7. TokenManager (Token管理)
- 功能：安全存储和管理Shopify访问Token
- 技术：加密存储 + 环境变量

---

## Shopify CLI完整集成

### 核心模块: ShopifyCLI

统一管理所有Shopify CLI调用

```typescript
// src/cli/shopify-cli.ts
class ShopifyCLI {
  constructor(private config: ShopifyConfig) {}
  
  // 主题操作
  async push(options?: PushOptions): Promise<PushResult>
  async dev(options?: DevOptions): Promise<DevResult>
  async pull(options?: PullOptions): Promise<PullResult>
  async share(): Promise<ShareResult>
  
  // 主题管理
  async list(): Promise<Theme[]>
  async delete(themeId: string): Promise<void>
  async duplicate(themeId: string): Promise<DuplicateResult>
  async publish(themeId: string): Promise<void>
  async rename(themeId: string, newName: string): Promise<void>
  
  // 代码质量
  async check(options?: CheckOptions): Promise<CheckResult>
  async console(): Promise<ConsoleResult>
  async profile(url: string): Promise<ProfileResult>
  
  // 工具
  async init(name: string, options?: InitOptions): Promise<void>
  async package(): Promise<PackageResult>
  async open(themeId?: string): Promise<string>
  async info(): Promise<StoreInfo>
}
```

### 完整CLI命令映射

#### 1. 主题上传/同步

| CLI命令 | 方法 | 功能描述 | Pixel2Liquid集成 |
|---------|------|---------|-----------------|
| `theme push` | `push()` | 上传本地主题到Shopify | ✅ **核心上传** |
| `theme pull` | `pull()` | 从Shopify拉取主题到本地 | ✅ **主题备份** |
| `theme dev` | `dev()` | 本地开发服务器+实时预览 | ✅ **实时预览** |

#### 2. 主题管理

| CLI命令 | 方法 | 功能描述 | Pixel2Liquid集成 |
|---------|------|---------|-----------------|
| `theme list` | `list()` | 列出店铺所有主题 | ✅ **主题选择** |
| `theme delete` | `delete()` | 删除指定主题 | ✅ **清理主题** |
| `theme duplicate` | `duplicate()` | 复制主题 | ✅ **克隆主题** |
| `theme publish` | `publish()` | 发布主题 | ✅ **一键发布** |
| `theme rename` | `rename()` | 重命名主题 | ✅ **主题命名** |
| `theme share` | `share()` | 生成分享链接 | ✅ **分享预览** |

#### 3. 代码质量

| CLI命令 | 方法 | 功能描述 | Pixel2Liquid集成 |
|---------|------|---------|-----------------|
| `theme check` | `check()` | Liquid代码检查+Lint | ✅ **质量把关** |
| `theme console` | `console()` | Liquid REPL调试 | ✅ **调试工具** |
| `theme profile` | `profile()` | 页面性能分析 | ✅ **性能诊断** |

#### 4. 工具命令

| CLI命令 | 方法 | 功能描述 | Pixel2Liquid集成 |
|---------|------|---------|-----------------|
| `theme init` | `init()` | 初始化新主题 | ✅ **起始模板** |
| `theme package` | `package()` | 打包成ZIP | ✅ **导出分发** |
| `theme open` | `open()` | 打开主题预览链接 | ✅ **快速预览** |
| `theme info` | `info()` | 显示当前环境信息 | ✅ **环境诊断** |

### 功能详解

#### ✅ theme push - 核心上传
```typescript
interface PushOptions {
  path?: string;           // 主题路径
  store?: string;            // 店铺URL
  themeId?: string;         // 指定主题ID（覆盖现有）
  development?: boolean;     // 作为开发主题
  ignore?: string[];         // 忽略的文件
}

interface PushResult {
  success: boolean;
  themeId: string;
  previewUrl: string;
  errors?: string[];
}
```

#### ✅ theme dev - 实时预览
```typescript
interface DevOptions {
  store?: string;
  themeId?: string;
  host?: string;           // 主机地址
  port?: number;           // 端口
  pollInterval?: number;   // 轮询间隔
}

interface DevResult {
  localUrl: string;        // http://127.0.0.1:9292
  storeUrl: string;        // Shopify预览URL
  processId: number;      // Node进程ID
}
```

#### ✅ theme share - 分享预览
```typescript
interface ShareResult {
  sharedUrl: string;      // 临时预览链接
  expiresAt: Date;        // 过期时间
}
```

#### ✅ theme check - 代码检查
```typescript
interface CheckOptions {
  path?: string;
  failLevel?: 'error' | 'suggestion' | 'warning';
  autoCorrect?: boolean;  // 自动修复
  output?: 'json' | 'text' | 'pretty';
}

interface CheckResult {
  passed: boolean;
  errors: CheckError[];
  warnings: CheckWarning[];
  suggestions: CheckSuggestion[];
  fixed?: string[];        // 自动修复的文件
}
```

#### ✅ theme pull - 备份还原
```typescript
interface PullOptions {
  themeId?: string;
  store?: string;
  destination?: string;     // 目标目录
}

interface PullResult {
  success: boolean;
  filesPulled: number;
  path: string;
}
```

#### ✅ theme list - 主题管理
```typescript
interface Theme {
  id: string;
  name: string;
  role: 'main' | 'development' | 'unpublished';
  createdAt: Date;
  updatedAt: Date;
  previewUrl: string;
}
```

#### ✅ theme package - 打包分发
```typescript
interface PackageResult {
  success: boolean;
  zipPath: string;
  size: number;           // ZIP文件大小
}
```

#### ✅ theme profile - 性能分析
```typescript
interface ProfileResult {
  pageUrl: string;
  liquidRenderTime: number;
  sections: SectionPerformance[];
  warnings: PerformanceWarning[];
}
```

### 配置管理

```typescript
// src/cli/config.ts
interface ShopifyConfig {
  store: string;           // your-store.myshopify.com
  token?: string;           // Admin API Token
  themeId?: string;         // 默认主题ID
  devThemeId?: string;     // 开发主题ID
  ignorePatterns?: string[]; // 忽略的文件模式
}

// 环境变量支持
const config = {
  store: process.env.SHOPIFY_STORE_URL,
  token: process.env.SHOPIFY_ADMIN_TOKEN,
  themeId: process.env.SHOPIFY_THEME_ID,
  devThemeId: process.env.SHOPIFY_DEV_THEME_ID,
}
```

### 安全机制

```typescript
// Token管理
class TokenManager {
  // 1. 优先使用环境变量
  // 2. 存储在 ~/.pixel2liquid/config.json (加密)
  // 3. 支持Token过期检测
  // 4. 自动提示更新Token
  
  async validateToken(token: string): Promise<boolean>
  async refreshToken(): Promise<void>
  async getToken(): Promise<string>
}

// 敏感信息处理
const ignored = [
  '*.env',
  '*.log',
  'node_modules/**',
  '.git/**',
  '*.local'
]
```

---

## 验收标准

| 阶段 | 指标 | 标准 |
|------|------|------|
| Phase 1 | 网页采集成功率 | >95% |
| Phase 2 | 转换完整度 | >90% |
| Phase 3 | 主题可导入性 | 可直接导入Shopify |
| Phase 4 | 配置可用性 | 拖拽配置正常 |

---

## 竞品对比

| 工具 | 优点 | 缺点 |
|------|------|------|
| HTML2Liquid | AI驱动 | 非开源，付费 |
| GemPages | 可视化 | 仅限Shopify内 |
| 手动开发 | 完全可控 | 耗时 |

**我们的优势**：开源 + 像素级克隆 + 自主配置

---

## 开发计划

| 阶段 | 时间 | 交付物 |
|------|------|--------|
| MVP | 2周 | CLI工具，支持基础转换 |
| v1.0 | 1个月 | Web界面，基础配置功能 |
| v2.0 | 2个月 | 拖拽编辑器，高级配置 |

---

*最后更新: 2026-03-24*
