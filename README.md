# Pixel2Liquid

> 将任意网站像素级克隆为Shopify Liquid主题

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 项目目标

将任意网站像素级复制并转换为Shopify Liquid主题，支持拖拽配置页面内容。

## 🚀 核心功能

### 网页采集与转换
- 🌐 **单页面采集** - 完整采集HTML/CSS/JS/图片/字体资源
- 🔗 **子页面采集** - 自动跟随站内链接，采集所有相关页面
- 📄 **结构保留** - 完整DOM树结构，像素级还原
- 🎨 **样式保留** - 内联+外部CSS合并，响应式规则完整
- ⚙️ **静态化处理** - JS渲染内容转为静态HTML
- 🔄 **路径修复** - 相对路径转为可访问的本地/绝对路径
- 📦 **完整导出** - 采集后的文件可完全独立运行

### 元素分解与混合
- 🔀 **元素分解** - 从采集结果中智能分解可复用元素
- 📦 **元素库** - 存储分解后的元素，支持导出/导入
- 🔄 **模板混合** - 组合不同来源的样式(A站)和内容(B站)
- 🎨 **样式复用** - 将A站的视觉样式应用到B站的内容
- ⚙️ **可配置化** - 生成可拖拽配置的section/schema

### 电商元素支持
- 🖼️ **Banner/Hero** - 全屏横幅轮播
- 🏢 **Logo List** - 品牌Logo列表
- 📦 **Product Grid** - 产品网格展示
- 📂 **Category/Collection** - 分类集合展示
- 📝 **Rich Text** - 富文本编辑器
- 🖼️ **Image + Text** - 图文组合
- 🎬 **Video** - 视频嵌入
- 💬 **Testimonials** - 客户评价
- 📋 **Footer** - 页脚
- 📌 **Header/Navigation** - 导航栏

### 可扩展架构
- 🔌 **ElementRegistry** - 元素注册表，支持自定义元素
- 🧱 **Block System** - Block系统，支持动态添加删除
- 📐 **Schema Builder** - 自动Schema生成
- 🎯 **Drag & Drop Ready** - 支持拖拽编辑布局
- 🔀 **Element Library** - 元素库，存储分解后的元素
- 🔄 **Template Mixer** - 模板混合器，组合不同来源的样式和内容

### Shopify CLI完整集成
- 🚀 **theme push** - 上传主题到Shopify
- 🔍 **theme dev** - 本地开发服务器+实时预览
- 🔗 **theme share** - 生成分享链接
- ✅ **theme check** - Liquid代码检查+Lint
- 📦 **theme package** - 打包成ZIP
- 📥 **theme pull** - 从Shopify拉取主题备份
- 📋 **theme list** - 列出店铺所有主题
- 🗑️ **theme delete** - 删除主题
- 📢 **theme publish** - 发布主题
- 📝 **theme rename** - 重命名主题
- 🔄 **theme duplicate** - 复制主题
- 🎯 **theme open** - 打开预览链接
- 💻 **theme console** - Liquid REPL调试
- 📊 **theme profile** - 页面性能分析
- 🆕 **theme init** - 初始化新主题
- ℹ️ **theme info** - 环境信息诊断

## 📁 项目结构

```
pixel2liquid/
├── src/                    # 源代码
│   ├── cli.ts             # CLI入口
│   ├── spider/            # 网页采集模块
│   ├── parser/            # HTML/CSS解析
│   ├── transformer/       # Liquid转换引擎
│   │   ├── ElementRegistry.ts  # 元素注册表
│   │   ├── blocks/       # Block实现
│   │   │   ├── Block.ts      # Block基类
│   │   │   ├── Banner.ts     # Banner元素
│   │   │   ├── Logo.ts       # Logo元素
│   │   │   ├── Product.ts   # Product元素
│   │   │   └── ...          # 其他元素
│   │   ├── SchemaBuilder.ts  # Schema生成器
│   │   └── PageLayout.ts    # 页面布局
│   ├── builder/            # Shopify主题构建
│   ├── editor/            # 可视化配置编辑器
│   ├── cli/                # Shopify CLI集成
│   └── utils/              # 工具函数
├── docs/                  # 文档
├── tests/                 # 测试
├── config/                # 配置文件
└── README.md
```

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 采集 | Playwright, Cheerio |
| 解析 | PostCSS, CSSTree |
| 转换 | AST, LiquidJS |
| 构建 | Shopify Theme Kit |
| CLI集成 | @shopify/cli, Node.js child_process |
| 前端 | React, DnD Kit |

## 📋 开发进度

- [x] 项目初始化
- [ ] Phase 1: 网页采集模块
- [ ] Phase 2: 转换引擎
- [ ] Phase 3: Shopify CLI集成
- [ ] Phase 4: Shopify主题适配
- [ ] Phase 5: 可视化配置

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 License

MIT
