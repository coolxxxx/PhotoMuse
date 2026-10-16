/* ============================================================
 * 大模型节点（生图 / 视觉分析）配置测试
 *
 * 回答的问题：拿到一个 base URL + Key 后，怎么接进 PhotoMuse？
 *   1. 管理后台 → 模型设置 → 填 base URL + Key + 模型名 → 保存（面板优先，改完立即生效）
 *   2. 或用环境变量 PM_AI_KEY / PM_GEN_API / PM_IMG_MODEL（面板未配置时的兜底）
 *
 * 本文件验证：
 *   A. 端点推导：只填 base URL → 自动拼出 /images/generations 与 /chat/completions；
 *      填完整端点也接受；面板优先于环境变量；enabled=false 时明确报 CONFIG_MISSING
 *   B. 端到端：经接口保存面板配置后，生图真的打到该节点，并带上正确的 Key / 模型 / 尺寸
 *
 * 运行：node --test tests/model-node.test.mjs
 * ============================================================ */
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, openSync, closeSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ai from '../photomuse-server/lib/ai.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'photomuse-server');
const NODE_PORT = 8935;
const PORT = 8934;
const BASE = `http://127.0.0.1:${PORT}`;
const FAKE_NODE = `http://127.0.0.1:${NODE_PORT}`;
const ADMIN_PWD = 'model-node-admin-pwd';
const PUBLIC_ORIGIN = 'https://test.example.com';
const JPEG_1PX = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');

let child = null;
let fakeNode = null;
let dataDir = null;
let uploadDir = null;
let logFd = null;
let calls = [];

const post = async (p, body, headers = {}) => {
  const res = await fetch(BASE + p, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify(body)
  });
  return res.json();
};
const open = (action, payload) => post('/api/open', { action, payload });

/* 建单 + 上传并登记一张客户照片（生图前置条件） */
async function createOrderWithPhoto(queryPassword) {
  const c = await open('createOrder', {
    productId: 'portrait_suite_69', themes: ['family'], contactPhone: '13800001234', queryPassword,
    authorization: { isSelfOrAuthorized: 1, isAdult: 1, agreesProduction: 1 }
  });
  assert.equal(c.success, true);
  const fd = new FormData();
  fd.append('orderId', c.orderId);
  fd.append('webToken', c.webToken);
  fd.append('cloudPath', 'customer-0');
  fd.append('file', new Blob([JPEG_1PX], { type: 'image/jpeg' }), 'a.jpg');
  const up = await (await fetch(BASE + '/api/upload', { method: 'POST', body: fd })).json();
  assert.equal(up.success, true);
  const reg = await open('registerPhoto', {
    orderId: c.orderId, webToken: c.webToken, fileID: up.fileID,
    fileName: 'a.jpg', size: JPEG_1PX.length, mimeType: 'image/jpeg'
  });
  assert.equal(reg.success, true);
  return c;
}

/* ============ A. 端点推导（纯单元，不起服务） ============ */
test('resolveConfig：只填 base URL 时自动推导两个端点', () => {
  ai.bindRuntimeConfig(() => ({ scene: 'image_generation', apiUrl: 'https://api.mine.com/v1', model: 'my-model', apiKey: 'sk-x', imageSize: '1024x1024' }));
  const cfg = ai.resolveConfig();
  assert.equal(cfg.genApi, 'https://api.mine.com/v1/images/generations');
  assert.equal(cfg.chatApi, 'https://api.mine.com/v1/chat/completions');
  assert.equal(cfg.imgModel, 'my-model');
  assert.equal(cfg.key, 'sk-x');
  assert.equal(cfg.imageSize, '1024x1024');
});

test('resolveConfig：填完整端点也接受（不重复拼路径）', () => {
  ai.bindRuntimeConfig(() => ({ scene: 'image_generation', apiUrl: 'https://api.mine.com/v1/images/generations', model: 'm', apiKey: 'k' }));
  const cfg = ai.resolveConfig();
  assert.equal(cfg.genApi, 'https://api.mine.com/v1/images/generations');
  assert.equal(cfg.chatApi, 'https://api.mine.com/v1/chat/completions');
});

test('resolveConfig：去掉尾部斜杠，base 与端点混写都归一', () => {
  ai.bindRuntimeConfig(() => ({ scene: 'image_generation', apiUrl: 'https://api.mine.com/v1/', model: 'm', apiKey: 'k' }));
  assert.equal(ai.resolveConfig().genApi, 'https://api.mine.com/v1/images/generations');
});

test('resolveConfig：面板未配置时回落到环境变量 PM_AI_KEY / PM_GEN_API', () => {
  ai.bindRuntimeConfig(() => null);
  process.env.PM_AI_KEY = 'env-key';
  process.env.PM_GEN_API = 'https://env.example.com/v1/images/generations';
  try {
    const cfg = ai.resolveConfig();
    assert.equal(cfg.key, 'env-key');
    assert.equal(cfg.genApi, 'https://env.example.com/v1/images/generations');
  } finally {
    delete process.env.PM_AI_KEY;
    delete process.env.PM_GEN_API;
  }
});

test('resolveConfig：面板 enabled=false 时明确停用', () => {
  ai.bindRuntimeConfig(() => ({ scene: 'image_generation', enabled: false, apiUrl: 'https://api.mine.com/v1', model: 'm', apiKey: 'k' }));
  const cfg = ai.resolveConfig();
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.key, 'k', '配置本身仍可解析，但调用会被 requireAIConfig 拒绝');
  ai.bindRuntimeConfig(() => null);
});

/* ============ B. 端到端：面板配置驱动真实调用 ============ */
function startFakeNode() {
  return new Promise(resolve => {
    const srv = createServer((req, res) => {
      if (req.method === 'POST') {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          calls.push({ url: req.url, auth: req.headers.authorization || '', body });
          if (req.url.endsWith('/images/generations')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ data: [{ url: FAKE_NODE + '/gen.jpg' }] }));
          }
          if (req.url.endsWith('/chat/completions')) {
            const payload = { summary: '假节点分析结果', scores: [{ themeId: 'guofeng', themeName: '古风写真', score: 88, reason: '测试' }] };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
          }
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end('{}');
        });
        return;
      }
      if (req.url === '/gen.jpg') {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        /* 生图结果需 ≥20000 字节才会被接受（防"图片过小"误判） */
        return res.end(Buffer.alloc(25000, 0x41));
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
    srv.listen(NODE_PORT, '127.0.0.1', () => resolve(srv));
  });
}

before(async () => {
  fakeNode = await startFakeNode();
  dataDir = mkdtempSync(path.join(tmpdir(), 'pm-modelnode-'));
  uploadDir = path.join(dataDir, 'uploads');
  const logPath = path.join(dataDir, 'server.log');
  logFd = openSync(logPath, 'w');
  child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(PORT),
      PM_ADMIN_PASSWORD: ADMIN_PWD,
      PM_UPLOAD_ROOT: uploadDir,
      PM_DATA_DIR: path.join(dataDir, 'data'),
      /* 故意留空 Key：证明"仅靠面板配置"就能生图 */
      PM_AI_KEY: '',
      PM_PUBLIC_ORIGIN: PUBLIC_ORIGIN
    }),
    stdio: ['ignore', logFd, logFd]
  });
  for (let i = 0; i < 40; i += 1) {
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
  if (fakeNode) { try { fakeNode.close(); } catch (e) {} }
  try { rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
});

test('未配置节点时生图明确报 CONFIG_MISSING（不静默失败）', async () => {
  const c = await createOrderWithPhoto('mn-pwd-0');
  const login = await post('/api/admin/login', { password: ADMIN_PWD });
  const g = await post('/api/admin/order/' + c.orderId + '/generate', { stage: 'grid' }, { 'X-Admin-Token': login.token });
  assert.equal(g.success, false);
  assert.equal(g.code, 'CONFIG_MISSING', '未配节点应回 CONFIG_MISSING，实际：' + JSON.stringify(g));
});

test('在小程序管理面板填 base URL + Key + 模型后，生图真的打到该节点', async () => {
  const saved = await post('/api/open/wx/adminUpsertAIStudioRuntimeConfig', {
    adminPassword: ADMIN_PWD,
    modelSettings: [{
      scene: 'image_generation',
      enabled: true,
      provider: 'openai_compatible',
      apiUrl: FAKE_NODE + '/v1',
      model: 'my-img-model',
      apiKey: 'sk-test-my-node',
      imageSize: '1024x1024'
    }]
  });
  assert.equal(saved.success, true);

  const c = await createOrderWithPhoto('mn-pwd-1');

  calls = [];
  const login = await post('/api/admin/login', { password: ADMIN_PWD });
  const g = await post('/api/admin/order/' + c.orderId + '/generate', { stage: 'grid' }, { 'X-Admin-Token': login.token });
  assert.equal(g.success, true, '面板配好后生图应成功：' + JSON.stringify(g));

  const gen = calls.find(x => x.url.endsWith('/images/generations'));
  assert.ok(gen, '必须打到 /images/generations，实际请求：' + calls.map(x => x.url).join(','));
  assert.equal(gen.url, '/v1/images/generations', 'base URL + /v1 应拼出正确路径');
  assert.equal(gen.auth, 'Bearer sk-test-my-node', '必须带上面板里填的 Key');
  const sent = JSON.parse(gen.body);
  assert.equal(sent.model, 'my-img-model', '必须用面板里填的模型名（环境变量 PM_AI_KEY 是空的）');
  assert.equal(sent.size, '1024x1024', '必须用面板里填的尺寸');
  assert.ok(sent.prompt && sent.prompt.length > 20, '必须带上提示词');
});

test('面板改完立即生效（无需重启服务）', async () => {
  const saved = await post('/api/open/wx/adminUpsertAIStudioRuntimeConfig', {
    adminPassword: ADMIN_PWD,
    modelSettings: [{ scene: 'image_generation', enabled: true, provider: 'openai_compatible', apiUrl: FAKE_NODE + '/v1/images/generations', model: 'switched-model', apiKey: 'sk-switched', imageSize: '1024x1792' }]
  });
  assert.equal(saved.success, true);

  const c = await createOrderWithPhoto('mn-pwd-2');
  calls = [];
  const login = await post('/api/admin/login', { password: ADMIN_PWD });
  const g = await post('/api/admin/order/' + c.orderId + '/generate', { stage: 'grid' }, { 'X-Admin-Token': login.token });
  assert.equal(g.success, true);
  const gen = calls.find(x => x.url.endsWith('/images/generations'));
  assert.ok(gen, '必须打到 /images/generations');
  assert.equal(gen.auth, 'Bearer sk-switched', '换成完整端点写法后应立即用新 Key');
  assert.equal(JSON.parse(gen.body).model, 'switched-model', '应立即用新模型，无需重启');
});
