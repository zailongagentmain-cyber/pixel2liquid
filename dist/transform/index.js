/**
 * Transform - Pixel2Liquid 转换引擎
 *
 * 将采集的 HTML 转换为 Shopify Liquid 主题
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { ShopifyClient } from './ShopifyClient.js';
import { HtmlParser } from './HtmlParser.js';
import { AssetMapper } from './AssetMapper.js';
import { ProductMatcher } from './ProductMatcher.js';
import { LiquidGenerator } from './LiquidGenerator.js';
import { OperationSummaryGenerator } from './OperationSummary.js';
export class Transformer {
    config;
    shopifyClient;
    htmlParser;
    assetMapper;
    productMatcher;
    liquidGenerator;
    summaryGenerator;
    constructor(config) {
        this.config = config;
        this.shopifyClient = new ShopifyClient(config.shopify);
        this.htmlParser = new HtmlParser();
        this.assetMapper = new AssetMapper();
        this.productMatcher = new ProductMatcher(this.shopifyClient, config.sourceDir);
        this.liquidGenerator = new LiquidGenerator();
        this.summaryGenerator = new OperationSummaryGenerator();
    }
    /**
     * 执行完整 Transform 流程
     */
    async transform() {
        console.log('🔄 Starting Transform...\n');
        // 1. 解析所有 HTML 文件
        console.log('📄 Step 1: 解析 HTML 文件...');
        const pages = await this.parseHtmlFiles();
        console.log(`   解析了 ${pages.length} 个页面\n`);
        // 2. 拉取目标店铺产品
        console.log('🌐 Step 2: 拉取目标店铺产品...');
        const targetProducts = await this.productMatcher.fetchTargetProducts();
        console.log(`   找到 ${targetProducts.size} 个产品\n`);
        // 3. 拉取主题 assets 列表
        console.log('📦 Step 3: 拉取主题 assets...');
        let themeAssets = [];
        try {
            themeAssets = await this.shopifyClient.getThemeAssets();
            console.log(`   找到 ${themeAssets.length} 个 assets\n`);
        }
        catch (e) {
            console.log(`   无法获取 assets，继续...\n`);
        }
        // 4. 匹配产品
        console.log('🔗 Step 4: 匹配产品...');
        const allHandles = pages.flatMap(p => p.productHandles);
        const uniqueHandles = [...new Set(allHandles)];
        const productMatches = this.productMatcher.match(uniqueHandles, targetProducts);
        const stats = this.productMatcher.getMatchStats(productMatches);
        console.log(`   匹配: ${stats.matched} 已有, ${stats.missing} 待创建\n`);
        // 5. 构建资源映射
        console.log('🖼️  Step 5: 构建资源映射...');
        const allAssetMappings = [];
        for (const page of pages) {
            const html = this.readHtml(page.localPath);
            const mappings = await this.assetMapper.buildAssetMappings(html, themeAssets);
            allAssetMappings.push(...mappings);
        }
        console.log(`   找到 ${allAssetMappings.length} 个资源引用\n`);
        // 6. 生成操作清单
        console.log('📋 Step 6: 生成操作清单...');
        const summary = await this.summaryGenerator.generate(pages, productMatches, allAssetMappings, this.shopifyClient);
        // 7. 输出清单
        console.log('\n' + this.summaryGenerator.formatSummary(summary));
        // 8. 生成 Liquid 模板（不消耗 API 点数）
        console.log('\n✨ Step 7: 生成 Liquid 模板...');
        await this.generateThemeFiles();
        console.log('\n✅ Transform 完成！');
        console.log(`   模板已生成到: ${this.config.outputDir}`);
        return summary;
    }
    /**
     * 执行已确认的操作
     */
    async executeConfirmed(summary) {
        console.log('\n🚀 执行确认的操作...\n');
        // 创建缺失的产品
        for (const product of summary.requiresConfirmation.productsToCreate) {
            console.log(`📦 创建产品: ${product.title}`);
            try {
                await this.shopifyClient.createProduct({
                    title: product.title || product.handle,
                    handle: product.handle,
                });
                console.log(`   ✅ 成功`);
            }
            catch (e) {
                console.log(`   ❌ 失败: ${e.message}`);
            }
        }
        console.log('\n✅ 所有确认的操作执行完成！');
    }
    /**
     * 生成 Liquid 主题文件（本地，无 API 消耗）
     */
    async generateThemeFiles() {
        const outputDir = this.config.outputDir;
        mkdirSync(outputDir, { recursive: true });
        // 1. 生成基本目录结构
        const dirs = [
            'layout',
            'sections',
            'templates',
            'assets',
            'config',
            'locales',
        ];
        for (const dir of dirs) {
            mkdirSync(join(outputDir, dir), { recursive: true });
        }
        // 2. 生成主题基础文件
        const themeStructure = this.liquidGenerator.generateThemeStructure();
        for (const [filename, content] of Object.entries(themeStructure)) {
            const filePath = join(outputDir, filename);
            mkdirSync(join(outputDir, dirname(filename)), { recursive: true });
            writeFileSync(filePath, content, 'utf-8');
        }
        // 3. 解析 HTML 文件并生成模板
        const htmlFiles = this.findHtmlFiles(this.config.sourceDir);
        for (const htmlFile of htmlFiles) {
            const relativePath = htmlFile.replace(this.config.sourceDir + '/', '');
            const html = readFileSync(htmlFile, 'utf-8');
            const page = this.htmlParser.parse(html, this.getUrlFromPath(relativePath), relativePath);
            let templateContent;
            let outputPath;
            switch (page.pageType) {
                case 'product':
                    templateContent = this.liquidGenerator.generateProductTemplate(page);
                    outputPath = join(outputDir, 'templates', `product.${page.handle}.liquid`);
                    break;
                case 'collection':
                    templateContent = this.liquidGenerator.generateCollectionTemplate(page);
                    outputPath = join(outputDir, 'sections', `collection-${page.handle}.liquid`);
                    break;
                case 'home':
                    templateContent = this.liquidGenerator.generateHomeTemplate(page);
                    outputPath = join(outputDir, 'sections', `home-${page.handle}.liquid`);
                    break;
                default:
                    outputPath = join(outputDir, 'sections', `${page.handle}.liquid`);
                    templateContent = `{% comment %} ${page.handle} {% endcomment %}\n${html}`;
            }
            writeFileSync(outputPath, templateContent, 'utf-8');
            console.log(`   ✨ ${outputPath}`);
        }
        console.log('\n📁 生成的主题结构：');
        for (const dir of dirs) {
            console.log(`   📂 ${dir}/`);
        }
    }
    /**
     * 解析 HTML 文件
     */
    async parseHtmlFiles() {
        const htmlFiles = this.findHtmlFiles(this.config.sourceDir);
        const pages = [];
        for (const file of htmlFiles) {
            try {
                const relativePath = file.replace(this.config.sourceDir + '/', '');
                const html = readFileSync(file, 'utf-8');
                const page = this.htmlParser.parse(html, this.getUrlFromPath(relativePath), relativePath);
                pages.push(page);
            }
            catch (e) {
                console.warn(`   ⚠️  解析失败 ${file}: ${e.message}`);
            }
        }
        return pages;
    }
    /**
     * 读取 HTML 文件
     */
    readHtml(localPath) {
        const filePath = join(this.config.sourceDir, localPath);
        return readFileSync(filePath, 'utf-8');
    }
    /**
     * 查找所有 HTML 文件
     */
    findHtmlFiles(dir) {
        const files = [];
        try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
                const fullPath = join(dir, entry);
                const stat = statSync(fullPath);
                if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'assets') {
                    files.push(...this.findHtmlFiles(fullPath));
                }
                else if (entry === 'index.html' && stat.isFile()) {
                    files.push(fullPath);
                }
            }
        }
        catch { }
        return files;
    }
    /**
     * 从本地路径推断 URL
     */
    getUrlFromPath(localPath) {
        return '/' + localPath.replace('/index.html', '').replace(/\/index\.html$/, '');
    }
}
/**
 * CLI 入口函数
 */
export async function runTransform(sourceDir, outputDir, shop, token) {
    const config = {
        sourceDir,
        outputDir,
        shopify: { shop, token },
        dryRun: false,
    };
    const transformer = new Transformer(config);
    await transformer.transform();
}
//# sourceMappingURL=index.js.map