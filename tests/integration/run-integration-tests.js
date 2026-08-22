/**
 * 光影集 PhotoMuse 集成测试（本地内存数据库，真实执行云函数逻辑）
 * 运行：npm run test:integration
 * 覆盖：下单计价（standard/单主题兼容/多主题阶梯）→ 传图/提交 → 管理审核 →
 *       分主题网格选片 → 交付 → 周边选择计价 → 制作流转 → 制作稿导出 →
 *       凭据查询脱敏 → 收款码 → 业务配置 → AI 函数配置缺失路径 → 开放网关
 */
const assert = require('assert');
const cloud = require('../mocks/setup');

process.env.AI_STUDIO_ADMIN_OPENIDS = 'admin-openid-1';
process.env.AI_STUDIO_ADMIN_PASSWORD = 'test-admin-pw';
process.env.AI_STUDIO_OPEN_API_KEYS = 'test-api-key';

const ADMIN = { adminPassword: 'test-admin-pw' };
const USER = 'user-openid-1';
const USER2 = 'user-openid-2';

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ✓ ' + name);
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
    console.error('  ✗ ' + name + '\n      ' + (err && err.message));
  }
}

const invoke = (name, data, openid) => cloud.__mock.invoke(name, data, openid);

async function getOrder(orderId) {
  const docs = cloud.__mock.snapshot('ai_studio_orders').filter(o => o.orderId === orderId);
  return docs[0];
}

function createOrderPayload(overrides = {}) {
  return {
    productId: 'portrait_suite_69',
    themes: ['guofeng'],
    contactPhone: '13800000001',
    queryPassword: '123456',
    authorization: { isSelfOrAuthorized: true, isAdult: true, agreesProduction: true },
    sceneDesc: '海边日落，白裙',
    ...overrides
  };
}

/** 造一条已过审（queued）的多主题订单，返回 orderId */
async function makeQueuedMultiThemeOrder(themeIds) {
  const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: themeIds }), USER);
  const orderId = res.order.orderId;
  for (let i = 0; i < 2; i += 1) {
    await invoke('uploadAIStudioPhoto', {
      orderId, fileID: `cloud://mock-env.636c/ai-studio/${orderId}/customer/${i}.jpg`,
      fileName: `customer-${i}.jpg`, size: 1000, mimeType: 'image/jpeg'
    }, USER);
  }
  await invoke('submitAIStudioOrder', { orderId }, USER);
  await invoke('adminReviewAIStudioOrder', { ...ADMIN, orderId, action: 'pass', reason: '测试通过' }, 'admin-openid-1');
  return orderId;
}

async function main() {
  console.log('\n== A. 下单与阶梯计价 ==');

  await test('A1 standard 证件照下单：价格/张数/状态正确', async () => {
    const res = await invoke('createAIStudioOrder', {
      productId: 'id_photo_9_9', styleId: 'ID-01',
      contactPhone: '13800000001', queryPassword: '123456',
      authorization: { isSelfOrAuthorized: true, isAdult: true, agreesProduction: true }
    }, USER);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.order.order_status, 'waiting_photos');
    const order = await getOrder(res.order.orderId);
    assert.strictEqual(order.price, 3.9);
    assert.strictEqual(order.deliveryCount, 1);
    assert.strictEqual(order.product_type, 'standard');
    assert.strictEqual(order.payment_status, 'unpaid');
    assert.strictEqual(order.source, 'miniprogram');
  });

  await test('A2 portrait 单主题（旧 themeId 入参兼容）：¥69.9 / 5 张', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: undefined, themeId: 'sports' }), USER);
    const order = await getOrder(res.order.orderId);
    assert.strictEqual(order.price, 69.9);
    assert.strictEqual(order.deliveryCount, 5);
    assert.strictEqual(order.theme_count, 1);
    assert.strictEqual(order.themes[0].themeId, 'sports');
    assert.strictEqual(order.theme_name, order.themes[0].themeName);
  });

  await test('A3 多主题 2 个：¥109.8 / 10 张 / theme_count=2', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['guofeng', 'sports'] }), USER);
    const order = await getOrder(res.order.orderId);
    assert.strictEqual(order.price, 109.8);
    assert.strictEqual(order.deliveryCount, 10);
    assert.strictEqual(order.theme_count, 2);
  });

  await test('A4 多主题 3 个（上限）：¥149.7 / 15 张', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['guofeng', 'sports', 'travel'] }), USER);
    const order = await getOrder(res.order.orderId);
    assert.strictEqual(order.price, 149.7);
    assert.strictEqual(order.deliveryCount, 15);
  });

  await test('A5 超上限 4 主题：拒绝且文案含 1-3', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['guofeng', 'sports', 'travel', 'family'] }), USER);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'VALIDATION_ERROR');
    assert.ok(res.message.includes('1-3'));
  });

  await test('A6 非法主题：拒绝', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['hacker'] }), USER);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'VALIDATION_ERROR');
  });

  await test('A7 缺授权：AUTHORIZATION_REQUIRED', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ authorization: {} }), USER);
    assert.strictEqual(res.code, 'AUTHORIZATION_REQUIRED');
  });

  await test('A8 未登录：UNAUTHENTICATED', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload(), undefined);
    assert.strictEqual(res.code, 'UNAUTHENTICATED');
  });

  await test('A9 查询密码哈希入库（SHA-256），原文不落库', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload(), USER);
    const order = await getOrder(res.order.orderId);
    const crypto = require('crypto');
    assert.strictEqual(order.queryPasswordHash, crypto.createHash('sha256').update('123456').digest('hex'));
    assert.ok(!JSON.stringify(order).includes('"queryPassword":"123456"'));
  });

  console.log('\n== B. 传图与提交 ==');

  const orderB = await makeQueuedMultiThemeOrder(['guofeng']);

  await test('B1 上传 3 张成功，计数递增', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['casual'] }), USER);
    const oid = res.order.orderId;
    for (let i = 0; i < 3; i += 1) {
      const r = await invoke('uploadAIStudioPhoto', {
        orderId: oid, fileID: `cloud://mock-env.636c/ai-studio/${oid}/customer/${i}.jpg`,
        fileName: `customer-${i}.jpg`, size: 2048, mimeType: 'image/jpeg'
      }, USER);
      assert.strictEqual(r.success, true);
      assert.strictEqual(r.referencePhotoCount, i + 1);
    }
  });

  await test('B2 第 4 张：PHOTO_LIMIT_EXCEEDED', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['casual'] }), USER);
    const oid = res.order.orderId;
    for (let i = 0; i < 3; i += 1) {
      await invoke('uploadAIStudioPhoto', { orderId: oid, fileID: `cloud://x/${i}.jpg`, fileName: `${i}.jpg`, size: 1, mimeType: 'image/jpeg' }, USER);
    }
    const r = await invoke('uploadAIStudioPhoto', { orderId: oid, fileID: 'cloud://x/4.jpg', fileName: '4.jpg', size: 1, mimeType: 'image/jpeg' }, USER);
    assert.strictEqual(r.code, 'PHOTO_LIMIT_EXCEEDED');
  });

  await test('B3 非本人订单上传：NOT_FOUND', async () => {
    const r = await invoke('uploadAIStudioPhoto', { orderId: orderB, fileID: 'cloud://x/9.jpg', fileName: '9.jpg', size: 1, mimeType: 'image/jpeg' }, USER2);
    assert.strictEqual(r.code, 'NOT_FOUND');
  });

  await test('B4 无照片提交：PHOTO_REQUIRED', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['casual'] }), USER);
    const r = await invoke('submitAIStudioOrder', { orderId: res.order.orderId }, USER);
    assert.strictEqual(r.code, 'PHOTO_REQUIRED');
  });

  console.log('\n== C. 管理审核（鉴权与状态流转） ==');

  await test('C1 错误口令：FORBIDDEN', async () => {
    const r = await invoke('adminReviewAIStudioOrder', { adminPassword: 'wrong', orderId: orderB, action: 'pass' }, 'admin-openid-1');
    assert.strictEqual(r.code, 'FORBIDDEN');
  });

  await test('C2 非白名单 openid：FORBIDDEN', async () => {
    const r = await invoke('adminReviewAIStudioOrder', { ...ADMIN, orderId: orderB, action: 'pass' }, USER2);
    assert.strictEqual(r.code, 'FORBIDDEN');
  });

  const orderC = await makeQueuedMultiThemeOrder(['guofeng']);

  await test('C3 need_retake：回 waiting_photos，旧照片置 retake_requested', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['casual'] }), USER);
    const oid = res.order.orderId;
    await invoke('uploadAIStudioPhoto', { orderId: oid, fileID: 'cloud://x/a.jpg', fileName: 'a.jpg', size: 1, mimeType: 'image/jpeg' }, USER);
    await invoke('submitAIStudioOrder', { orderId: oid }, USER);
    const r = await invoke('adminReviewAIStudioOrder', { ...ADMIN, orderId: oid, action: 'need_retake' }, 'admin-openid-1');
    assert.strictEqual(r.success, true);
    const order = await getOrder(oid);
    assert.strictEqual(order.order_status, 'waiting_photos');
    assert.strictEqual(order.photo_check, 'need_retake');
    const files = cloud.__mock.snapshot('ai_studio_files').filter(f => f.orderId === oid && f.fileType === 'customer_photo');
    assert.ok(files.every(f => f.status === 'retake_requested'));
  });

  await test('C4 reject：cancelled', async () => {
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['casual'] }), USER);
    const oid = res.order.orderId;
    await invoke('uploadAIStudioPhoto', { orderId: oid, fileID: 'cloud://x/b.jpg', fileName: 'b.jpg', size: 1, mimeType: 'image/jpeg' }, USER);
    await invoke('submitAIStudioOrder', { orderId: oid }, USER);
    const r = await invoke('adminReviewAIStudioOrder', { ...ADMIN, orderId: oid, action: 'reject' }, 'admin-openid-1');
    assert.strictEqual(r.success, true);
    assert.strictEqual((await getOrder(oid)).order_status, 'cancelled');
  });

  console.log('\n== D. 分主题网格与选片（多主题） ==');

  const orderD = await makeQueuedMultiThemeOrder(['guofeng', 'sports']);
  const gridFile = theme => `cloud://mock-env.636c/ai-studio/${orderD}/grid/${theme}.jpg`;

  await test('D1 上传 guofeng 网格：文件带 themeId，订单进 grid_preview', async () => {
    const r = await invoke('adminUploadAIStudioGridPreview', {
      ...ADMIN, orderId: orderD, themeId: 'guofeng', fileID: gridFile('guofeng'),
      fileName: 'grid-guofeng.jpg', size: 5000, mimeType: 'image/jpeg'
    }, 'admin-openid-1');
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.order.order_status, 'grid_preview');
    const file = cloud.__mock.snapshot('ai_studio_files').find(f => f.fileID === gridFile('guofeng'));
    assert.strictEqual(file.themeId, 'guofeng');
    assert.strictEqual(file.fileType, 'grid_preview');
  });

  await test('D2 上传不属于订单的主题网格：拒绝', async () => {
    const r = await invoke('adminUploadAIStudioGridPreview', {
      ...ADMIN, orderId: orderD, themeId: 'family', fileID: gridFile('family'),
      fileName: 'grid-family.jpg', size: 5000, mimeType: 'image/jpeg'
    }, 'admin-openid-1');
    assert.strictEqual(r.success, false);
  });

  await test('D3 guofeng 选片 [1,2,3]：仍 grid_preview（还差 sports）', async () => {
    const r = await invoke('selectAIStudioPortraitCells', { orderId: orderD, themeId: 'guofeng', cells: [1, 2, 3] }, USER);
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.order.order_status, 'grid_preview');
    const order = await getOrder(orderD);
    assert.deepStrictEqual(order.themes.find(t => t.themeId === 'guofeng').selectedCells, [1, 2, 3]);
  });

  await test('D4 超每主题上限 5 个：拒绝且文案 1-5', async () => {
    const r = await invoke('selectAIStudioPortraitCells', { orderId: orderD, themeId: 'sports', cells: [1, 2, 3, 4, 5, 6] }, USER);
    assert.strictEqual(r.success, false);
    assert.ok(r.message.includes('1-5'));
  });

  await test('D5 sports 选片后全部主题完成：cell_selected', async () => {
    const r = await invoke('selectAIStudioPortraitCells', { orderId: orderD, themeId: 'sports', cells: [2, 4, 6, 8, 10] }, USER);
    assert.strictEqual(r.order.order_status, 'cell_selected');
    const order = await getOrder(orderD);
    assert.ok(order.themes.every(t => t.selectedCells.length > 0));
    assert.ok(order.cell_selected_at);
  });

  await test('D6 已选完再选：INVALID_STATUS', async () => {
    const r = await invoke('selectAIStudioPortraitCells', { orderId: orderD, themeId: 'guofeng', cells: [1] }, USER);
    assert.strictEqual(r.code, 'INVALID_STATUS');
  });

  console.log('\n== E. 交付与周边（计价） ==');

  const deliveryFiles = [
    { fileID: `cloud://mock-env.636c/ai-studio/${orderD}/delivery/1.jpg`, fileName: 'd1.jpg', size: 9000, mimeType: 'image/jpeg' },
    { fileID: `cloud://mock-env.636c/ai-studio/${orderD}/delivery/2.jpg`, fileName: 'd2.jpg', size: 9000, mimeType: 'image/jpeg' }
  ];

  await test('E1 管理端交付 2 张：订单 delivered，delivery_file_count=2', async () => {
    const r = await invoke('adminDeliverAIStudioOrder', { ...ADMIN, orderId: orderD, deliveryFiles, deliveryNote: '测试交付' }, 'admin-openid-1');
    assert.strictEqual(r.success, true);
    const order = await getOrder(orderD);
    assert.strictEqual(order.order_status, 'delivered');
    assert.strictEqual(order.delivery_file_count, 2);
  });

  await test('E2 selectMerch：wall_8×2 + calendar×1 = ¥137，进 merch_pending', async () => {
    const r = await invoke('selectAIStudioMerch', {
      orderId: orderD,
      items: [
        { merchId: 'wall_8', fileID: deliveryFiles[0].fileID, qty: 2 },
        { merchId: 'calendar', fileID: deliveryFiles[1].fileID, qty: 1 }
      ]
    }, USER);
    assert.strictEqual(r.success, true, JSON.stringify(r));
    assert.strictEqual(r.order.order_status, 'merch_pending');
    assert.strictEqual(r.order.merch_total, 137);
    const order = await getOrder(orderD);
    assert.strictEqual(order.merch_items.length, 2);
    assert.ok(order.merch_items[0].merchItemId);
  });

  await test('E3 fileID 不属于订单：拒绝', async () => {
    const orderE = await (async () => {
      const oid = await makeQueuedMultiThemeOrder(['guofeng']);
      await invoke('adminDeliverAIStudioOrder', { ...ADMIN, orderId: oid, deliveryFiles: [{ fileID: `cloud://x/${oid}/d.jpg`, fileName: 'd.jpg', size: 1, mimeType: 'image/jpeg' }] }, 'admin-openid-1');
      return oid;
    })();
    const r = await invoke('selectAIStudioMerch', {
      orderId: orderE, items: [{ merchId: 'wallet', fileID: 'cloud://x/not-exist.jpg', qty: 1 }]
    }, USER);
    assert.strictEqual(r.success, false);
  });

  await test('E4 网站订单全链路（webToken）：下单→传图→提交审核→过审→网格→选片→交付→选周边', async () => {
    // 网关建单（双主题）
    const gw = await invoke('photomuseOpenApi', {
      apiKey: 'test-api-key', action: 'createOrder',
      payload: { productId: 'portrait_suite_69', themes: ['travel', 'family'], contactPhone: '13800000002', queryPassword: 'abcdef', authorization: { isSelfOrAuthorized: true, isAdult: true, agreesProduction: true } }
    }, undefined);
    assert.strictEqual(gw.success, true, JSON.stringify(gw));
    const oid = gw.order.orderId;
    const token = gw.order.webToken;

    // 无 OPENID 的直调应被拒（网站只能走网关）
    const direct = await invoke('getAIStudioOrderDetail', { orderId: oid }, undefined);
    assert.strictEqual(direct.code, 'UNAUTHENTICATED');

    // 未传图先提交：PHOTO_REQUIRED
    const early = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'submitOrder', payload: { orderId: oid, webToken: token } }, undefined);
    assert.strictEqual(early.code, 'PHOTO_REQUIRED');

    // 网关传图 ×2
    for (let i = 0; i < 2; i += 1) {
      const r = await invoke('photomuseOpenApi', {
        apiKey: 'test-api-key', action: 'registerPhoto',
        payload: { orderId: oid, webToken: token, fileID: `cloud://x/${oid}/w${i}.jpg`, fileName: `w${i}.jpg`, size: 100, mimeType: 'image/jpeg' }
      }, undefined);
      assert.strictEqual(r.success, true);
    }

    // 提交审核 → photo_review
    const submit = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'submitOrder', payload: { orderId: oid, webToken: token } }, undefined);
    assert.strictEqual(submit.success, true, JSON.stringify(submit));
    assert.strictEqual(submit.order.order_status, 'photo_review');
    assert.strictEqual(submit.order.reference_photo_count, 2);

    // 错误 webToken 提交：NOT_FOUND
    const badSubmit = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'submitOrder', payload: { orderId: oid, webToken: 'wrong' } }, undefined);
    assert.strictEqual(badSubmit.code, 'NOT_FOUND');

    // 管理端过审 + 上传双主题网格
    await invoke('adminReviewAIStudioOrder', { ...ADMIN, orderId: oid, action: 'pass', reason: 'web 单通过' }, 'admin-openid-1');
    for (const theme of ['travel', 'family']) {
      const r = await invoke('adminUploadAIStudioGridPreview', { ...ADMIN, orderId: oid, themeId: theme, fileID: `cloud://x/${oid}/grid-${theme}.jpg`, fileName: `grid-${theme}.jpg`, size: 1, mimeType: 'image/jpeg' }, 'admin-openid-1');
      assert.strictEqual(r.success, true, theme + ' 网格上传失败: ' + JSON.stringify(r));
    }

    // 网关 selectCells（三元组凭据）逐主题选片 → cell_selected
    const triple = { contactPhone: '13800000002', queryPassword: 'abcdef' };
    const s1 = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'selectCells', payload: { orderId: oid, themeId: 'travel', cells: [1, 2], ...triple } }, undefined);
    assert.strictEqual(s1.success, true, JSON.stringify(s1));
    assert.strictEqual(s1.order.order_status, 'grid_preview');
    const s2 = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'selectCells', payload: { orderId: oid, themeId: 'family', cells: [3], ...triple } }, undefined);
    assert.strictEqual(s2.order.order_status, 'cell_selected');

    // 管理端交付 → 网关 selectMerch（webToken）
    const dFile = { fileID: `cloud://x/${oid}/d1.jpg`, fileName: 'd1.jpg', size: 1, mimeType: 'image/jpeg' };
    await invoke('adminDeliverAIStudioOrder', { ...ADMIN, orderId: oid, deliveryFiles: [dFile], deliveryNote: 'web 单交付' }, 'admin-openid-1');
    const merch = await invoke('photomuseOpenApi', {
      apiKey: 'test-api-key', action: 'selectMerch',
      payload: { orderId: oid, webToken: token, items: [{ merchId: 'album', fileID: dFile.fileID, qty: 1 }] }
    }, undefined);
    assert.strictEqual(merch.success, true, JSON.stringify(merch));
    assert.strictEqual(merch.order.merch_total, 69);

    // 错误 webToken 选周边：NOT_FOUND
    const badMerch = await invoke('photomuseOpenApi', {
      apiKey: 'test-api-key', action: 'selectMerch',
      payload: { orderId: oid, webToken: 'wrong', items: [{ merchId: 'album', fileID: dFile.fileID, qty: 1 }] }
    }, undefined);
    assert.strictEqual(badMerch.code, 'NOT_FOUND');
  });

  console.log('\n== F. 制作流转 ==');

  await test('F1 start → in_production；ship 带 trackingNo → completed', async () => {
    const r1 = await invoke('adminUpdateMerchProduction', { ...ADMIN, orderId: orderD, action: 'start' }, 'admin-openid-1');
    assert.strictEqual(r1.order.order_status, 'in_production');
    const r2 = await invoke('adminUpdateMerchProduction', { ...ADMIN, orderId: orderD, action: 'ship', trackingNo: 'SF123456' }, 'admin-openid-1');
    assert.strictEqual(r2.order.order_status, 'completed');
    const order = await getOrder(orderD);
    assert.strictEqual(order.trackingNo, 'SF123456');
  });

  console.log('\n== G. 印刷制作稿 ==');

  await test('G1 exportPrintFile（merchItemId）：300DPI 目标像素正确 + 制作单 + 落库', async () => {
    const order = await getOrder(orderD);
    const item = order.merch_items[0]; // wall_8: 203×254mm + 3mm 出血 ×2
    const r = await invoke('exportAIStudioPrintFile', { ...ADMIN, orderId: orderD, merchItemId: item.merchItemId }, 'admin-openid-1');
    assert.strictEqual(r.success, true, JSON.stringify(r));
    const w = Math.round((203 + 6) / 25.4 * 300);
    const h = Math.round((254 + 6) / 25.4 * 300);
    assert.ok(Math.abs(r.print.targetPixels.w - w) <= 2, `期望宽≈${w}，实得 ${r.print.targetPixels.w}`);
    assert.ok(Math.abs(r.print.targetPixels.h - h) <= 2, `期望高≈${h}，实得 ${r.print.targetPixels.h}`);
    const prints = cloud.__mock.snapshot('ai_studio_files').filter(f => f.orderId === orderD && f.fileType === 'print');
    const tickets = cloud.__mock.snapshot('ai_studio_files').filter(f => f.orderId === orderD && f.fileType === 'print_ticket');
    assert.strictEqual(prints.length, 1);
    assert.strictEqual(tickets.length, 1);
  });

  console.log('\n== H. 凭据查询脱敏 ==');

  await test('H1 三元组查询：剥离 queryPasswordHash 与 web_token_hash', async () => {
    const r = await invoke('queryAIStudioOrder', { orderId: orderD, contactPhone: '13800000001', queryPassword: '123456' }, undefined);
    assert.strictEqual(r.success, true);
    assert.ok(!('queryPasswordHash' in r.order));
    assert.ok(!('web_token_hash' in r.order));
    assert.ok(r.files.length > 0);
  });

  await test('H2 错误密码：NOT_FOUND', async () => {
    const r = await invoke('queryAIStudioOrder', { orderId: orderD, contactPhone: '13800000001', queryPassword: '000000' }, undefined);
    assert.strictEqual(r.code, 'NOT_FOUND');
  });

  console.log('\n== I. 收款码 ==');

  await test('I1 未配置：config null；配置后可读；标记已支付幂等', async () => {
    const empty = await invoke('getAIStudioPaymentQR', {}, USER);
    assert.strictEqual(empty.config, null);
    const set = await invoke('adminSetAIStudioPaymentQR', { ...ADMIN, fileID: 'cloud://mock/qr.png', note: '微信收款码' }, 'admin-openid-1');
    assert.strictEqual(set.success, true);
    const got = await invoke('getAIStudioPaymentQR', {}, USER);
    assert.strictEqual(got.config.fileID, 'cloud://mock/qr.png');
    const paid1 = await invoke('adminMarkAIStudioOrderPaid', { ...ADMIN, orderId: orderD }, 'admin-openid-1');
    assert.strictEqual(paid1.order.payment_status, 'paid');
    const order = await getOrder(orderD);
    const paidAt1 = order.paidAt;
    const paid2 = await invoke('adminMarkAIStudioOrderPaid', { ...ADMIN, orderId: orderD }, 'admin-openid-1');
    assert.strictEqual(paid2.success, true);
    const order2 = await getOrder(orderD);
    assert.deepStrictEqual(order2.paidAt, paidAt1, '幂等场景不应重写 paidAt');
  });

  console.log('\n== J. 业务配置 ==');

  await test('J1 默认定价；管理端改价后生效', async () => {
    const def = await invoke('getAIStudioBusinessConfig', {}, USER);
    assert.deepStrictEqual(def.config, { baseThemePrice: 69.9, extraThemePrice: 39.9, maxThemes: 3, photosPerTheme: 5 });
    await invoke('adminUpsertAIStudioBusinessConfig', { ...ADMIN, config: { baseThemePrice: 99, extraThemePrice: 50, maxThemes: 2, photosPerTheme: 6 } }, 'admin-openid-1');
    const upd = await invoke('getAIStudioBusinessConfig', {}, USER);
    assert.strictEqual(upd.config.baseThemePrice, 99);
    assert.strictEqual(upd.config.maxThemes, 2);
    // 新订单按新价
    const res = await invoke('createAIStudioOrder', createOrderPayload({ themes: ['guofeng', 'sports'] }), USER);
    assert.strictEqual((await getOrder(res.order.orderId)).price, 149);
    // 还原默认，避免影响后续
    await invoke('adminUpsertAIStudioBusinessConfig', { ...ADMIN, config: { baseThemePrice: 69.9, extraThemePrice: 39.9, maxThemes: 3, photosPerTheme: 5 } }, 'admin-openid-1');
  });

  await test('J2 定价非法值：拒绝', async () => {
    const r = await invoke('adminUpsertAIStudioBusinessConfig', { ...ADMIN, config: { baseThemePrice: 69.9, extraThemePrice: 39.9, maxThemes: 9, photosPerTheme: 5 } }, 'admin-openid-1');
    assert.strictEqual(r.success, false);
  });

  console.log('\n== K. AI 函数配置缺失路径 ==');

  await test('K1 analyzeAIStudioPhoto 未配置视觉模型：CONFIG_MISSING', async () => {
    const r = await invoke('analyzeAIStudioPhoto', { fileID: 'cloud://mock/a.jpg' }, USER);
    assert.strictEqual(r.code, 'CONFIG_MISSING');
    assert.ok(r.message.includes('photo_analysis'));
  });

  await test('K2 generateAIStudioImage 未配置生图接口：CONFIG_MISSING', async () => {
    const r = await invoke('generateAIStudioImage', { ...ADMIN, orderId: orderD, stage: 'reference' }, 'admin-openid-1');
    assert.strictEqual(r.code, 'CONFIG_MISSING');
  });

  await test('K2b 证件照引擎未配置（idphoto 阶段）：CONFIG_MISSING 且提示 idphoto_engine', async () => {
    const res = await invoke('createAIStudioOrder', {
      productId: 'id_photo_9_9', styleId: 'ID-01',
      contactPhone: '13800000001', queryPassword: '123456', spec: '一寸', backgroundColor: '蓝底',
      authorization: { isSelfOrAuthorized: true, isAdult: true, agreesProduction: true }
    }, USER);
    const r = await invoke('generateAIStudioImage', { ...ADMIN, orderId: res.order.orderId, stage: 'idphoto' }, 'admin-openid-1');
    assert.strictEqual(r.code, 'CONFIG_MISSING');
    assert.ok(r.message.includes('idphoto_engine') || r.message.includes('证件照引擎'));
  });

  await test('K2c portrait 订单走 idphoto 阶段：拒绝并提示用生图接口', async () => {
    const r = await invoke('generateAIStudioImage', { ...ADMIN, orderId: orderD, stage: 'idphoto' }, 'admin-openid-1');
    assert.strictEqual(r.code, 'VALIDATION_ERROR');
    assert.ok(r.message.includes('证件照'));
  });

  await test('K2d 配置引擎但不可达：GENERATION_FAILED（ECONNREFUSED 快失败）', async () => {
    await invoke('adminUpsertAIStudioRuntimeConfig', {
      ...ADMIN,
      modelSettings: [{ scene: 'idphoto_engine', enabled: true, provider: 'hivision', apiUrl: 'http://127.0.0.1:1' }]
    }, 'admin-openid-1');
    const res = await invoke('createAIStudioOrder', {
      productId: 'id_photo_9_9', styleId: 'ID-01',
      contactPhone: '13800000001', queryPassword: '123456',
      authorization: { isSelfOrAuthorized: true, isAdult: true, agreesProduction: true }
    }, USER);
    const oid = res.order.orderId;
    await invoke('uploadAIStudioPhoto', { orderId: oid, fileID: `cloud://x/${oid}/c1.jpg`, fileName: 'c1.jpg', size: 100, mimeType: 'image/jpeg' }, USER);
    const r = await invoke('generateAIStudioImage', { ...ADMIN, orderId: oid, stage: 'idphoto' }, 'admin-openid-1');
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'GENERATION_FAILED');
  });

  await test('K3 配置模型设置后 apiKey 不回传（getRuntimeConfig 脱敏）', async () => {
    await invoke('adminUpsertAIStudioRuntimeConfig', {
      ...ADMIN,
      modelSettings: [{ scene: 'image_generation', enabled: true, provider: 'openai_compatible', model: 'cogview-4', apiUrl: 'https://x/v1/images/generations', apiKey: 'sk-secret', imageSize: '1024x1024' }]
    }, 'admin-openid-1');
    const cfg = await invoke('getAIStudioRuntimeConfig', {}, USER);
    const gen = cfg.config.modelSettings.find(s => s.scene === 'image_generation');
    assert.strictEqual(gen.apiUrl, 'https://x/v1/images/generations');
    assert.ok(!('apiKey' in gen));
    assert.ok(!JSON.stringify(cfg).includes('sk-secret'));
  });

  console.log('\n== L. 样张与周边目录 ==');

  await test('L1 样张：默认空；管理端登记/禁用/删除', async () => {
    const empty = await invoke('listAIStudioSamples', {}, USER);
    assert.deepStrictEqual(empty.data, []);
    const up = await invoke('adminUpsertAIStudioSamples', { ...ADMIN, samples: [{ themeId: 'guofeng', fileID: 'cloud://mock/s1.jpg', caption: '古风样张', sortOrder: 1 }] }, 'admin-openid-1');
    assert.strictEqual(up.success, true);
    const list = await invoke('listAIStudioSamples', {}, USER);
    assert.strictEqual(list.data.length, 1);
    assert.strictEqual(list.data[0].themeId, 'guofeng');
    const rm = await invoke('adminUpsertAIStudioSamples', { ...ADMIN, samples: [], removeSampleIds: [list.data[0].sampleId] }, 'admin-openid-1');
    assert.strictEqual(rm.success, true);
    assert.strictEqual((await invoke('listAIStudioSamples', {}, USER)).data.length, 0);
  });

  await test('L2 周边目录：默认 7 品类，printSpec 完整', async () => {
    const r = await invoke('listAIStudioMerchandise', {}, USER);
    assert.strictEqual(r.data.length, 7);
    const wall8 = r.data.find(m => m.merchId === 'wall_8');
    assert.strictEqual(wall8.printSpec.widthMM, 203);
    assert.strictEqual(wall8.printSpec.dpi, 300);
    assert.strictEqual(wall8.printSpec.bleedMM, 3);
  });

  console.log('\n== M. 开放网关 ==');

  await test('M1 错误 apiKey：FORBIDDEN', async () => {
    const r = await invoke('photomuseOpenApi', { apiKey: 'bad', action: 'catalog', payload: {} }, undefined);
    assert.strictEqual(r.code, 'FORBIDDEN');
  });

  await test('M2 未知 action：拒绝', async () => {
    const r = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'nope', payload: {} }, undefined);
    assert.strictEqual(r.success, false);
  });

  await test('M3 catalog：3 套餐 5 主题', async () => {
    const r = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'catalog', payload: {} }, undefined);
    assert.strictEqual(r.products.length, 3);
    assert.strictEqual(r.themes.filter(t => ['guofeng','sports','casual','travel','family'].includes(t.themeId || t.id)).length >= 5 || r.themes.length >= 5, true, JSON.stringify(r.themes));
  });

  await test('M4 网关 createOrder 双主题计价 + getOrder(webToken) + queryOrder(三元组) 脱敏', async () => {
    const gw = await invoke('photomuseOpenApi', {
      apiKey: 'test-api-key', action: 'createOrder',
      payload: { productId: 'portrait_suite_69', themes: ['guofeng', 'family'], contactPhone: '13800000003', queryPassword: 'abcdef', authorization: { isSelfOrAuthorized: true, isAdult: true, agreesProduction: true } }
    }, undefined);
    assert.strictEqual(gw.success, true);
    assert.ok(gw.order.webToken.length >= 32);
    const order = await getOrder(gw.order.orderId);
    assert.strictEqual(order.price, 109.8);
    assert.strictEqual(order.source, 'web');
    assert.ok(order.web_token_hash);
    const byToken = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'getOrder', payload: { orderId: gw.order.orderId, webToken: gw.order.webToken } }, undefined);
    assert.strictEqual(byToken.success, true);
    assert.ok(!('web_token_hash' in byToken.order));
    const byTriple = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'queryOrder', payload: { orderId: gw.order.orderId, contactPhone: '13800000003', queryPassword: 'abcdef' } }, undefined);
    assert.strictEqual(byTriple.success, true);
    const badToken = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'getOrder', payload: { orderId: gw.order.orderId, webToken: 'wrong-token' } }, undefined);
    assert.strictEqual(badToken.code, 'NOT_FOUND');
  });

  await test('M5 网关 businessConfig/samples/merchandise/paymentQR/runtimeConfig 只读 action', async () => {
    for (const action of ['businessConfig', 'samples', 'merchandise', 'paymentQR', 'runtimeConfig']) {
      const r = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action, payload: {} }, undefined);
      assert.strictEqual(r.success, true, action + ' 失败: ' + JSON.stringify(r));
    }
  });

  await test('M6 网关 selectCells 分主题代理：与直调语义一致', async () => {
    const oid = await makeQueuedMultiThemeOrder(['guofeng', 'casual']);
    await invoke('adminUploadAIStudioGridPreview', { ...ADMIN, orderId: oid, themeId: 'guofeng', fileID: `cloud://x/${oid}/g1.jpg`, fileName: 'g1.jpg', size: 1, mimeType: 'image/jpeg' }, 'admin-openid-1');
    await invoke('adminUploadAIStudioGridPreview', { ...ADMIN, orderId: oid, themeId: 'casual', fileID: `cloud://x/${oid}/g2.jpg`, fileName: 'g2.jpg', size: 1, mimeType: 'image/jpeg' }, 'admin-openid-1');
    const r1 = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'selectCells', payload: { orderId: oid, themeId: 'guofeng', cells: [1, 2], contactPhone: '13800000001', queryPassword: '123456' } }, undefined);
    assert.strictEqual(r1.success, true, JSON.stringify(r1));
    assert.strictEqual(r1.order.order_status, 'grid_preview');
    const r2 = await invoke('photomuseOpenApi', { apiKey: 'test-api-key', action: 'selectCells', payload: { orderId: oid, themeId: 'casual', cells: [3], contactPhone: '13800000001', queryPassword: '123456' } }, undefined);
    assert.strictEqual(r2.order.order_status, 'cell_selected');
  });

  console.log('\n== N. 审计完整性 ==');

  await test('N1 关键动作全部落审计（含新增动作）', async () => {
    const audits = cloud.__mock.snapshot('ai_studio_audit_logs').map(a => a.action);
    for (const action of ['create_order', 'upload_customer_photo', 'submit_order', 'admin_review_pass', 'select_portrait_cells', 'admin_deliver_order', 'select_merch', 'export_print_file', 'admin_mark_order_paid', 'generate_await_check']) {
      if (action === 'generate_await_check') continue;
      assert.ok(audits.includes(action), '缺审计: ' + action);
    }
    assert.ok(cloud.__mock.snapshot('ai_studio_audit_logs').every(a => a.createdAt && a.createdAt.__serverDate));
  });

  console.log('\n========================================');
  console.log(`通过 ${passed}，失败 ${failed}`);
  if (failed > 0) {
    console.log('\n失败明细:');
    failures.forEach(f => console.log('  ✗ ' + f.name + ' — ' + (f.err && f.err.message)));
    process.exit(1);
  }
  console.log('集成测试全部通过');
}

cloud.__mock.reset();
main().catch(err => {
  console.error('测试执行异常:', err);
  process.exit(1);
});
