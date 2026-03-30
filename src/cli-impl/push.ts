/**
 * Theme Push Implementation
 * Pushes a local Dawn theme directory to Shopify via REST Admin API
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface ThemePushConfig {
  store: string;
  token: string;
  apiVersion: string;
  themeDir: string;
}

const CONFIG: ThemePushConfig = {
  store: process.env.SHOPIFY_STORE || 'claw-test-2.myshopify.com',
  token: process.env.SHOPIFY_ACCESS_TOKEN || '',
  apiVersion: '2024-10',
  themeDir: path.join(__dirname, '../../dawn-theme'),
};

async function gql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  const endpoint = `https://${CONFIG.store}/admin/api/${CONFIG.apiVersion}/graphql.json`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': CONFIG.token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  const json = await response.json() as any;
  if (json.errors?.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

async function rest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: any
): Promise<any> {
  const url = `https://${CONFIG.store}/admin/api/${CONFIG.apiVersion}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': CONFIG.token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!response.ok) {
    throw new Error(`REST ${method} ${path} → ${response.status}: ${text.slice(0, 200)}`);
  }
  return json;
}

async function getOrCreateDevTheme(): Promise<{ id: number; name: string }> {
  // Find existing dev theme
  const data = await rest('GET', '/themes.json');
  const themes = data.themes || [];
  
  // Look for a published "dawn-dev" or development theme
  const devTheme = themes.find((t: any) => 
    t.role === 'development' || t.name === 'dawn-dev'
  );
  
  if (devTheme) {
    console.log(`   Using existing dev theme: ${devTheme.name} (ID: ${devTheme.id})`);
    return { id: devTheme.id, name: devTheme.name };
  }
  
  // Create new dev theme
  const created = await rest('POST', '/themes.json', {
    theme: {
      name: 'dawn-dev',
      role: 'development',
      src: 'https://cdn.shopify.com/s/files/1/0551/4566/4701/themes/139652832862/assets/theme.zip?v=1.0.0',
    },
  });
  
  console.log(`   Created new dev theme: ${created.theme.name} (ID: ${created.theme.id})`);
  return { id: created.theme.id, name: created.theme.name };
}

async function uploadAsset(themeId: number, filePath: string, localDir: string): Promise<void> {
  const relativePath = path.relative(localDir, filePath).replace(/\\/g, '/');
  const key = `assets/${relativePath}`;
  
  // Read file as base64 for binary assets or as string for text files
  const ext = path.extname(filePath).toLowerCase();
  const textExtensions = ['.css', '.js', '.json', '.liquid', '.html', '.svg', '.txt', '.xml'];
  
  let value: string;
  if (textExtensions.includes(ext)) {
    value = fs.readFileSync(filePath, 'utf-8');
  } else {
    // Binary - skip for now, theme assets should be mostly text
    return;
  }
  
  await rest('PUT', `/themes/${themeId}/assets.json`, {
    asset: { key, value },
  });
}

async function walkDir(dir: string, baseDir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (!['node_modules', '.git', '.github', '.vscode', 'assets'].includes(entry.name) || 
          entry.name === 'assets') {
        // For assets folder, walk recursively
        if (entry.name === 'assets') {
          files.push(...await walkDir(fullPath, baseDir));
        }
      }
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function uploadThemeAssets(themeId: number, themeDir: string): Promise<void> {
  // Walk the theme directory
  const allFiles: string[] = [];
  
  // Get all files from key directories
  const dirsToProcess = ['layout', 'sections', 'snippets', 'templates', 'locales', 'assets'];
  
  for (const dir of dirsToProcess) {
    const dirPath = path.join(themeDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = await walkDir(dirPath, themeDir);
      allFiles.push(...files);
    }
  }
  
  console.log(`\n   Found ${allFiles.length} files to upload`);
  
  // Upload in batches
  let uploaded = 0;
  let failed = 0;
  
  for (const file of allFiles) {
    try {
      await uploadAsset(themeId, file, themeDir);
      uploaded++;
      if (uploaded % 10 === 0) {
        process.stdout.write(`   Uploaded ${uploaded}/${allFiles.length}\r`);
      }
    } catch (err: any) {
      failed++;
      if (failed <= 5) {
        console.warn(`   ⚠️  Failed: ${path.relative(themeDir, file)} — ${err.message.slice(0, 80)}`);
      }
    }
  }
  
  console.log(`\n   ✅ Uploaded ${uploaded} files${failed > 0 ? `, ${failed} failed` : ''}`);
}

async function main() {
  console.log('\n🚀 Pixel2Liquid Theme Push\n');
  console.log(`   Store: ${CONFIG.store}`);
  console.log(`   Theme: ${CONFIG.themeDir}\n`);
  
  // Get or create dev theme
  console.log('[1/2] Preparing theme on Shopify...');
  const { id: themeId, name: themeName } = await getOrCreateDevTheme();
  
  // Upload assets
  console.log('[2/2] Uploading theme files...');
  await uploadThemeAssets(themeId, CONFIG.themeDir);
  
  console.log(`\n✅ Push complete!`);
  console.log(`   Theme: ${themeName}`);
  console.log(`   Preview: https://${CONFIG.store}/?preview_theme_id=${themeId}`);
  console.log(`   Admin:  https://admin.shopify.com/store/claw-test-2/themes/${themeId}`);
}

main().catch(err => {
  console.error('\n❌ Push failed:', err.message);
  process.exit(1);
});
