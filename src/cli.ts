#!/usr/bin/env node

/**
 * Pixel2Liquid CLI
 * 
 * Usage: pixel2liquid <command> [options]
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { Spider } from './spider/Spider.js';
import { Transformer } from './transform/index.js';
import type { TransformConfig } from './transform/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// 设置版本
program
  .name('pixel2liquid')
  .description('Pixel-perfect website cloning to Shopify Liquid themes')
  .version('0.1.0');

// Spider命令 - 采集网页
program
  .command('spider')
  .description('🕷️  采集网页（含所有子页面）')
  .argument('<url>', '目标URL')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-p, --proxy <proxy>', '代理地址')
  .option('-m, --max-pages <number>', '最大采集页面数', '50')
  .option('--follow-external', '跟随外部链接（默认否）')
  .option('--no-headless', '显示浏览器窗口')
  .option('-b, --background', '后台运行，不阻塞', false)
  .option('--progress <file>', '进度文件路径')
  .option('--async', '异步模式：HTML采集后立即返回，资源后台下载', false)
  .option('--static', '静态镜像模式：不下载资源，保留原始CDN URL（用于完整站点克隆部署）', false)
  .option('--proxy-server', '启动本地预览服务器（仅在 --async 时有效）', false)
  .option('--proxy-port <number>', '预览服务器端口', '3002')
  .action(async (url, options) => {
    const progressFile = options.progress || 
      path.join(os.tmpdir(), `spider-progress-${Date.now()}.json`);

    console.log('\n🕷️  Pixel2Liquid Spider\n');

    // 后台模式：启动子进程运行 spider
    if (options.background) {
      // 构建命令参数（子进程不需要 --background 参数，否则会无限递归）
      const args = [
        'spider', url,
        '-o', options.output,
        '-m', options.maxPages,
        '--progress', progressFile,
      ];
      if (options.proxy) args.push('-p', options.proxy);
      if (options.followExternal) args.push('--follow-external');
      if (!options.headless) args.push('--no-headless');
      if (options.async) args.push('--async');
      if (options.static) args.push('--static');
      if (options.proxyServer) args.push('--proxy-server');
      if (options.proxyPort) args.push('--proxy-port', options.proxyPort);
      
      const child = spawn('node', [
        path.join(__dirname, 'cli.js'),
        ...args
      ], {
        stdio: 'inherit',
        detached: true,
        cwd: path.dirname(__dirname),  // 项目根目录
      });
      
      child.unref();
      
      console.log(`🚀 Spider 已启动（后台运行）`);
      console.log(`📄 进度文件: ${progressFile}`);
      console.log(`🔍 查看进度: cat ${progressFile}`);
      console.log(`\n💡 Agent 现在可以处理其他任务了！\n`);
      process.exit(0);
    }

    // 同步/异步模式
    const spider = new Spider({
      url,
      outputDir: options.output,
      proxy: options.proxy,
      maxPages: parseInt(options.maxPages),
      followExternal: options.followExternal,
      headless: options.headless,
      progressFile,
      asyncMode: options.async,
      startProxyServer: options.proxyServer,
      proxyPort: parseInt(options.proxyPort),
      staticMode: options.static,
    });

    try {
      await spider.crawl();
    } catch (error: any) {
      await spider.fail(error.message);
      console.error(`\n❌ 采集失败: ${error.message}`);
      process.exit(1);
    }
  });

// Transform命令 - 转换为主题
program
  .command('transform')
  .description('🔄  将采集结果转换为Shopify主题')
  .argument('<source>', '采集结果目录')
  .option('-s, --shop <shop>', 'Shopify store (store.myshopify.com)')
  .option('-t, --token <token>', 'Admin API token')
  .option('-o, --output <dir>', '输出目录', './theme')
  .option('-n, --name <name>', '主题名称', 'my-theme')
  .option('--skip-confirm', '跳过确认直接执行', false)
  .action(async (source, options) => {
    console.log('\n🔄  Pixel2Liquid Transform\n');
    console.log(`📂 源目录: ${source}`);
    console.log(`📁 输出目录: ${options.output}`);
    console.log(`🎨 主题名称: ${options.name}`);
    
    // Build Shopify config if provided
    let shopifyConfig: { shop: string; token: string } | null = null;
    if (options.shop && options.token) {
      shopifyConfig = {
        shop: options.shop,
        token: options.token,
      };
      console.log(`🛒 Shopify店铺: ${options.shop}`);
    } else {
      console.log('⚠️  未提供 Shopify 配置，将使用 Mock 模式');
    }

    // Create transformer
    const config: TransformConfig = {
      sourceDir: source,
      outputDir: path.resolve(options.output),
      shopify: shopifyConfig || { shop: 'mock-store.myshopify.com', token: 'mock-token' },
      dryRun: !shopifyConfig,
    };

    const transformer = new Transformer(config);

    try {
      // Run transformation
      const summary = await transformer.transform();

      // Ask for confirmation if not skipped and not dry run
      if (!options.skipConfirm && !config.dryRun) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>(resolve => {
          rl.question('\n是否执行确认的操作? (y/N): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() === 'y') {
          // Execute confirmed operations
          await transformer.executeConfirmed(summary);
        } else {
          console.log('\n⏭️  已跳过执行');
        }
      } else if (config.dryRun) {
        console.log('\n⚠️  Mock 模式，跳过 API 操作');
      }

      // Generate theme files
      await transformer.generateThemeFiles();

    } catch (error: any) {
      console.error(`\n❌ 转换失败: ${error.message}`);
      process.exit(1);
    }
  });

// Mix命令 - 混合元素（待实现）
program
  .command('mix')
  .description('🔀  混合多个采集结果的元素')
  .argument('<sources...>', '采集结果目录列表')
  .option('-s, --style-source <ids>', '样式来源元素ID')
  .option('-c, --content-source <ids>', '内容来源元素ID')
  .option('-o, --output <dir>', '输出目录', './mixed-theme')
  .action((sources, options) => {
    console.log('\n🔀  混合功能开发中...\n');
    console.log(`源目录: ${sources.join(', ')}`);
    console.log(`输出目录: ${options.output}`);
    console.log('\n请期待下一版本！\n');
  });

// Push命令 - 推送到Shopify（待实现）
program
  .command('push')
  .description('🚀  上传主题到Shopify')
  .argument('<themeDir>', '主题目录')
  .option('-s, --store <store>', 'Shopify店铺')
  .option('-t, --token <token>', 'Access Token')
  .action((themeDir, options) => {
    console.log('\n🚀  Shopify上传功能开发中...\n');
    console.log(`主题目录: ${themeDir}`);
    console.log(`店铺: ${options.store}`);
    console.log('\n请期待下一版本！\n');
  });

// Parse CLI
program.parse();
