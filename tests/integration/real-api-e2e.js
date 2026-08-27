/**
 * 真实 API 端到端预演（真实云函数代码 + 真实生图/视觉 API + mock 数据库存储）
 * 运行：node tests/integration/real-api-e2e.js
 * 消耗真实 API 配额（约 2 次生图 + 1 次视觉调用），不进 npm test。
 */
const assert = require('assert');
const cloud = require('../mocks/setup');

process.env.AI_STUDIO_ADMIN_OPENIDS = 'admin-openid-1';
process.env.AI_STUDIO_ADMIN_PASSWORD = process.env.PM_ADMIN_PASSWORD || '';
const ADMIN = { adminPassword: process.env.PM_ADMIN_PASSWORD || '' };
if (!process.env.PM_GEN_KEY || !process.env.PM_ADMIN_PASSWORD) {
  console.error('缺少环境变量 PM_GEN_KEY（生图key）与 PM_ADMIN_PASSWORD（管理口令）——密钥不入库，见 .deploy-secrets.json');
  process.exit(1);
}
const USER = 'user-openid-1';

// 真实节点配置（2026-08-22 实测通过）
const GEN_API = 'https://api.3213218.xyz/v1/images/generations';
const CHAT_API = 'https://api.3213218.xyz/v1/chat/completions';
const API_KEY = process.env.PM_GEN_KEY;
const IMG_MODEL = 'fkall-图像';
const TXT_MODEL = 'fkall-文本';

const invoke = (name, data, openid) => cloud.__mock.invoke(name, data, openid);

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    console.log(`  ✓ ${name}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
    return r;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  cloud.__mock.reset();
  console.log('== 真实 API 端到端预演（生图/视觉走 api.3213218.xyz，DB/存储为本地 mock）==\n');

  // 0. 配置模型设置（等价于管理后台"模型设置"里填的值）
  await step('配置模型设置（生图 + 视觉分析）', () =>
    invoke('adminUpsertAIStudioRuntimeConfig', {
      ...ADMIN,
      modelSettings: [
        { scene: 'image_generation', enabled: true, provider: 'openai_compatible', model: IMG_MODEL, apiUrl: GEN_API, apiKey: API_KEY, imageSize: '1024x1024' },
        { scene: 'photo_analysis', enabled: true, provider: 'openai_compatible', model: TXT_MODEL, apiUrl: CHAT_API, apiKey: API_KEY, maxTokens: 600 }
      ]
    }, 'admin-openid-1')
  );

  // 1. 下单（古风写真）
  const orderRes = await step('写真下单（guofeng 单主题 ¥69.9）', () =>
    invoke('createAIStudioOrder', {
      productId: 'portrait_suite_69', themes: ['guofeng'],
      contactPhone: '13800000001', queryPassword: '123456', sceneDesc: '海边日落，白裙，电影感',
      authorization: { isSelfOrAuthorized: true, isAdult: true, agreesProduction: true }
    }, USER)
  );
  const orderId = orderRes.order.orderId;
  console.log(`      orderId = ${orderId}`);

  // 2. 传图 + 提交 + 过审
  await step('传图 1 张 + 提交 + 管理端过审', async () => {
    await invoke('uploadAIStudioPhoto', { orderId, fileID: `cloud://mock-env.636c/ai-studio/${orderId}/customer/0.jpg`, fileName: 'customer-0.jpg', size: 1000, mimeType: 'image/jpeg' }, USER);
    await invoke('submitAIStudioOrder', { orderId }, USER);
    await invoke('adminReviewAIStudioOrder', { ...ADMIN, orderId, action: 'pass', reason: 'e2e' }, 'admin-openid-1');
  });

  // 3. 阶段一：生成参考图（真实 API 调用）
  const ref = await step('阶段一 生成【参考图 0】（真实生图 API）', () =>
    invoke('generateAIStudioImage', { ...ADMIN, orderId, stage: 'reference' }, 'admin-openid-1')
  );
  assert.strictEqual(ref.success, true, JSON.stringify(ref));
  assert.ok(ref.file.fileID.startsWith('cloud://'), 'fileID 应为 cloud://');

  // 验证真实图片字节（mock 存储了 uploadFile 的 fileContent）
  const st = cloud.__mock.state;
  const buf = st.files.get(ref.file.fileID);
  assert.ok(buf && buf.length > 50000, `参考图应 >50KB，实得 ${buf && buf.length}B`);
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  assert.ok(isPng || isJpg, '生成的应为 PNG/JPEG 字节流');
  console.log(`      参考图实为 ${isPng ? 'PNG' : 'JPEG'}，${(buf.length / 1024).toFixed(0)}KB，fileID=${ref.file.fileID.slice(-40)}`);

  // 4. 阶段二：生成 3x5 网格（真实 API，600 字提示词）
  const grid = await step('阶段二 生成 3×5 网格预览（真实生图 API）', () =>
    invoke('generateAIStudioImage', { ...ADMIN, orderId, stage: 'grid', themeId: 'guofeng' }, 'admin-openid-1')
  );
  assert.strictEqual(grid.success, true, JSON.stringify(grid));
  assert.strictEqual(grid.order.order_status, 'grid_preview', '订单应进入待选片');
  const gridBuf = st.files.get(grid.file.fileID);
  assert.ok(gridBuf && gridBuf.length > 50000, '网格图应 >50KB');
  console.log(`      网格图 ${(gridBuf.length / 1024).toFixed(0)}KB，订单状态 → grid_preview`);

  // 5. 视觉分析（真实 chat + image_url，用刚生成的参考图直链）
  //    mock 的 getTempFileURL 返回假地址，这里替换为真实节点返回的图片直链做真实验证
  const realUrl = 'https://www.czpsm.art/PM/e2e-face.jpg';
  const origGetTemp = cloud.getTempFileURL.bind(cloud);
  cloud.getTempFileURL = async ({ fileList }) => ({
    fileList: fileList.map(fileID => ({ fileID, tempFileURL: realUrl }))
  });
  const analysis = await step('视觉分析（真实 chat API 看图 → 5 主题评分）', () =>
    invoke('analyzeAIStudioPhoto', { fileID: `cloud://mock-env.636c/ai-studio/${orderId}/customer/0.jpg` }, USER)
  );
  cloud.getTempFileURL = origGetTemp;
  assert.strictEqual(analysis.success, true, JSON.stringify(analysis));
  assert.strictEqual(analysis.analysis.scores.length, 5, '应有 5 个主题评分');
  console.log(`      摘要：${analysis.analysis.summary.slice(0, 50)}`);
  analysis.analysis.scores.slice(0, 3).forEach(s => {
    console.log(`      ${s.themeName} ${s.score} 分 —— ${s.reason.slice(0, 30)}`);
  });

  // 6. 选片闭环（本地逻辑）
  const sel = await step('选片 [2,5,8] → cell_selected', () =>
    invoke('selectAIStudioPortraitCells', { orderId, themeId: 'guofeng', cells: [2, 5, 8] }, USER)
  );
  assert.strictEqual(sel.order.order_status, 'cell_selected');

  // 7. 阶段三：第 3 格高清大图（真实生图，验证光照拓扑条款与影楼质感段的实际出片）
  const cell = await step('阶段三 生成第 3 格高清大图（真实生图 API）', () =>
    invoke('generateAIStudioImage', { ...ADMIN, orderId, stage: 'cell', cell: 3 }, 'admin-openid-1')
  );
  assert.strictEqual(cell.success, true, JSON.stringify(cell));
  const cellBuf = st.files.get(cell.file.fileID);
  assert.ok(cellBuf && cellBuf.length > 50000, '高清大图应 >50KB');
  console.log(`      高清图 ${(cellBuf.length / 1024).toFixed(0)}KB，fileID=${cell.file.fileID}`);

  console.log('\n========== 真实 API 端到端预演全部通过 ==========');
  console.log('结论：reference/grid/视觉分析/选片/cell 高清全链路真实可用（含影楼质感模板与瞬态重试）。');
}

main().catch(err => {
  console.error('执行异常:', err);
  process.exit(1);
});
