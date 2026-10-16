/* ============================================================
 * 证件照引擎（HivisionIDPhotos）集成测试
 *
 * 用一个「假引擎」真跑完整三步链路，验证：
 *   1. 下单落盘客户选的 spec（规格）与 backgroundColor（底色）——历史 bug：两者曾被直接丢弃
 *   2. stage=idphoto 走 /idphoto → /add_background → /generate_layout_photos
 *   3. multipart 文件字段名确为 input_image；规格 px 与底色 HEX 传对
 *   4. 成品与排版照都登记为 order_files 且文件真落盘
 *   5. 模型面板可禁用引擎 → 回 CONFIG_MISSING；apiKey 永不回传
 *
 * 运行：node --test tests/idphoto.test.mjs（独立端口，与 server.test.mjs 不冲突）
 * ============================================================ */
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, openSync, closeSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'photomuse-server');
const ENGINE_PORT = 8933;
const PORT = 8932;
const BASE = `http://127.0.0.1:${PORT}`;
const ENGINE = `http://127.0.0.1:${ENGINE_PORT}`;
const ADMIN_PWD = 'idphoto-admin-pwd';
const PUBLIC_ORIGIN = 'https://test.example.com';

/* 最小合法 JPEG（带 ffd8ff 魔数，服务端按魔数判类型） */
const JPEG_1PX = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');
/* 1x1 PNG（抠图阶段的透明底产物载体，内容不参与校验） */
const PNG_1PX = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

let child = null;
let engineSrv = null;
let dataDir = null;
let uploadDir = null;
let logFd = null;
let hits = [];      /* 假引擎收到的请求 */
let ENGINE_CONFIGURED = '';

const post = async (p, body, headers = {}) => {
  const res = await fetch(BASE + p, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify(body)
  });
  return res.json();
};
const open = (action, payload) => post('/api/open', { action, payload });
const wx = (action, payload, headers = {}) => post('/api/open/wx/' + action, payload, headers);

function startFakeEngine() {
  return new Promise(resolve => {
    const srv = createServer((req, res) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        /* 以 latin1 记录原始字节，便于断言 multipart 字段名与表单值 */
        hits.push({ url: req.url, bytes: body.length, text: body.toString('latin1') });
        const json = obj => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(obj));
        };
        if (req.url === '/idphoto') return json({ status: true, image_base64_hd: PNG_1PX.toString('base64') });
        if (req.url === '/add_background') return json({ status: true, image_base64: JPEG_1PX.toString('base64') });
        if (req.url === '/generate_layout_photos') return json({ status: true, image_base64: JPEG_1PX.toString('base64') });
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
    });
    srv.listen(ENGINE_PORT, '127.0.0.1', () => resolve(srv));
  });
}

before(async () => {
  engineSrv = await startFakeEngine();
  dataDir = mkdtempSync(path.join(tmpdir(), 'pm-idphoto-'));
  uploadDir = path.join(dataDir, 'uploads');
  ENGINE_CONFIGURED = ENGINE;
  /* 输出落文件而非管道：受限沙箱里管道 stdio 会被拒（EPERM） */
  const logPath = path.join(dataDir, 'server.log');
  logFd = openSync(logPath, 'w');
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      PM_ADMIN_PASSWORD: ADMIN_PWD,
      PM_UPLOAD_ROOT: uploadDir,
      PM_DATA_DIR: path.join(dataDir, 'data'),
      PM_AI_KEY: '',
      PM_PUBLIC_ORIGIN: PUBLIC_ORIGIN,
      PM_IDPHOTO_ENGINE_URL: ENGINE_CONFIGURED
    }),
    stdio: ['ignore', logFd, logFd]
  });
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const r = await fetch(BASE + '/api/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"catalog","payload":{}}' });
      if (r.ok) { closeSync(logFd); return; }
    } catch (e) { /* retry */ }
  }
  let log = '';
  try { closeSync(logFd); log = readFileSync(logPath, 'utf8').slice(-2000); } catch (e) {}
  throw new Error('测试服务未就绪\n--- photomuse-server 输出 ---\n' + (log || '(无输出)'));
});

after(async () => {
  if (child) {
    try { child.kill('SIGKILL'); } catch (e) {}
    if (process.platform === 'win32' && child.pid) {
      try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
    }
  }
  if (engineSrv) { try { engineSrv.close(); } catch (e) {} }
  try { rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
});

let ORDER = null;

/* ============ 1. 下单必须落盘规格与底色（历史 bug 守护） ============ */
test('createOrder：证件照订单落盘客户选的 spec=二寸 / backgroundColor=蓝底', async () => {
  const r = await open('createOrder', {
    productId: 'id_photo_9_9',
    styleId: 'std_white',
    spec: '二寸',
    backgroundColor: '蓝底',
    contactPhone: '13800001234',
    queryPassword: 'idphoto-pwd-1',
    authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 }
  });
  assert.equal(r.success, true);
  ORDER = { orderId: r.orderId, webToken: r.webToken };

  const d = await open('getOrder', { orderId: ORDER.orderId, webToken: ORDER.webToken });
  assert.equal(d.order.spec, '二寸', '规格必须落盘（旧实现直接丢弃 payload.spec）');
  assert.equal(d.order.backgroundColor, '蓝底', '底色必须落盘（旧实现只写 style.backgroundColor）');
});

/* ============ 2. 上传并登记客户照片 ============ */
test('上传客户照片并登记', async () => {
  const fd = new FormData();
  fd.append('orderId', ORDER.orderId);
  fd.append('webToken', ORDER.webToken);
  fd.append('cloudPath', 'customer-0');
  fd.append('file', new Blob([JPEG_1PX], { type: 'image/jpeg' }), 'a.jpg');
  const res = await fetch(BASE + '/api/upload', { method: 'POST', body: fd });
  const up = await res.json();
  assert.equal(up.success, true);
  assert.ok(up.fileID.startsWith(PUBLIC_ORIGIN + '/PM/uploads/orders/'));

  const reg = await open('registerPhoto', {
    orderId: ORDER.orderId, webToken: ORDER.webToken, fileID: up.fileID,
    fileName: 'a.jpg', size: JPEG_1PX.length, mimeType: 'image/jpeg'
  });
  assert.equal(reg.success, true);
  assert.equal(reg.photoCount, 1);
});

/* ============ 3. stage=idphoto 真跑三步链路 ============ */
test('stage=idphoto：抠图→底色→排版照全部走通，成品与排版照都落盘', async () => {
  hits = [];
  const r = await wx('generateAIStudioImage', {
    orderId: ORDER.orderId, adminPassword: ADMIN_PWD, stage: 'idphoto'
  });
  assert.equal(r.success, true, '证件照生成应成功：' + JSON.stringify(r));
  assert.ok(r.file && r.file.fileID, '必须返回成品 fileID');
  assert.equal(r.file.stage, 'idphoto');
  assert.ok(r.file.fileID.includes('/idphoto-'), '成品应为 idphoto-*.jpg：' + r.file.fileID);
  assert.ok(r.layout && r.layout.fileID, '应返回排版照 fileID');
  assert.ok(r.layout.fileID.includes('/layout-'));

  /* 三个端点都被调用到 */
  const urls = hits.map(h => h.url);
  assert.ok(urls.includes('/idphoto'), '必须调用 /idphoto');
  assert.ok(urls.includes('/add_background'), '必须调用 /add_background');
  assert.ok(urls.includes('/generate_layout_photos'), '必须调用 /generate_layout_photos');

  /* multipart 字段名与关键参数 */
  const mattingReq = hits.find(h => h.url === '/idphoto');
  assert.ok(mattingReq && mattingReq.text.includes('name="input_image"'), '文件字段必须为 input_image');
  assert.ok(mattingReq.text.includes('name="height"') && mattingReq.text.includes('579'), '二寸高度应为 579px');
  assert.ok(mattingReq.text.includes('name="width"') && mattingReq.text.includes('413'), '二寸宽度应为 413px');
  assert.ok(mattingReq.text.includes('dpi') && mattingReq.text.includes('300'), '必须传 dpi=300');

  const bgReq = hits.find(h => h.url === '/add_background');
  assert.ok(bgReq.text.includes('438EDB'), '蓝底必须映射为 HEX 438EDB');

  /* 成品与排版照真落盘 */
  const orderDir = path.join(uploadDir, 'orders', ORDER.orderId);
  assert.ok(existsSync(orderDir), '订单上传目录应存在');
  const files = readdirSync(orderDir);
  assert.ok(files.some(f => f.startsWith('idphoto-')), '成品文件应落盘：' + files.join(','));
  assert.ok(files.some(f => f.startsWith('layout-')), '排版照文件应落盘：' + files.join(','));
});

/* ============ 4. 引擎未配置/被禁用 → CONFIG_MISSING（不静默失败） ============ */
test('模型面板禁用证件照引擎后，stage=idphoto 回 CONFIG_MISSING', async () => {
  const saved = await wx('adminUpsertAIStudioRuntimeConfig', {
    adminPassword: ADMIN_PWD,
    modelSettings: [{ scene: 'idphoto_engine', enabled: false, apiUrl: ENGINE, provider: 'hivision', publicName: '证件照引擎' }]
  });
  assert.equal(saved.success, true);

  const r = await wx('generateAIStudioImage', { orderId: ORDER.orderId, adminPassword: ADMIN_PWD, stage: 'idphoto' });
  assert.equal(r.success, false);
  assert.equal(r.code, 'CONFIG_MISSING', '引擎被禁用时必须明确回 CONFIG_MISSING');
});

/* ============ 5. 模型设置：面板可读回，且 apiKey 永不回传 ============ */
test('getAIStudioRuntimeConfig：apiKey 入库但不回传', async () => {
  const saved = await wx('adminUpsertAIStudioRuntimeConfig', {
    adminPassword: ADMIN_PWD,
    modelSettings: [
      { scene: 'image_generation', enabled: true, provider: 'openai_compatible', model: 'm', apiUrl: 'https://api.example.com', apiKey: 'sk-secret-should-never-return', imageSize: '1024x1024' },
      { scene: 'idphoto_engine', enabled: true, apiUrl: ENGINE, provider: 'hivision', faceAlignment: true }
    ]
  });
  assert.equal(saved.success, true);

  const r = await wx('getAIStudioRuntimeConfig', {});
  assert.equal(r.success, true);
  const settings = (r.config || {}).modelSettings || [];
  const idphoto = settings.find(s => s.scene === 'idphoto_engine');
  assert.ok(idphoto && idphoto.apiUrl === ENGINE, '面板应能读回证件照引擎地址');
  assert.ok(!JSON.stringify(settings).includes('sk-secret-should-never-return'), 'apiKey 绝不能回传');

  /* 重新启用后引擎可再次工作 */
  const again = await wx('generateAIStudioImage', { orderId: ORDER.orderId, adminPassword: ADMIN_PWD, stage: 'idphoto' });
  assert.equal(again.success, true, '重新启用引擎后应能正常生成');
});

/* ============ 6. 非证件照订单必须被拒绝 ============ */
test('stage=idphoto：写真订单被拒（不误用证件照引擎）', async () => {
  const r = await open('createOrder', {
    productId: 'portrait_suite_69', themes: ['family'],
    contactPhone: '13800001234', queryPassword: 'idphoto-pwd-2',
    authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 }
  });
  assert.equal(r.success, true);
  const g = await wx('generateAIStudioImage', { orderId: r.orderId, adminPassword: ADMIN_PWD, stage: 'idphoto' });
  assert.equal(g.success, false);
  assert.equal(g.code, 'VALIDATION_ERROR');
});

/* ============ 7. 自动流水线也走引擎（审核通过 → 引擎出图 → qc） ============ */
test('审核通过后自动流水线走引擎：订单进 qc、落交付文件、规格底色真实传给引擎', async () => {
  const c = await open('createOrder', {
    productId: 'id_photo_9_9', styleId: 'std_white', spec: '一寸', backgroundColor: '红底',
    contactPhone: '13800001234', queryPassword: 'idphoto-pwd-3',
    authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 }
  });
  assert.equal(c.success, true);
  const oid = c.orderId;

  const fd = new FormData();
  fd.append('orderId', oid);
  fd.append('webToken', c.webToken);
  fd.append('cloudPath', 'customer-0');
  fd.append('file', new Blob([JPEG_1PX], { type: 'image/jpeg' }), 'a.jpg');
  const up = await (await fetch(BASE + '/api/upload', { method: 'POST', body: fd })).json();
  assert.equal(up.success, true);
  const reg = await open('registerPhoto', {
    orderId: oid, webToken: c.webToken, fileID: up.fileID,
    fileName: 'a.jpg', size: JPEG_1PX.length, mimeType: 'image/jpeg'
  });
  assert.equal(reg.success, true);
  const sub = await open('submitOrder', { orderId: oid, webToken: c.webToken });
  assert.equal(sub.success, true);

  const login = await post('/api/admin/login', { password: ADMIN_PWD });
  assert.equal(login.success, true);

  hits = [];
  const rev = await post('/api/admin/order/' + oid + '/review', { decision: 'pass' }, { 'X-Admin-Token': login.token });
  assert.equal(rev.success, true);

  /* 出图是异步 kick，轮询等它落定 */
  let detail = null;
  for (let i = 0; i < 60; i += 1) {
    await new Promise(r => setTimeout(r, 200));
    detail = await open('getOrder', { orderId: oid, webToken: c.webToken });
    if (detail && detail.order && detail.order.order_status === 'qc') break;
  }
  assert.equal(detail.order.order_status, 'qc', '自动出图应把订单推进到 qc，实际：' + (detail.order && detail.order.order_status));

  const files = detail.files || [];
  assert.ok(
    files.some(f => String(f.fileID || '').includes('idphoto-engine')),
    '交付文件应来自引擎路径（idphoto-engine*.jpg）：' + files.map(f => f.fileID).join(',')
  );

  /* 订单上的规格/底色必须真的传给了引擎 */
  const mattingReq = hits.find(h => h.url === '/idphoto');
  assert.ok(mattingReq, '自动流水线必须调用 /idphoto');
  assert.ok(mattingReq.text.includes('295') && mattingReq.text.includes('413'), '一寸规格 295×413 应传给引擎');
  const bgReq = hits.find(h => h.url === '/add_background');
  assert.ok(bgReq && bgReq.text.includes('DE2910'), '红底必须映射为 HEX DE2910 传给引擎');
});
