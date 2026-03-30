# TODO.md - Pixel2Liquid 项目任务

> 记录待解决的问题和任务

---

## Phase 1: 采集模块 ✅ 完成

- [x] Spider 基础架构
- [x] SiteCrawler（页面发现）
- [x] AssetDownloader（资源识别）
- [x] Phase 1 QuickScan 完成
- [x] --static 静态镜像模式（保留原始 Shopify CDN URL）
- [x] batch-crawl.js 批量采集脚本（断点续传 + 重试）
- [x] Spider OOM 优化（browser 立即关闭、缩短 waitForTimeout）

---

## Phase 2: 转换引擎（Transform）🔄 开发中

### 2026-03-24 设计决策

#### 核心思路
- 源站本身就是 Shopify，数据本来就存在 Shopify CDN
- 转换目标是**映射引用而不是重新上传**
- 用户在 Shopify 后台改数据 → Liquid 模板自动热更新

#### 完整流程

```
Phase 1: 采集 (Spider)
    输出: HTML + Asset URL 列表
           ↓
Phase 2: Transform
    Step 1: HTML 结构解析
        → 识别页面区块（header/product/footer/collection）
        → 定位产品展示区域（标题/价格/图片/描述在哪）
        → 输出: 结构化的"区块映射表" (BlockMap)
    
    Step 2: 资源映射
        → 解析 cdn.shopify.com URL → 提取文件名
        → 查询目标店铺 assets 是否有同名文件
        → 输出: CDN URL → {{ 'file.css' | asset_url }}
    
    Step 3: 产品匹配
        → 从源站 HTML/gp-data 提取产品 handle
        → GraphQL 批量拉取目标店铺产品（只查一次）
        → 本地匹配: source handle → target product.id
        → 输出: ProductMap (matched / missing)
    
    Step 4: Liquid 模板生成
        → 产品页: sections/product-template.liquid
        → Collection页: sections/collection-template.liquid
        → 使用 {{ product.xxx }} 引用 Shopify 数据对象
        → Block 定义: 产品卡片结构
    
    Step 5: 生成操作清单（本地，无 API 消耗）
    
    Step 6: 用户确认（所有消耗点数的操作需用户主动确认）
    
    Step 7: 执行确认的操作
        → 已有产品: 不操作（用户后台数据保留）
        → 缺失产品: API 创建 (productCreate)
        → 资源文件: API 上传 (fileCreate)
        → 模板文件: 本地生成，shopify theme push 上传
        → 发布主题: themePublish
```

#### 关键数据结构

```typescript
// 区块映射表
interface BlockMap {
  sourceSelector: string;    // ".product-card h3"
  liquidReference: string;  // "{{ product.title }}"
  dataType: 'text' | 'image' | 'price' | 'link';
}

interface PageStructure {
  pageType: 'product' | 'collection' | 'home' | 'blog';
  blocks: BlockMap[];
  sections: string[];
}

// 产品映射表
interface ProductMap {
  sourceHandle: string;     // "love-and-deepspace-body-pillow"
  sourceUrl: string;        // 源站产品页 URL
  targetProductId: string | null;  // null = 待创建
  matched: boolean;
  assetMappings: AssetMapping[];
}

// 资源映射
interface AssetMapping {
  cdnUrl: string;           // 源站 CDN URL
  filename: string;        // "base.css"
  targetAssetUrl: string | null;  // null = 需上传
  liquidReference: string;  // "{{ 'base.css' | asset_url }}"
}
```

#### 操作清单结构

```typescript
interface OperationSummary {
  generatedAt: string;
  sourceUrl: string;
  
  // 只读操作（自动执行）
  readOnly: {
    productsFound: number;
    assetsFound: number;
    liquidTemplates: string[];
  };
  
  // 需要用户确认的操作（消耗点数）
  requiresConfirmation: {
    productsToCreate: {
      handle: string;
      title: string;
      estimatedCost: number;
    }[];
    
    assetsToUpload: {
      filename: string;
      size: string;
      type: 'css' | 'js' | 'image' | 'font';
      estimatedCost: number;
    }[];
    
    estimatedTotalCost: number;
  };
}
```

#### Shopify API 能力确认

| 需求 | API | 状态 |
|------|-----|------|
| 创建产品 | productCreate | ✅ |
| 批量创建变体 | productVariantsBulkCreate | ✅ (250个/次) |
| 上传文件到CDN | fileCreate | ✅ |
| 写入主题文件 | themeFilesUpsert | ✅ (2024-10) |
| 发布主题 | themePublish | ✅ |
| 批量操作 | bulkOperationRunMutation | ✅ |
| 按 handle 查询 | productByHandle | ✅ |
| Metafields | metafieldsSet | ✅ (25个/次) |

#### Shopify CLI 工具

| 命令 | 用途 |
|------|------|
| shopify theme push | 上传整个主题到店铺 |
| shopify theme push --unpublished | 创建新未发布主题 |
| shopify theme push --nodelete | 不删除远程文件 |
| shopify theme dev | 实时同步+预览 |
| shopify theme check | Lint 检查 |

**策略：用 shopify theme push 替代手动的 API 上传逻辑**

#### API 速率限制

| 操作类型 | 消耗 | 说明 |
|---------|------|------|
| 查询 (Read) | ~1-2 点/次 | 便宜，可以多查 |
| 写入 (Mutation) | ~10-50 点/次 | 贵，要尽量减少 |

**策略：多查少写，本地完成所有匹配**

#### 增量优化

1. 首次运行：批量拉取所有产品到 `products-cache.json`
2. 后续运行：只查询 `updated_at > 上次缓存时间` 的产品
3. 本地匹配：零 API 调用

---

### 待实现任务

- [ ] Transform 模块主入口 (transform.ts)
- [ ] HTML 结构解析器 (HtmlParser)
- [ ] 资源映射器 (AssetMapper)
- [ ] 产品匹配器 (ProductMatcher)
- [ ] Liquid 模板生成器 (LiquidGenerator)
- [ ] 操作清单生成器 (OperationSummaryGenerator)
- [ ] 用户确认交互界面
- [ ] Shopify GraphQL Client (shopify.ts)
- [ ] CLI 命令 (transform command)
- [ ] products-cache.json 本地缓存
- [ ] 操作清单 JSON 输出

---

## Phase 3: Shopify CLI 集成 ❌ 待实现

- [ ] theme push（通过 CLI 上传主题）
- [ ] theme check（Lint 检查）
- [ ] theme package（打包 ZIP）

---

## Phase 4: 可视化编辑器 ❌ 规划中

- [ ] Drag & Drop 页面构建
- [ ] Section/Block 配置面板
- [ ] 实时预览

---

## Spider 已知问题（待修复）

- [ ] 完整错误日志记录（当前部分错误静默）
- [ ] TypeScript 类型定义完善
- [ ] 测试覆盖率提升

---

## 优先级排序

1. **P0** - 实现 Phase 2 Transform 模块
2. **P1** - 完成 Spider 稳定性优化
3. **P2** - 实现 Phase 3 Shopify CLI 集成
4. **P3** - 优化错误处理和日志

---

## 命令速查

```bash
# 静态镜像采集
node dist/cli.js spider <url> --static -o <output>

# 批量采集（断点续传）
node scripts/batch-crawl.js <output>

# Transform (待实现)
node dist/cli.js transform <sourceDir> --shop <store>.myshopify.com --token <token>

# Vercel 部署
vercel --prod
```

---

*最后更新：2026-03-24 by 码龙*
