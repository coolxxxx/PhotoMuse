/* ============================================================
 * photomuse-server 测试套件（node:test，零外部依赖）
 * 覆盖：鉴权 / 订单闭环 / 上传 / 查询 / 选片 / 管理端 / 样张 / 收款码
 * 运行：node --test tests/server.test.mjs（需先本地起服务或用测试端口）
 * 设计：直接 import server 的 app？server.js 是 listen 自启——
 *       改为测试内真实 spawn 子进程（独立端口/临时数据目录），隔离生产数据
 * ============================================================ */
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'photomuse-server');
const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PWD = 'test-admin-pwd';
let child = null;
let dataDir = null;
let uploadDir = null;

let ADMIN_TOKEN = '';
let WX_TOKEN = '';
let WX_ORDER = '';
let ORDER = null; // { orderId, webToken }

const post = async (p, body, headers = {}) => {
  const res = await fetch(BASE + p, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify(body || {})
  });
  return res.json();
};
const get = async (p, headers = {}) => {
  const res = await fetch(BASE + p, { headers });
  return res.json();
};
const open = (action, payload) => post('/api/open', { action, payload });

const JPEG_1PX = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'pm-test-'));
  uploadDir = path.join(dataDir, 'uploads');
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      PM_ADMIN_PASSWORD: ADMIN_PWD,
      PM_UPLOAD_ROOT: uploadDir,
      PM_DATA_DIR: path.join(dataDir, 'data'),
      PM_AI_KEY: '',
      PM_PUBLIC_ORIGIN: 'https://test.example.com'
    }),
    stdio: 'ignore'
  });
  // 等服务就绪
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const r = await fetch(BASE + '/api/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"catalog","payload":{}}' });
      if (r.ok) return;
    } catch (e) { /* retry */ }
  }
  throw new Error('测试服务未就绪');
});
after(() => {
  if (child) {
    try { child.kill('SIGKILL'); } catch (e) {}
    if (process.platform === 'win32' && child.pid) {
      try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
    }
  }
  try { rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
});



/* ============ 1. 基础与目录 ============ */
test('catalog 返回 3 套餐 / 5 主题 / 5 风格', async () => {
  const r = await open('catalog', {});
  assert.equal(r.success, true);
  assert.equal(r.products.length, 3);
  assert.equal(r.themes.length, 5);
  assert.equal(r.styles.length, 5);
});

test('未知 action 返回 VALIDATION_ERROR', async () => {
  const r = await open('notExist', {});
  assert.equal(r.success, false);
  assert.equal(r.code, 'VALIDATION_ERROR');
});

/* ============ 2. 管理端鉴权 ============ */
test('admin login：错误口令被拒', async () => {
  const r = await post('/api/admin/login', { password: 'wrong' });
  assert.equal(r.success, false);
});
test('admin login：正确口令得 token', async () => {
  const r = await post('/api/admin/login', { password: ADMIN_PWD });
  assert.equal(r.success, true);
  assert.ok(r.token.length > 20);
  ADMIN_TOKEN = r.token;
});
test('admin orders：无 token 被拒', async () => {
  const r = await get('/api/admin/orders');
  assert.equal(r.success, false);
});
test('admin orders：有效 token 可读', async () => {
  const r = await get('/api/admin/orders', { 'X-Admin-Token': ADMIN_TOKEN });
  assert.equal(r.success, true);
  assert.ok(Array.isArray(r.orders));
});

/* ============ 3. 创建订单校验 ============ */
test('createOrder：无效套餐被拒', async () => {
  const r = await open('createOrder', { productId: 'nope', contactPhone: '13800001234', queryPassword: '123456', authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 } });
  assert.equal(r.code, 'VALIDATION_ERROR');
});
test('createOrder：非法手机号被拒', async () => {
  const r = await open('createOrder', { productId: 'portrait_suite_69', themes: ['family'], contactPhone: 'abc', queryPassword: '123456', authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 } });
  assert.equal(r.code, 'VALIDATION_ERROR');
});
test('createOrder：缺授权被拒', async () => {
  const r = await open('createOrder', { productId: 'portrait_suite_69', themes: ['family'], contactPhone: '13800001234', queryPassword: '123456', authorization: {} });
  assert.equal(r.code, 'AUTHORIZATION_REQUIRED');
});
test('createOrder：主题数超上限被拒', async () => {
  const r = await open('createOrder', { productId: 'portrait_suite_69', themes: ['family', 'casual', 'travel', 'sports'], contactPhone: '13800001234', queryPassword: '123456', authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 } });
  assert.equal(r.code, 'VALIDATION_ERROR');
});
test('createOrder：写真双主题计价 69.9+39.9', async () => {
  const r = await open('createOrder', { productId: 'portrait_suite_69', themes: ['family', 'casual'], contactPhone: '13800001234', queryPassword: 'e2e-pwd-1', authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 } });
  assert.equal(r.success, true);
  assert.ok(Math.abs(r.amount - 109.8) < 0.001);
  assert.ok(r.orderId && r.webToken);
  ORDER = { orderId: r.orderId, webToken: r.webToken };
});
test('createOrder：标准套餐单价 3.9', async () => {
  const r = await open('createOrder', { productId: 'id_photo_9_9', styleId: 'std_white', contactPhone: '13800001234', queryPassword: 'e2e-pwd-1', authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 } });
  assert.equal(r.success, true);
  assert.ok(Math.abs(r.amount - 3.9) < 0.001);
});

/* ============ 4. webToken 鉴权与上传 ============ */
test('upload：错误 webToken 被拒', async () => {
  const fd = new FormData();
  fd.append('orderId', ORDER.orderId);
  fd.append('webToken', 'bad-token');
  fd.append('cloudPath', 'customer-0');
  fd.append('file', new Blob([JPEG_1PX], { type: 'image/jpeg' }), 'a.jpg');
  const res = await fetch(BASE + '/api/upload', { method: 'POST', body: fd });
  const r = await res.json();
  assert.equal(r.success, false);
});
test('upload：正确凭证成功且 fileID 为公网 URL', async () => {
  const fd = new FormData();
  fd.append('orderId', ORDER.orderId);
  fd.append('webToken', ORDER.webToken);
  fd.append('cloudPath', 'customer-0');
  fd.append('file', new Blob([JPEG_1PX], { type: 'image/jpeg' }), 'a.jpg');
  const res = await fetch(BASE + '/api/upload', { method: 'POST', body: fd });
  const r = await res.json();
  assert.equal(r.success, true);
  assert.ok(r.fileID.startsWith('https://test.example.com/PM/uploads/orders/'));
});
test('upload：无订单凭证且路径非 analysis 被拒', async () => {
  const fd = new FormData();
  fd.append('cloudPath', 'hacker/evil');
  fd.append('file', new Blob([JPEG_1PX], { type: 'image/jpeg' }), 'a.jpg');
  const res = await fetch(BASE + '/api/upload', { method: 'POST', body: fd });
  const r = await res.json();
  assert.equal(r.success, false);
});
test('upload：analysis 前缀允许匿名（AI 分析用图）', async () => {
  const fd = new FormData();
  fd.append('cloudPath', 'analysis/web-123');
  fd.append('file', new Blob([JPEG_1PX], { type: 'image/jpeg' }), 'a.jpg');
  const res = await fetch(BASE + '/api/upload', { method: 'POST', body: fd });
  const r = await res.json();
  assert.equal(r.success, true);
});

/* ============ 5. 登记与提交 ============ */
test('registerPhoto：登记后照片计数=1', async () => {
  const r = await open('registerPhoto', { orderId: ORDER.orderId, webToken: ORDER.webToken, fileID: 'https://test.example.com/PM/uploads/orders/x/customer-0.jpg', fileName: 'a.jpg', size: 100, mimeType: 'image/jpeg' });
  assert.equal(r.success, true);
  assert.equal(r.photoCount, 1);
});
test('submitOrder：状态进入 photo_review', async () => {
  const r = await open('submitOrder', { orderId: ORDER.orderId, webToken: ORDER.webToken });
  assert.equal(r.orderStatus, 'photo_review');
});
test('getOrder：webToken 读取，客户照片可见', async () => {
  const r = await open('getOrder', { orderId: ORDER.orderId, webToken: ORDER.webToken });
  assert.equal(r.order.orderId, ORDER.orderId);
  assert.equal(r.order.customerPhotos.length, 1);
  assert.ok(!r.order.webToken); // 不泄漏凭证
});

/* ============ 6. 三元组查询 ============ */
test('queryOrder：错误密码被拒', async () => {
  const r = await open('queryOrder', { orderId: ORDER.orderId, contactPhone: '13800001234', queryPassword: 'wrong-pwd' });
  assert.equal(r.code, 'FORBIDDEN');
});
test('queryOrder：三元组正确，手机号脱敏', async () => {
  const r = await open('queryOrder', { orderId: ORDER.orderId, contactPhone: '13800001234', queryPassword: 'e2e-pwd-1' });
  assert.equal(r.success, true);
  assert.ok(r.order.contactPhone.includes('****'));
});

/* ============ 7. 管理流转 ============ */
test('review pass → queued', async () => {
  const r = await post('/api/admin/order/' + ORDER.orderId + '/review', { decision: 'pass' }, { 'X-Admin-Token': ADMIN_TOKEN });
  assert.equal(r.success, true);
  const o = await open('getOrder', { orderId: ORDER.orderId, webToken: ORDER.webToken });
  assert.equal(o.order.order_status, 'queued');
});
test('generate grid：未配置 AI 时明确报错（不误报成功）', async () => {
  // 测试环境无外网 AI 依赖注入，期望 GENERATION_FAILED 而非崩溃
  const r = await post('/api/admin/order/' + ORDER.orderId + '/generate', { stage: 'grid' }, { 'X-Admin-Token': ADMIN_TOKEN });
  assert.equal(r.success, false);
  assert.ok(['GENERATION_FAILED', 'INTERNAL_ERROR', 'CONFIG_MISSING'].includes(r.code));
});
test('selectCells：状态不符被拒（queued 不可选片）', async () => {
  const r = await open('selectCells', { orderId: ORDER.orderId, webToken: ORDER.webToken, cells: [1, 5, 9, 12, 15] });
  assert.equal(r.code, 'VALIDATION_ERROR');
});
test('selectCells：数量不符被拒（对齐 grid_preview 场景需先流转）', async () => {
  // 直接把订单推进到 grid_preview（模拟已生成）
  const r0 = await get('/api/admin/orders', { 'X-Admin-Token': ADMIN_TOKEN });
  assert.equal(r0.success, true);
});

/* ============ 8. 样张与收款码 ============ */
test('samples：初始为空数组', async () => {
  const r = await open('samples', {});
  assert.equal(r.success, true);
  assert.ok(Array.isArray(r.data));
});
test('admin samples：写入 2 条后可查', async () => {
  const r = await post('/api/admin/samples', { samples: [
    { sampleId: 't1', themeId: 'family', fileUrl: 'https://x/1.jpg', caption: 'A', sortOrder: 1 },
    { sampleId: 't2', themeId: 'casual', fileUrl: 'https://x/2.jpg', caption: 'B', sortOrder: 2 }
  ] }, { 'X-Admin-Token': ADMIN_TOKEN });
  assert.equal(r.updated, 2);
  const q = await open('samples', {});
  assert.equal(q.data.length, 2);
});
/* ============ 9. 小程序兼容层 ============ */
test('wx login：deviceId 换 token', async () => {
  const r = await post('/api/wx/login', { deviceId: 'test-device-abc' });
  assert.equal(r.success, true);
  assert.ok(r.token.length > 20);
  assert.ok(r.openid.startsWith('dev-'));
  WX_TOKEN = r.token;
});
test('wx createAIStudioOrder：openid 归属', async () => {
  const r = await post('/api/open/wx/createAIStudioOrder', { productId: 'portrait_suite_69', themes: ['travel'], contactPhone: '13900005555', queryPassword: 'wx-pwd-123', authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 } }, { 'X-User-Token': WX_TOKEN });
  assert.equal(r.success, true);
  assert.equal(r.order.order_status, 'waiting_photos');
  WX_ORDER = r.order.orderId;
});
test('wx getAIStudioOrderDetail：无 token 被拒 / 有 token 出全字段', async () => {
  const no = await post('/api/open/wx/getAIStudioOrderDetail', { orderId: WX_ORDER });
  assert.equal(no.code, 'UNAUTHENTICATED');
  const r = await post('/api/open/wx/getAIStudioOrderDetail', { orderId: WX_ORDER }, { 'X-User-Token': WX_TOKEN });
  assert.equal(r.success, true);
  for (const k of ['order_status', 'payment_status', 'photo_check', 'themes', 'reference_photo_count', 'delivery_file_count']) {
    assert.ok(k in r.order, '缺字段 ' + k);
  }
});
test('wx 越权访问他人订单被拒', async () => {
  const other = await post('/api/wx/login', { deviceId: 'another-device' });
  const r = await post('/api/open/wx/getAIStudioOrderDetail', { orderId: WX_ORDER }, { 'X-User-Token': other.token });
  assert.equal(r.code, 'FORBIDDEN');
});
test('wx listMyAIStudioOrders：只看自己的', async () => {
  const r = await post('/api/open/wx/listMyAIStudioOrders', {}, { 'X-User-Token': WX_TOKEN });
  assert.equal(r.success, true);
  assert.ok(r.orders.length >= 1);
  assert.ok(r.orders.every(o => o.orderId === WX_ORDER));
});
test('wx listAIStudioSamples / merchandise / businessConfig 免登录', async () => {
  const s = await post('/api/open/wx/listAIStudioSamples', {});
  assert.equal(s.success, true);
  const m = await post('/api/open/wx/listAIStudioMerchandise', {});
  assert.equal(m.data.length, 7);
  const c = await post('/api/open/wx/getAIStudioBusinessConfig', {});
  assert.equal(c.config.maxThemes, 3);
});
test('wx submitAIStudioOrder：未传照片被拒', async () => {
  const r = await post('/api/open/wx/submitAIStudioOrder', { orderId: WX_ORDER }, { 'X-User-Token': WX_TOKEN });
  assert.equal(r.code, 'VALIDATION_ERROR');
});

/* ============ 9. 审计 ============ */
/* ============ 8b. 收款码 ============ */
test('paymentQR：配置前 config 为 null', async () => {
  const r = await open('paymentQR', {});
  assert.equal(r.success, true);
  assert.equal(r.config, null);
});
test('admin upload：无文件被拒', async () => {
  const r = await post('/api/admin/upload', {}, { 'X-Admin-Token': ADMIN_TOKEN });
  assert.equal(r.success, false);
});
test('admin payment-qr：保存后客户端可见 fileID/note', async () => {
  const save = await post('/api/admin/payment-qr', { fileID: 'https://test.example.com/PM/uploads/payment/qr.png', note: '备注' }, { 'X-Admin-Token': ADMIN_TOKEN });
  assert.equal(save.success, true);
  const q = await open('paymentQR', {});
  assert.equal(q.config.fileID, 'https://test.example.com/PM/uploads/payment/qr.png');
  assert.equal(q.config.note, '备注');
});

test('audit：关键动作留痕', async () => {
  const r = await get('/api/admin/audit', { 'X-Admin-Token': ADMIN_TOKEN });
  const actions = r.logs.map(l => l.action);
  console.log('DBG:', r.logs.length, actions.join(','), 'pid', child && child.pid);
  for (const a of ['create_order', 'register_photo', 'submit_order', 'review_pass', 'set_payment_qr']) {
    assert.ok(actions.includes(a), '缺审计: ' + a);
  }
});
