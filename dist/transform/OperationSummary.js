/**
 * OperationSummaryGenerator - 操作清单生成
 *
 * 生成需要用户确认的操作清单（消耗 API 点数的操作）
 */
const COST_QUERY = 1; // 查询消耗点数
const COST_CREATE_PRODUCT = 20; // 创建产品消耗点数
const COST_UPLOAD_ASSET = 10; // 上传资源消耗点数
export class OperationSummaryGenerator {
    /**
     * 生成操作清单
     */
    async generate(pages, productMatches, assetMappings, shopifyClient) {
        // 1. 统计只读操作
        const allHandles = pages.flatMap(p => p.productHandles);
        const uniqueHandles = [...new Set(allHandles)];
        // 2. 统计需要创建的产品
        const missingProducts = productMatches.filter(p => !p.matched);
        const productsToCreate = missingProducts.map(p => ({
            type: 'create_product',
            handle: p.sourceHandle,
            title: this.handleToTitle(p.sourceHandle),
            estimatedCost: COST_CREATE_PRODUCT,
        }));
        // 3. 统计需要上传的资源
        const assetsToUpload = assetMappings
            .filter(a => a.targetAssetUrl === null)
            .filter((v, i, arr) => arr.findIndex(a => a.filename === v.filename) === i); // 去重
        const assetsToUploadItems = assetsToUpload.map(a => ({
            type: 'upload_asset',
            handle: a.filename,
            filename: a.filename,
            assetType: a.assetType,
            estimatedCost: COST_UPLOAD_ASSET,
        }));
        // 4. 计算总预估点数
        // 查询消耗：拉取产品列表
        const queryCost = uniqueHandles.length * COST_QUERY;
        const mutationCost = productsToCreate.reduce((sum, p) => sum + p.estimatedCost, 0)
            + assetsToUploadItems.reduce((sum, a) => sum + a.estimatedCost, 0);
        return {
            generatedAt: new Date().toISOString(),
            sourceUrl: pages[0]?.sourceUrl || '',
            readOnly: {
                productsFound: uniqueHandles.length,
                assetsFound: assetMappings.length,
                liquidTemplates: pages.map(p => `sections/${p.handle}.liquid`),
            },
            requiresConfirmation: {
                productsToCreate,
                assetsToUpload: assetsToUploadItems,
                estimatedTotalCost: queryCost + mutationCost,
            },
        };
    }
    /**
     * 生成操作清单的友好展示
     */
    formatSummary(summary) {
        const lines = [];
        lines.push('═══════════════════════════════════════════════');
        lines.push('  Transform 操作清单');
        lines.push('═══════════════════════════════════════════════\n');
        lines.push('📊 只读操作（将自动执行）：');
        lines.push(`   • 解析 HTML 结构`);
        lines.push(`   • 匹配产品（本地，无消耗）`);
        lines.push(`   • 生成 Liquid 模板\n`);
        lines.push('⚠️  以下操作需要确认（消耗 API 点数）：\n');
        // 产品创建
        if (summary.requiresConfirmation.productsToCreate.length > 0) {
            lines.push(`📦 产品创建 (${summary.requiresConfirmation.productsToCreate.length}个)`);
            for (const p of summary.requiresConfirmation.productsToCreate.slice(0, 5)) {
                lines.push(`   ${summary.requiresConfirmation.productsToCreate.indexOf(p) + 1}. ${p.title} (~${p.estimatedCost} 点)`);
            }
            if (summary.requiresConfirmation.productsToCreate.length > 5) {
                lines.push(`   ... 还有 ${summary.requiresConfirmation.productsToCreate.length - 5} 个`);
            }
            lines.push(`   小计: ~${summary.requiresConfirmation.productsToCreate.reduce((s, p) => s + p.estimatedCost, 0)} 点\n`);
        }
        // 资源上传
        if (summary.requiresConfirmation.assetsToUpload.length > 0) {
            lines.push(`🖼️  资源上传 (${summary.requiresConfirmation.assetsToUpload.length}个)`);
            for (const a of summary.requiresConfirmation.assetsToUpload.slice(0, 5)) {
                lines.push(`   ${summary.requiresConfirmation.assetsToUpload.indexOf(a) + 1}. ${a.filename} (~${a.estimatedCost} 点)`);
            }
            if (summary.requiresConfirmation.assetsToUpload.length > 5) {
                lines.push(`   ... 还有 ${summary.requiresConfirmation.assetsToUpload.length - 5} 个`);
            }
            lines.push(`   小计: ~${summary.requiresConfirmation.assetsToUpload.reduce((s, a) => s + a.estimatedCost, 0)} 点\n`);
        }
        lines.push('═══════════════════════════════════════════════');
        lines.push(`  总预估消耗: ~${summary.requiresConfirmation.estimatedTotalCost} 点`);
        lines.push('═══════════════════════════════════════════════\n');
        lines.push('[1] 全部确认执行');
        lines.push('[2] 仅生成模板（手动上传）');
        lines.push('[3] 取消\n');
        lines.push('请输入选项:');
        return lines.join('\n');
    }
    /**
     * 把 handle 转换成可读标题
     */
    handleToTitle(handle) {
        return handle
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}
//# sourceMappingURL=OperationSummary.js.map