/**
 * batch-crawl.js
 * 
 * 逐个采集页面，支持断点续传
 * 用法: node scripts/batch-crawl.js <outputDir>
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const OUTPUT_DIR = process.argv[2];
const MAX_RETRIES = 3;
const CRAWL_DELAY_MS = 2000;

if (!OUTPUT_DIR) {
  console.error('用法: node scripts/batch-crawl.js <outputDir>');
  process.exit(1);
}

const PROJECT_DIR = path.dirname(fileURLToPath(import.meta.url)).replace('/scripts', '');
const QUICK_SCAN = path.join(OUTPUT_DIR, 'urls-master.json');
const PROGRESS_FILE = path.join(OUTPUT_DIR, '.collection-progress.json');
const ERRORS_FILE = path.join(OUTPUT_DIR, 'errors.json');

async function runSpider(url) {
  return new Promise((resolve) => {
    const args = [
      'dist/cli.js', 'spider', url,
      '-o', OUTPUT_DIR,
      '--static',
      '--max-pages', '1',
      '--progress', PROGRESS_FILE
    ];
    
    const child = spawn('node', args, { cwd: PROJECT_DIR });
    let output = '';
    
    child.stdout.on('data', d => { output += d.toString(); process.stdout.write(d); });
    child.stderr.on('data', d => { output += d.toString(); });
    
    child.on('close', (code) => {
      resolve({ url, code, output });
    });
    
    child.on('error', (err) => {
      resolve({ url, code: -1, output: err.message });
    });
  });
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return { completedUrls: [], failedUrls: [] };
  }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function main() {
  // 检查 quick-scan.json
  if (!fs.existsSync(QUICK_SCAN)) {
    console.error(`❌ 找不到 ${QUICK_SCAN}`);
    console.error('请先运行: node dist/cli.js spider <url> --static -o <output> --max-pages 100');
    process.exit(1);
  }

  const urls = JSON.parse(fs.readFileSync(QUICK_SCAN, 'utf8'));
  const total = urls.length;

  // 加载进度
  const progress = loadProgress();
  const completed = new Set(progress.completedUrls || []);
  const failedUrls = progress.failedUrls || [];

  // 找出待采集的页面
  const toProcess = urls.filter(url => !completed.has(url));

  console.log(`\n📊 总页面: ${total}`);
  console.log(`✅ 已完成: ${completed.size}`);
  console.log(`⏳ 待采集: ${toProcess.length}`);
  console.log(`❌ 失败: ${failedUrls.length}\n`);

  if (toProcess.length === 0) {
    console.log('✅ 全部页面已采集完成!');
    process.exit(0);
  }

  const errors = [];

  for (let i = 0; i < toProcess.length; i++) {
    const url = toProcess[i];
    const num = i + 1;

    console.log(`\n[${num}/${toProcess.length}] 采集: ${url}`);

    let success = false;
    let lastOutput = '';

    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      const result = await runSpider(url);
      lastOutput = result.output;

      if (result.code === 0) {
        console.log(`  ✅ 成功`);
        completed.add(url);
        saveProgress({ completedUrls: Array.from(completed), failedUrls: errors.map(e => e.url) });
        success = true;
        break;
      } else {
        if (retry < MAX_RETRIES - 1) {
          console.log(`  ⚠️ 失败，重试 (${retry + 1}/${MAX_RETRIES})...`);
          await new Promise(r => setTimeout(r, 3000));
        } else {
          console.log(`  ❌ 失败`);
          errors.push({ url: url, error: lastOutput.slice(-500) });
          saveProgress({ completedUrls: Array.from(completed), failedUrls: errors.map(e => e.url) });
        }
      }
    }

    // 每页之间延迟，让内存回收
    await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
  }

  // 保存错误日志
  if (errors.length > 0) {
    fs.writeFileSync(ERRORS_FILE, JSON.stringify({ errors, timestamp: new Date().toISOString() }, null, 2));
    console.log(`\n⚠️ ${errors.length} 个页面采集失败，已保存到 ${ERRORS_FILE}`);
  }

  console.log(`\n✅ 批量采集完成!`);
  console.log(`成功: ${completed.size}/${total}`);
  console.log(`失败: ${errors.length}`);
}

main().catch(console.error);
