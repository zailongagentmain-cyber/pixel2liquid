#!/bin/bash
# batch-crawl.sh - 逐个采集页面，支持断点续传

OUTPUT_DIR="$1"
MAX_RETRIES=3

if [ -z "$OUTPUT_DIR" ]; then
  echo "用法: ./batch-crawl.sh <输出目录> [max_pages]"
  exit 1
fi

MAX_PAGES="${2:-100}"
QUICK_SCAN="$OUTPUT_DIR/quick-scan.json"
PROGRESS="$OUTPUT_DIR/.collection-progress.json"
ERRORS="$OUTPUT_DIR/errors.json"

# 检查 quick-scan.json 是否存在
if [ ! -f "$QUICK_SCAN" ]; then
  echo "❌ 找不到 $QUICK_SCAN，请先运行 Phase 1"
  exit 1
fi

# 读取已完成的 URL
completed_count=0
failed_urls=()
if [ -f "$PROGRESS" ]; then
  completed_count=$(node -e "const p=require('$PROGRESS'); console.log(p.completedUrls?.length || 0)")
  echo "📊 已完成: $completed_count"
fi

# 用 node 提取所有 URL 并遍历
node -e "
const fs = require('fs');
const scan = JSON.parse(fs.readFileSync('$QUICK_SCAN', 'utf8'));
const pages = scan.pages;

// 读取已完成的
let completed = new Set();
let failed = [];
try {
  const prog = JSON.parse(fs.readFileSync('$PROGRESS', 'utf8'));
  completed = new Set(prog.completedUrls || []);
  failed = prog.failedUrls || [];
} catch(e) {}

console.log('总页面数:', pages.length);
console.log('已完成:', completed.size);
console.log('失败待重试:', failed.length);

const toProcess = pages.filter(p => !completed.has(p.url));
console.log('待采集:', toProcess.length);

// 输出到临时文件，供 bash 遍历
fs.writeFileSync('/tmp/urls-to-crawl.json', JSON.stringify(toProcess));
"

URLS_FILE="/tmp/urls-to-crawl.json"

if [ ! -f "$URLS_FILE" ]; then
  echo "❌ 没有待采集的页面"
  exit 0
fi

# 用 node 遍历处理每个 URL
node -e "
const fs = require('fs');
const { spawn } = require('child_process');
const urls = JSON.parse(fs.readFileSync('$URLS_FILE', 'utf8'));
const total = urls.length;
const errors = [];
const maxRetries = $MAX_RETRIES;

// 读取现有进度
let completed = [];
let progress = { completedUrls: [], failedUrls: [] };
try {
  progress = JSON.parse(fs.readFileSync('$PROGRESS', 'utf8'));
  completed = progress.completedUrls;
} catch(e) {}

async function runSpider(url) {
  return new Promise((resolve) => {
    const child = spawn('node', [
      'dist/cli.js', 'spider', url,
      '-o', '$OUTPUT_DIR',
      '--static',
      '--max-pages', '1',
      '--progress', '$PROGRESS'
    ], { cwd: '$HOME/projects/pixel2liquid' });

    let output = '';
    child.stdout.on('data', d => output += d.toString());
    child.stderr.on('data', d => output += d.toString());
    child.on('close', (code) => {
      resolve({ url, code, output });
    });
  });
}

async function main() {
  for (let i = 0; i < urls.length; i++) {
    const page = urls[i];
    const num = i + 1;
    console.log(\`[\${num}/\${total}] 采集: \${page.url}\`);

    let success = false;
    for (let retry = 0; retry < maxRetries; retry++) {
      const result = await runSpider(page.url);

      if (result.code === 0) {
        console.log(\`  ✅ 成功\`);
        completed.push(page.url);
        // 更新进度
        progress.completedUrls = completed;
        fs.writeFileSync('$PROGRESS', JSON.stringify(progress, null, 2));
        success = true;
        break;
      } else {
        if (retry < maxRetries - 1) {
          console.log(\`  ⚠️ 失败，重试 (\${retry + 1}/\${maxRetries})\`);
          await new Promise(r => setTimeout(r, 3000));
        } else {
          console.log(\`  ❌ 失败: \${result.output.slice(-200)}\`);
          errors.push({ url: page.url, error: result.output.slice(-500) });
          progress.failedUrls = errors.map(e => e.url);
          fs.writeFileSync('$PROGRESS', JSON.stringify(progress, null, 2));
        }
      }
    }

    // 每页之间稍作延迟，让内存回收
    await new Promise(r => setTimeout(r, 2000));
  }

  // 保存错误日志
  if (errors.length > 0) {
    fs.writeFileSync('$ERRORS', JSON.stringify({ errors, timestamp: new Date().toISOString() }, null, 2));
  }

  console.log('\\n✅ 批量采集完成!');
  console.log('成功:', completed.length, '/', total);
  console.log('失败:', errors.length);
}

main().catch(console.error);
"
