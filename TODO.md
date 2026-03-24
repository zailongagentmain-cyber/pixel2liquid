# TODO.md - Pixel2Liquid 项目任务

> 记录待解决的问题和任务

---

## Phase 1: 采集模块 ✅ 完成

- [x] Spider 基础架构
- [x] SiteCrawler（页面发现）
- [x] AssetDownloader（资源识别）
- [x] Phase 1 QuickScan 完成

---

## Phase 2: 转换引擎 ❌ 待确认方向

### 核心问题 1：资源映射策略

**问题描述：**
Fandomara 的 Shopify CDN 资源（cdn.shopify.com）无法直接下载使用。需要设计一套资源映射机制，将采集到的 Shopify 资源 URL 转换为 Liquid 模板中的 asset 引用。

**具体问题：**
- Shopify 使用 `asset_url` 和 `image_url` Liquid filter 生成 CDN URL
- URL 包含版本参数 `?v=xxx` 用于缓存刷新
- 资源文件命名格式：`name.hash.ext`（如 `base.css`、`global.js?v=123`）

**需要确认：**
- 资源映射表的数据结构设计
- 如何处理同资源多版本的问题
- CSS 中的 font-face 引用如何映射

---

### 核心问题 2：用户上传流程

**问题描述：**
最终生成的 Liquid 主题需要用户手动上传资源到 Shopify 主题 assets 目录。需要设计辅助工具或自动化流程。

**需要确认：**
- 提供资源打包下载（用户自行上传）
- 还是通过 Shopify API 自动上传（需要 OAuth）
- 用户需要上传哪些资源（全部 vs 按需）
- 资源上传的目录结构

---

### 核心问题 3：采集范围

**问题描述：**
明确采集的目标是页面结构+内容，还是需要记录资源链接的完整对应关系。

**需要确认：**
- 只采集 HTML 结构，内容通过 Shopify 数据替代
- 还是采集完整内容（产品名、价格、图片描述等）
- 是否需要采集 Shopify 特有的 section/block 结构
- 主题模板的拆分粒度（每个页面一个模板 vs 组件化模板）

---

## Phase 3: Shopify CLI 集成 ❌ 待实现

- [ ] theme push（上传主题到 Shopify）
- [ ] theme dev（本地开发服务器）
- [ ] theme check（Lint 检查）
- [ ] theme package（打包 ZIP）

---

## Phase 4: 可视化编辑器 ❌ 规划中

- [ ] Drag & Drop 页面构建
- [ ] Section/Block 配置面板
- [ ] 实时预览

---

## 其他待解决问题

### Spider 稳定性问题（P1）

**OOM 根因分析（已确认）：**

1. **大 HTML 保存在内存** — `page.html` 600KB+ 字符串存在 `collectedPages` 数组里不释放
   - 位置：`Spider.ts phase2ProgressiveCollect` 循环中的 `collectedPages.push(collectedPage)`
   - 修复：写入文件后立即 `delete collectedPage.html` 释放内存

2. **Browser 未立即关闭** — `launchIsolatedBrowser()` 创建的 browser/context 在循环结束时才 close
   - 位置：`Spider.ts phase2ProgressiveCollect` 第 147-150 行
   - 修复：采集完单页立即 `await browser.close()`，不等下一轮

3. **`waitForTimeout(5000)` 太长** — `SiteCrawler` 里多次 5 秒等待让 browser 存活更久
   - 位置：`SiteCrawler.ts` 第 95、107、112 行
   - 修复：缩短到 1-2 秒，或用更精准的 `waitForSelector` 替代

4. **GC 未强制触发** — `global.gc()` 调用不确定是否执行
   - 修复：每页采集后检查内存使用，超阈值时强制 `global.gc()`

5. **`collectAssetUrls` 重复解析大 HTML** — 每个页面多次 `cheerio.load(html)` 消耗内存
   - 位置：`Spider.ts collectSinglePage` 和 `AssetDownloader.ts` 各自解析一遍
   - 修复：统一在 `collectSinglePage` 解析一次，传给下游

**待修复：**
- [ ] 每页采集完立即关闭 browser，不等下一次循环
- [ ] HTML 写入文件后从内存释放（delete page.html）
- [ ] 缩短 SiteCrawler 的 waitForTimeout 时间
- [ ] 添加内存监控，超阈值强制 GC
- [ ] 统一 HTML 解析，避免重复 cheerio.load
- [ ] "Target page, context or browser has been closed" 错误处理增强
- [ ] Phase 2 进度保存和断点续传
- [ ] 资源下载失败时的错误日志（当前静默失败）

### 技术债务

- [ ] TypeScript 类型定义不完整（types.ts）
- [ ] 测试覆盖率不足
- [ ] 错误处理统一化
- [ ] 日志系统规范化

---

## 优先级排序

1. **P0** - 明确 Phase 2 的技术方案（资源映射 + 用户上传流程）
2. **P1** - 修复 Spider OOM 问题，提升采集稳定性
3. **P2** - 实现 Phase 3 Shopify CLI 基础功能
4. **P3** - 优化错误处理和日志

---

*最后更新：2026-03-24 by 码龙*
