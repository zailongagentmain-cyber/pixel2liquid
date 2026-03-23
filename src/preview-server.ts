/**
 * Pixel2Liquid - Preview Server
 * 
 * 本地预览服务器，用于查看采集后的静态页面
 */

import * as http from 'http';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as url from 'url';

const PORT = 3000;

export async function startPreviewServer(outputDir: string, port: number = PORT): Promise<void> {
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url!, `http://localhost:${port}`);
      let pathname = parsedUrl.pathname;

      // 默认返回 index.html
      if (pathname === '/') {
        pathname = '/index.html';
      }

      const filepath = path.join(outputDir, pathname);

      // 安全检查：防止目录遍历
      const normalizedPath = path.normalize(filepath);
      if (!normalizedPath.startsWith(outputDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      // 检查文件是否存在
      const exists = await fs.pathExists(normalizedPath);
      if (!exists) {
        // 尝试 index.html
        const indexPath = path.join(normalizedPath, 'index.html');
        const indexExists = await fs.pathExists(indexPath);
        if (indexExists) {
          const content = await fs.readFile(indexPath);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
          return;
        }

        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      // 判断文件类型并设置Content-Type
      const ext = path.extname(filepath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
      };

      const contentType = contentTypes[ext] || 'application/octet-stream';
      const content = await fs.readFile(filepath);

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);

    } catch (error: any) {
      console.error(`Error serving ${req.url}:`, error.message);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`\n🌐 Preview Server`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📁 Local: http://localhost:${port}`);
      console.log(`📂 Output: ${outputDir}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Press Ctrl+C to stop\n`);
      resolve();
    });
  });
}

// 如果直接运行此文件
if (process.argv[1] && process.argv[1].includes('preview-server')) {
  const outputDir = process.argv[2] || './output';
  const port = parseInt(process.argv[3]) || 3000;
  startPreviewServer(path.resolve(outputDir), port);
}
