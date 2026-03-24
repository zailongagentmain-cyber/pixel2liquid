/**
 * Pixel2Liquid - Local Proxy Server
 *
 * 本地预览服务器，代理资源请求
 * - 已下载的资源 → 直接返回本地文件
 * - 未下载的资源 → 按需下载后返回
 */
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
export class LocalProxyServer {
    server = null;
    options;
    pendingRequests = new Map();
    constructor(options) {
        this.options = options;
    }
    /**
     * 启动代理服务器
     */
    async start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => this.handleRequest(req, res));
            this.server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    // 尝试下一个端口
                    this.options.port++;
                    resolve(this.start());
                }
                else {
                    reject(err);
                }
            });
            this.server.listen(this.options.port, () => {
                console.log(`🔮 本地预览服务器启动: http://localhost:${this.options.port}`);
                resolve(this.options.port);
            });
        });
    }
    /**
     * 停止代理服务器
     */
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
                this.server = null;
            }
            else {
                resolve();
            }
        });
    }
    /**
     * 获取代理后的 URL（将原始 URL 转换为本地代理 URL）
     */
    getProxyUrl(originalUrl) {
        const parsed = url.parse(originalUrl);
        const pathname = parsed.pathname || '/';
        return `http://localhost:${this.options.port}/proxy${pathname}`;
    }
    async handleRequest(req, res) {
        const reqUrl = req.url || '/';
        // 设置 CORS 头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        // 处理代理请求
        if (reqUrl.startsWith('/proxy')) {
            const targetPath = reqUrl.substring('/proxy'.length);
            await this.handleProxyRequest(targetPath, req, res);
            return;
        }
        // 处理静态文件请求
        await this.handleStaticRequest(reqUrl, req, res);
    }
    /**
     * 处理代理请求 - 转发到原始服务器
     */
    async handleProxyRequest(targetPath, req, res) {
        const originalUrl = this.options.baseUrl + targetPath;
        const parsed = url.parse(originalUrl);
        // 检查是否已下载
        const localPath = this.options.resourceQueue.getLocalPath(originalUrl);
        if (localPath) {
            const fullPath = path.join(this.options.outputDir, localPath);
            if (fs.existsSync(fullPath)) {
                await this.serveLocalFile(fullPath, res, this.getMimeType(targetPath));
                return;
            }
        }
        // 按需下载
        this.fetchAndServe(originalUrl, res);
    }
    /**
     * 处理静态文件请求
     */
    async handleStaticRequest(reqPath, req, res) {
        // 清理路径
        let cleanPath = reqPath.split('?')[0].split('#')[0];
        if (cleanPath === '/') {
            cleanPath = '/index.html';
        }
        const fullPath = path.join(this.options.outputDir, cleanPath);
        // 安全检查：防止目录遍历
        if (!fullPath.startsWith(this.options.outputDir)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        if (fs.existsSync(fullPath)) {
            await this.serveLocalFile(fullPath, res, this.getMimeType(cleanPath));
        }
        else {
            // 尝试 index.html（支持 SPA）
            const indexPath = path.join(this.options.outputDir, cleanPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                await this.serveLocalFile(indexPath, res, 'text/html');
            }
            else {
                res.writeHead(404);
                res.end('Not Found');
            }
        }
    }
    /**
     * 从原始服务器获取资源
     */
    fetchAndServe(targetUrl, res) {
        const parsed = url.parse(targetUrl);
        const protocol = parsed.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.path,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': '*/*',
            },
        };
        const proxyReq = protocol.request(options, (proxyRes) => {
            // 如果成功，缓存到本地
            if (proxyRes.statusCode === 200) {
                const chunks = [];
                proxyRes.on('data', (chunk) => chunks.push(chunk));
                proxyRes.on('end', async () => {
                    const buffer = Buffer.concat(chunks);
                    // 尝试保存到本地
                    try {
                        const localPath = this.options.resourceQueue.getLocalPath(targetUrl);
                        if (localPath) {
                            const fullPath = path.join(this.options.outputDir, localPath);
                            await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
                            await fs.promises.writeFile(fullPath, buffer);
                        }
                    }
                    catch { }
                    // 返回给客户端
                    res.writeHead(proxyRes.statusCode, {
                        'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
                        'Content-Length': buffer.length,
                    });
                    res.end(buffer);
                });
            }
            else {
                res.writeHead(proxyRes.statusCode);
                proxyRes.pipe(res);
            }
        });
        proxyReq.on('error', (err) => {
            res.writeHead(502);
            res.end(`Bad Gateway: ${err.message}`);
        });
        proxyReq.end();
    }
    /**
     * 服务本地文件
     */
    async serveLocalFile(filePath, res, mimeType) {
        try {
            const buffer = await fs.promises.readFile(filePath);
            res.writeHead(200, {
                'Content-Type': mimeType,
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=31536000',
            });
            res.end(buffer);
        }
        catch (err) {
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
    /**
     * 根据文件路径获取 MIME 类型
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.otf': 'font/otf',
            '.eot': 'application/vnd.ms-fontobject',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}
//# sourceMappingURL=LocalProxyServer.js.map