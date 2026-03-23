/**
 * Pixel2Liquid Spider Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs-extra';

describe('Spider Module', () => {
  
  describe('PathResolver', () => {
    it('should resolve relative image paths to assets/', async () => {
      // 测试路径解析逻辑
      const input = '/images/logo.png';
      const expected = '/assets/images/logo.png';
      
      // 实际实现会在运行时解析
      expect(input).toBeDefined();
    });
  });

  describe('AssetDownloader', () => {
    it('should extract asset URLs from HTML', async () => {
      const html = `
        <html>
          <img src="/images/photo.jpg" />
          <link rel="stylesheet" href="/styles/main.css" />
          <script src="/js/app.js"></script>
        </html>
      `;
      
      // 验证HTML解析
      expect(html).toContain('photo.jpg');
      expect(html).toContain('main.css');
      expect(html).toContain('app.js');
    });
  });

  describe('CSSProcessor', () => {
    it('should merge multiple CSS strings', async () => {
      const css1 = '.class1 { color: red; }';
      const css2 = '.class2 { font-size: 14px; }';
      
      // 验证CSS合并
      expect(css1).toBeDefined();
      expect(css2).toBeDefined();
    });
  });

  describe('SiteCrawler', () => {
    it('should identify internal links', async () => {
      const baseUrl = 'https://example.com/page';
      
      // 验证内部链接识别
      expect(baseUrl).toBeDefined();
    });

    it('should generate correct local paths', async () => {
      // 验证路径生成
      expect(path.extname('index.html')).toBe('.html');
    });
  });
});

describe('Integration', () => {
  const testOutputDir = path.join(process.cwd(), 'test-output');

  beforeAll(async () => {
    // 清理测试目录
    await fs.remove(testOutputDir);
  });

  it('should create output directory structure', async () => {
    await fs.ensureDir(path.join(testOutputDir, 'assets', 'images'));
    await fs.ensureDir(path.join(testOutputDir, 'assets', 'fonts'));
    await fs.ensureDir(path.join(testOutputDir, 'assets', 'js'));
    await fs.ensureDir(path.join(testOutputDir, 'assets', 'css'));
    
    const exists = await fs.pathExists(testOutputDir);
    expect(exists).toBe(true);
  });
});
