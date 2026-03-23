/**
 * Pixel2Liquid - Vercel Preview Server
 * 
 * 用于Vercel部署的静态文件服务器
 */

const http = require('http');
const fs = require('fs-extra');
const path = require('path');

const PORT = process.env.PORT || 3000;

// 获取输出目录（Vercel会将静态文件放在.vercel/output）
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(process.cwd(), 'output');

async function startServer(req, res) {
  try {
    let pathname = new URL(req.url, `http://localhost:${PORT}`).pathname;

    // 默认返回 index.html
    if (pathname === '/') {
      pathname = '/index.html';
    }

    const filepath = path.join(OUTPUT_DIR, pathname);

    // 安全检查：防止目录遍历
    const normalizedPath = path.normalize(filepath);
    if (!normalizedPath.startsWith(OUTPUT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // 检查文件是否存在
    let exists = await fs.pathExists(normalizedPath);
    if (!exists) {
      // 尝试 index.html
      const indexPath = path.join(normalizedPath, 'index.html');
      exists = await fs.pathExists(indexPath);
      if (exists) {
        const content = await fs.readFile(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }

      // 尝试.html后缀
      const htmlPath = normalizedPath + '.html';
      exists = await fs.pathExists(htmlPath);
      if (exists) {
        const content = await fs.readFile(htmlPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      }

      res.writeHead(404);
      res.end('Not Found: ' + pathname);
      return;
    }

    // 判断文件类型并设置Content-Type
    const ext = path.extname(filepath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
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

  } catch (error) {
    console.error('Error serving:', error);
    res.writeHead(500);
    res.end('Internal Server Error: ' + error.message);
  }
}

const server = http.createServer(startServer);

server.listen(PORT, () => {
  console.log(`Preview server running on port ${PORT}`);
  console.log(`Serving files from: ${OUTPUT_DIR}`);
});

module.exports = server;
