/* ============================================================
 * 浅焦映像 · 独立后端 photomuse-server
 * 订单/照片/AI 生成/样张/周边/收款 全自管，摆脱云函数限制
 * 端点：
 *   POST /api/open            —— action 分发器（语义与旧云函数网关一致）
 *   POST /api/upload          —— multipart 照片/文件上传（webToken 鉴权）
 *   POST /api/admin/login     —— 管理口令换 token
 *   POST /api/admin/*         —— 管理操作（X-Admin-Token 鉴权）
 * 启动：PM_ADMIN_PASSWORD=xxx PM_UPLOAD_ROOT=/var/www/pm/uploads node server.js
 * ============================================================ */
'use strict';

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const { db, now, seedConfig } = require('./lib/db');
const { ORDER_PRODUCTS, PORTRAIT_THEMES, STYLES, DEFAULT_PRICING, STATUS_LABELS, DEFAULT_MERCH } = require('./lib/catalog');
const ai = require('./lib/ai');
const notify = require('./lib/notify');
const pipeline = require('./lib/pipeline');
const idphoto = require('./lib/idphoto');

const PORT = process.env.PORT || 8900;
const ADMIN_PASSWORD = process.env.PM_ADMIN_PASSWORD || '';
const PUBLIC_ORIGIN = process.env.PM_PUBLIC_ORIGIN || 'https://www.czpsm.art';
const UPLOAD_ROOT = process.env.PM_UPLOAD_ROOT || path.join(__dirname, 'uploads');
if (!ADMIN_PASSWORD) { console.error('缺少 PM_ADMIN_PASSWORD 环境变量'); process.exit(1); }

seedConfig('pricing', DEFAULT_PRICING);

const app = express();
/* ---------------- 轻量限流（IP 滑动窗口，防刷） ---------------- */
const RATE_LIMIT = { windowMs: 60000, max: parseInt(process.env.PM_RATE_MAX || '120', 10) };
const rateBuckets = new Map();
setInterval(() => { rateBuckets.clear(); }, RATE_LIMIT.windowMs).unref();
app.use((req, res, next) => {
  const ip = (req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown').toString();
  const nowMs = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || nowMs - bucket.start > RATE_LIMIT.windowMs) {
    bucket = { start: nowMs, count: 0 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  if (bucket.count > RATE_LIMIT.max) {
    return res.status(429).json({ success: false, code: 'RATE_LIMITED', message: '请求太频繁，请稍后再试' });
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 6 }
});

/* ---------------- 工具 ---------------- */
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const rid = (prefix) => prefix + '-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max || 200) : '');
const nowStr = () => now();

const sign = (data) => crypto.createHmac('sha256', ADMIN_PASSWORD + '::pm').update(data).digest('hex').slice(0, 32);
const makeAdminToken = () => {
  const exp = Date.now() + 8 * 3600 * 1000;
  const body = 'admin.' + exp;
  return body + '.' + sign(body);
};
const verifyAdmin = (token) => {
  if (!token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const body = parts[0] + '.' + parts[1];
  if (Number(parts[1]) < Date.now()) return false;
  return sign(body) === parts[2];
};

/* 三元组换短时订单凭证：查询页验过三元组后签发，绑定 orderId，默认 30 分钟有效。
   这样查询页后续的选片/周边/补传不再需要反复上送明文查询密码。 */
const QUERY_TOKEN_TTL = parseInt(process.env.PM_QUERY_TOKEN_TTL || String(30 * 60), 10) * 1000;
const makeQueryToken = (orderId) => {
  const exp = Date.now() + QUERY_TOKEN_TTL;
  const body = 'query.' + orderId + '.' + exp;
  return body + '.' + sign(body);
};
const verifyQueryToken = (orderId, token) => {
  if (!token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 4 || parts[0] !== 'query' || parts[1] !== orderId) return false;
  if (Number(parts[2]) < Date.now()) return false;
  return sign(parts[0] + '.' + parts[1] + '.' + parts[2]) === parts[3];
};

const fail = (code, message) => ({ success: false, code, message });
const ok = (extra) => Object.assign({ success: true }, extra || {});

/* 由公网 fileID 反查本地文件并读入内存。
   只接受本机 PUBLIC_ORIGIN/uploads 前缀，并做路径穿越校验，绝不读取 UPLOAD_ROOT 之外的文件。 */
function readUploadBuffer(fileID) {
  const prefix = PUBLIC_ORIGIN + '/PM/uploads/';
  const s = String(fileID || '');
  if (!s.startsWith(prefix)) return null;
  const rootAbs = path.resolve(UPLOAD_ROOT);
  const abs = path.resolve(rootAbs, decodeURIComponent(s.slice(prefix.length)));
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) return null;
  try {
    return fs.readFileSync(abs);
  } catch (e) {
    return null;
  }
}

function audit(orderId, actor, action, payload) {
  db.prepare('INSERT INTO audit_logs (order_id, actor, action, payload, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(orderId || null, actor, action, JSON.stringify(payload || {}), nowStr());
}

/**
 * 定价配置：统一采用 v1 契约键名（baseThemePrice/extraThemePrice/maxThemes/photosPerTheme）。
 * 兼容旧库里遗留的 basePrice/perTheme 键名，缺项回落默认值，读到的永远是完整四键。
 */
function getPricing() {
  let stored = {};
  try {
    const row = db.prepare('SELECT value FROM config_kv WHERE key = ?').get('pricing');
    stored = row ? JSON.parse(row.value) : {};
  } catch (e) { stored = {}; }
  const pos = (v, d) => (isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  const int = (v, d) => (Number.isInteger(Number(v)) && Number(v) >= 1 ? Number(v) : d);
  return {
    baseThemePrice: pos(stored.baseThemePrice != null ? stored.baseThemePrice : stored.basePrice, DEFAULT_PRICING.baseThemePrice),
    extraThemePrice: pos(stored.extraThemePrice != null ? stored.extraThemePrice : stored.perTheme, DEFAULT_PRICING.extraThemePrice),
    maxThemes: int(stored.maxThemes, DEFAULT_PRICING.maxThemes),
    photosPerTheme: int(stored.photosPerTheme, DEFAULT_PRICING.photosPerTheme)
  };
}

function getOrder(orderId) {
  return db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
}

function orderFiles(orderId, fileType) {
  const rows = fileType
    ? db.prepare('SELECT * FROM order_files WHERE order_id = ? AND file_type = ? ORDER BY created_at').all(orderId, fileType)
    : db.prepare('SELECT * FROM order_files WHERE order_id = ? ORDER BY created_at').all(orderId);
  return rows;
}

/* 文件对象契约（与 v1 云函数一致）：fileType 用 customer_photo 等词汇，status 用 uploaded/replaced */
const FILE_TYPE_ALIAS = { customer: 'customer_photo' };
function toPublicFile(f) {
  return {
    fileId: f.file_id,
    fileType: FILE_TYPE_ALIAS[f.file_type] || f.file_type,
    fileID: f.url,
    fileName: f.file_name || '',
    size: Number(f.size) || 0,
    status: f.status || 'uploaded',
    createdAt: f.created_at
  };
}

/** 订单的公开文件列表（剔除已被替换的旧文件） */
function publicFiles(orderId) {
  return orderFiles(orderId).filter(f => (f.status || 'uploaded') !== 'replaced').map(toPublicFile);
}

/* 自动出图流水线依赖注入（须在 helper 定义之后） */
pipeline.bind({
  db, getOrder, orderFiles, audit, nowStr, rid,
  /* 自动流水线的证件照分支优先走引擎；返回 null 则回落 AI 提示词路径。
     引擎未配置 / 读不到客户照片 / 引擎报错，都返回 null（由 pipeline 记日志并回落）。 */
  generateIdPhoto: async (orderId, order) => {
    const engine = idPhotoEngineConfig();
    if (!engine.enabled || !engine.apiUrl) return null;
    const photos = orderFiles(orderId, 'customer');
    if (!photos.length) return null;
    const sourceBuffer = readUploadBuffer(photos[photos.length - 1].url);
    if (!sourceBuffer || !sourceBuffer.length) return null;
    const spec = idphoto.normalizeSpec(order.spec);
    const background = idphoto.normalizeBackground(order.background_color);
    const matted = await idphoto.matting(engine.apiUrl, sourceBuffer, spec, { faceAlignment: engine.faceAlignment });
    const photoBuffer = await idphoto.addBackground(engine.apiUrl, matted, background.hex);
    const url = await ai.saveUpload(path.join('orders', orderId, 'idphoto-engine.jpg'), photoBuffer);
    let layoutUrl = null;
    const layoutBuffer = await idphoto.layoutPhoto(engine.apiUrl, photoBuffer, spec);
    if (layoutBuffer) layoutUrl = await ai.saveUpload(path.join('orders', orderId, 'layout-engine.jpg'), layoutBuffer);
    return { url, layoutUrl };
  }
});

/* 管理面板的模型设置（config_kv，image_generation 场景）交给 AI 调用层：
   面板优先 / 环境变量兜底；每次调用时解析 → 面板改完立即生效，无需重启服务。 */
ai.bindRuntimeConfig(() => readModelSettings().find(s => s && s.scene === 'image_generation') || null);

/** 审核通过后异步跑自动出图（到可 QC），失败只记日志 */
function kickAutoGenerate(orderId) {
  setImmediate(() => {
    pipeline.run(orderId)
      .then(r => console.log('[autoGen]', orderId, r && r.success ? 'ok' : (r && r.error)))
      .catch(e => console.error('[autoGen]', orderId, e && e.message));
  });
}

/* 订单脱敏视图（前端 order-view.js 兼容形状） */
function orderView(o, opts) {
  const files = orderFiles(o.order_id);
  const byType = (t) => files.filter(f => f.file_type === t).map(f => f.url);
  const view = {
    orderId: o.order_id,
    productType: o.product_type,
    productId: o.product_id,
    productName: o.product_name,
    source: o.source,
    amount: o.amount,
    paid: Boolean(o.paid),
    themes: JSON.parse(o.themes || '[]'),
    styleId: o.style_id || undefined,
    styleName: o.style_name || undefined,
    sceneDesc: o.scene_desc || undefined,
    backgroundColor: o.background_color || undefined,
    spec: o.spec || undefined,
    order_status: o.order_status,
    orderStatus: o.order_status,
    statusLabel: STATUS_LABELS[o.order_status] || o.order_status,
    photoReview: o.photo_review,
    photoNote: o.photo_note || undefined,
    selectedCells: JSON.parse(o.selected_cells || '[]'),
    merchSelected: JSON.parse(o.merch_selected || '[]'),
    customerPhotos: byType('customer'),
    gridPreviews: byType('grid_preview'),
    generated: byType('generated'),
    deliveryFiles: byType('delivery'),
    /* v1 契约的文件对象数组：前端 order-view.js 与小程序 detail.js 读的是这个 */
    files: publicFiles(o.order_id),
    createdAt: o.created_at,
    updatedAt: o.updated_at
  };
  if (opts && opts.withToken) view.webToken = o.web_token_hash ? 'stored' : undefined;
  return view;
}

const maskOrder = (o) => {
  const v = orderView(o);
  v.contactPhone = String(o.contact_phone).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  return v;
};

/* ---------------- 客户 API：action 分发器 ---------------- */
const actions = {};

actions.catalog = () => ok({
  products: ORDER_PRODUCTS,
  themes: PORTRAIT_THEMES,
  styles: STYLES,
  categories: PORTRAIT_THEMES
});

actions.samples = () => {
  const rows = db.prepare('SELECT * FROM samples WHERE enabled = 1 ORDER BY sort_order LIMIT 60').all();
  return ok({ data: rows.map(r => ({ sampleId: r.sample_id, themeId: r.theme_id, fileID: r.file_url, caption: r.caption, sortOrder: r.sort_order })) });
};

actions.merchandise = () => {
  const rows = db.prepare('SELECT * FROM merchandise WHERE enabled = 1 ORDER BY sort_order LIMIT 60').all();
  return ok({ data: rows.map(r => ({
    merchId: r.merch_id, name: r.name, category: r.category, price: r.price,
    description: r.description, imageUrl: r.image_url,
    printSpec: JSON.parse(r.print_spec || '{}'), sortOrder: r.sort_order
  })) });
};

actions.businessConfig = () => {
  /* v1 契约：config 直接是扁平定价四键（前端 index.html 读 config.baseThemePrice） */
  return ok({ config: getPricing() });
};

actions.paymentQR = () => {
  const row = db.prepare("SELECT value FROM config_kv WHERE key = 'payment_qr'").get();
  if (!row) return ok({ config: null });
  const qr = JSON.parse(row.value);
  /* 前端 order-view.js 期望 config.fileID + config.note */
  return ok({ config: qr && qr.fileID ? qr : null });
};

actions.runtimeConfig = () => {
  const row = db.prepare("SELECT value FROM config_kv WHERE key = 'runtime'").get();
  return ok({ config: row ? JSON.parse(row.value) : {} });
};

actions.createOrder = (payload) => {
  const product = ORDER_PRODUCTS.find(p => p.productId === payload.productId);
  if (!product) return fail('VALIDATION_ERROR', '请选择有效套餐');
  const isPortrait = product.productType === 'portrait';
  const pricing = getPricing();

  let themes = [];
  if (isPortrait) {
    const rawIds = Array.isArray(payload.themes) ? payload.themes.map(t => clean(typeof t === 'string' ? t : t && t.themeId, 40)) : [];
    const unique = [...new Set(rawIds.filter(Boolean))];
    if (unique.length < 1 || unique.length > pricing.maxThemes) return fail('VALIDATION_ERROR', `请选择 1-${pricing.maxThemes} 个有效写真主题`);
    for (const id of unique) {
      const hit = PORTRAIT_THEMES.find(t => t.themeId === id);
      if (!hit) return fail('VALIDATION_ERROR', '请选择有效写真主题');
      themes.push({ themeId: hit.themeId, themeName: hit.name });
    }
  }
  const style = STYLES.find(s => s.styleId === clean(payload.styleId, 20));
  if (!style && (!isPortrait || payload.styleId)) return fail('VALIDATION_ERROR', '请选择有效风格');

  const phone = clean(payload.contactPhone, 20).replace(/[^0-9+]/g, '');
  if (!/^1[0-9]{10}$/.test(phone)) return fail('VALIDATION_ERROR', '请填写正确的手机号');
  const pwd = clean(payload.queryPassword, 32);
  if (pwd.length < 6) return fail('VALIDATION_ERROR', '查询密码至少 6 位');
  const authz = payload.authorization || {};
  if (!authz.isSelfOrAuthorized || !authz.isAdult || !authz.agreesProduction) return fail('AUTHORIZATION_REQUIRED', '请先确认授权');

  /* v1 阶梯计价：首主题 baseThemePrice，之后每主题加 extraThemePrice */
  const amount = isPortrait
    ? Math.round((pricing.baseThemePrice + Math.max(0, themes.length - 1) * pricing.extraThemePrice) * 10) / 10
    : product.price;

  const orderId = rid('PM');
  const webToken = crypto.randomBytes(18).toString('hex');
  /* 证件照规格/底色：优先取客户下单时的选择（白名单校验），缺失才回落 style 默认值。
     旧实现把这两项直接丢弃、只写 style.backgroundColor，导致证件照引擎拿不到规格与底色。 */
  const wantedSpec = clean(payload.spec, 20);
  const specName = wantedSpec && Object.prototype.hasOwnProperty.call(idphoto.ID_PHOTO_SPECS, wantedSpec) ? wantedSpec : null;
  const wantedBg = clean(payload.backgroundColor, 20);
  const backgroundColor = wantedBg ? idphoto.normalizeBackground(wantedBg).name : (style ? style.backgroundColor : null);
  db.prepare(`INSERT INTO orders (order_id, product_type, product_id, product_name, source, contact_phone,
    query_password_hash, web_token_hash, amount, themes, style_id, style_name, scene_desc, background_color,
    spec, order_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_photos', ?, ?)`).run(
    orderId, product.productType, product.productId, product.name,
    clean(payload.source, 10) || 'web', phone, sha256(pwd), sha256(webToken),
    amount, JSON.stringify(themes), style ? style.styleId : null, style ? style.name : null,
    clean(payload.sceneDesc, 300) || null, backgroundColor, specName, nowStr(), nowStr()
  );
  audit(orderId, 'customer', 'create_order', { productId: product.productId, themes });

  return ok({ orderId, webToken, amount, orderStatus: 'waiting_photos' });
};

function requireOrder(orderId, webToken) {
  const o = getOrder(clean(orderId, 40));
  if (!o) return { error: fail('NOT_FOUND', '订单不存在') };
  /* 凭证二选一：下单时发的 webToken，或三元组换到的短时 query token */
  const valid = Boolean(webToken)
    && (sha256(String(webToken)) === o.web_token_hash || verifyQueryToken(o.order_id, String(webToken)));
  if (!valid) return { error: fail('FORBIDDEN', '订单凭证无效') };
  return { order: o };
}

actions.registerPhoto = (payload) => {
  const chk = requireOrder(payload.orderId, payload.webToken);
  if (chk.error) return chk.error;
  const o = chk.order;
  if (!['waiting_photos', 'photo_review'].includes(o.order_status)) return fail('VALIDATION_ERROR', '当前状态不可上传');
  const fileID = clean(payload.fileID, 300);
  if (!fileID) return fail('VALIDATION_ERROR', '缺少文件');
  /* 只接受本站上传产生的文件地址（防伪造 fileID 混进管理后台渲染） */
  const fileIDOk = fileID.startsWith(PUBLIC_ORIGIN + '/PM/uploads/') || fileID.startsWith('cloud://');
  if (!fileIDOk) return fail('VALIDATION_ERROR', '文件地址不合法');
  const count = orderFiles(o.order_id, 'customer').length;
  if (count >= 3) return fail('VALIDATION_ERROR', '最多上传 3 张');
  db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, file_name, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(rid('file'), o.order_id, 'customer', fileID, clean(payload.fileName, 120), 'customer', nowStr());
  if (o.order_status === 'waiting_photos') {
    db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?').run('photo_review', nowStr(), o.order_id);
  }
  audit(o.order_id, 'customer', 'register_photo', { fileID });
  return ok({ fileID, photoCount: count + 1 });
};

actions.submitOrder = (payload) => {
  const chk = requireOrder(payload.orderId, payload.webToken);
  if (chk.error) return chk.error;
  const o = chk.order;
  const count = orderFiles(o.order_id, 'customer').length;
  if (count < 1) return fail('VALIDATION_ERROR', '请至少上传 1 张照片');
  db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?').run('photo_review', nowStr(), o.order_id);
  audit(o.order_id, 'customer', 'submit_order', { photos: count });
  /* 进入人工审核：邮件通知（失败不阻断） */
  notify.send('photo_review', o, { source: 'web-h5' }).catch(e => console.warn('[notify]', e.message));
  return ok({ orderStatus: 'photo_review' });
};

actions.getOrder = (payload) => {
  const chk = requireOrder(payload.orderId, payload.webToken);
  if (chk.error) return chk.error;
  const view = orderView(chk.order);
  /* v1 契约：order 之外还要给顶层 files 数组（order.html 读 res.files） */
  return ok({ order: view, files: view.files });
};

actions.queryOrder = (payload) => {
  const orderId = clean(payload.orderId, 40);
  const phone = clean(payload.contactPhone, 20).replace(/[^0-9+]/g, '');
  const pwd = clean(payload.queryPassword, 32);
  if (!orderId || !phone || pwd.length < 6) return fail('VALIDATION_ERROR', '请填写订单号、手机号和查询密码');
  const o = getOrder(orderId);
  if (!o || o.contact_phone !== phone || o.query_password_hash !== sha256(pwd)) {
    return fail('FORBIDDEN', '订单号、手机号或密码不正确');
  }
  return ok({ order: maskOrder(o), files: publicFiles(o.order_id), webToken: makeQueryToken(o.order_id) });
};

actions.selectCells = (payload) => {
  const chk = requireOrder(payload.orderId, payload.webToken);
  if (chk.error) return chk.error;
  const o = chk.order;
  if (o.order_status !== 'grid_preview') return fail('VALIDATION_ERROR', '当前状态不可选片');
  const cells = Array.isArray(payload.cells) ? payload.cells.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 15) : [];
  const deliveryTarget = (o.product_type === 'portrait') ? 5 : (ORDER_PRODUCTS.find(p => p.productId === o.product_id) || {}).deliveryCount || 1;
  if (cells.length !== deliveryTarget) return fail('VALIDATION_ERROR', `请选择 ${deliveryTarget} 格`);
  db.prepare('UPDATE orders SET selected_cells = ?, order_status = ?, updated_at = ? WHERE order_id = ?')
    .run(JSON.stringify(cells), 'cell_selected', nowStr(), o.order_id);
  audit(o.order_id, 'customer', 'select_cells', { cells });
  return ok({ orderStatus: 'cell_selected', selectedCells: cells });
};

/* 周边条目：只信 merchId + qty，单价由服务端 merchandise 表核定（防客户端伪造价格/数量） */
function normalizeMerchItems(items) {
  const rows = db.prepare('SELECT * FROM merchandise WHERE enabled = 1').all();
  const priceOf = new Map();
  rows.forEach(r => priceOf.set(r.merch_id, Number(r.price)));
  DEFAULT_MERCH.forEach(m => { if (!priceOf.has(m.merchId)) priceOf.set(m.merchId, Number(m.price)); });
  const out = [];
  for (const it of (Array.isArray(items) ? items : []).slice(0, 20)) {
    const merchId = clean(it && it.merchId, 40);
    if (!merchId || !priceOf.has(merchId)) continue;
    const qty = Math.max(1, Math.min(99, parseInt(it && (it.qty != null ? it.qty : it.count), 10) || 1));
    const price = priceOf.get(merchId);
    out.push({
      merchId, qty, count: qty, price,
      lineTotal: Math.round(price * qty * 100) / 100,
      fileID: clean(it && it.fileID, 300) || ''
    });
  }
  return out;
}

actions.selectMerch = (payload) => {
  const chk = requireOrder(payload.orderId, payload.webToken);
  if (chk.error) return chk.error;
  const o = chk.order;
  const items = normalizeMerchItems(payload.items);
  if (!items.length) return fail('VALIDATION_ERROR', '周边清单无效');
  /* 状态机守卫：已完结/已关闭/已取消的订单不能被拉回制作态 */
  const moved = db.prepare('UPDATE orders SET merch_selected = ?, order_status = ?, updated_at = ? WHERE order_id = ? AND order_status NOT IN (?, ?, ?)')
    .run(JSON.stringify(items), 'merch_pending', nowStr(), o.order_id, 'completed', 'closed', 'cancelled');
  if (!moved.changes) return fail('INVALID_STATUS', '当前状态不可选择周边');
  const total = items.reduce((s, it) => s + it.lineTotal, 0);
  audit(o.order_id, 'customer', 'select_merch', { count: items.length, total });
  return ok({ orderStatus: 'merch_pending', merch_total: Math.round(total * 100) / 100 });
};

const analysisQuota = new Map();
setInterval(() => analysisQuota.clear(), 3600 * 1000).unref();
const ANALYSIS_MAX_PER_HOUR = parseInt(process.env.PM_ANALYSIS_MAX || '10', 10);

actions.analyzePhoto = async (payload, req, identity) => {
  const fileID = clean(payload.fileID, 300);
  if (!fileID) return fail('VALIDATION_ERROR', '缺少分析图片');
  /* 只允许分析本站上传的图片：挡住任意 URL（SSRF）与拿别人 fileID 烧付费模型 */
  const fileIDOk = fileID.startsWith(PUBLIC_ORIGIN + '/PM/uploads/') || fileID.startsWith('cloud://');
  if (!fileIDOk) return fail('VALIDATION_ERROR', '仅支持分析本站上传的图片');
  /* 该 action 无需订单凭证（下单前 AI 推荐主题用），故单独设配额防刷：小程序侧按 openid，网页侧按 IP */
  const key = String(identity || (req && (req.headers['x-real-ip'] || req.socket.remoteAddress)) || 'unknown');
  const used = (analysisQuota.get(key) || 0) + 1;
  analysisQuota.set(key, used);
  if (used > ANALYSIS_MAX_PER_HOUR) return fail('RATE_LIMITED', 'AI 分析次数已达上限，请稍后再试');
  try {
    const analysis = await ai.analyzePhoto(fileID);
    return ok({ analysis });
  } catch (e) {
    return fail('ANALYSIS_FAILED', '照片分析失败，请稍后重试');
  }
};


app.post('/api/open', async (req, res) => {
  const action = clean(req.body && req.body.action, 30);
  const payload = req.body && typeof req.body.payload === 'object' ? req.body.payload : {};
  const handler = actions[action];
  if (!handler) return res.json(fail('VALIDATION_ERROR', '不支持的 action'));
  try {
    const result = await handler(payload, req);
    res.json(result);
  } catch (e) {
    console.error('action failed:', action, e);
    res.json(fail('INTERNAL_ERROR', '服务开小差了，请稍后重试'));
  }
});

/* ============================================================
 * 小程序兼容层：云函数名 → 独立后端语义（响应形状对齐云函数版）
 * 登录：POST /api/wx/login {deviceId} → {token, openid}
 *       （预留 code2session：配置 WX_APPSECRET 后 {code} 换真实 openid）
 * 鉴权：X-User-Token（HMAC token，openid 绑定订单归属）
 * ============================================================ */
const WX_SECRET = ADMIN_PASSWORD + '::wx-user';
const signUser = (data) => crypto.createHmac('sha256', WX_SECRET).update(data).digest('hex').slice(0, 32);
const makeUserToken = (openid) => {
  const exp = Date.now() + 90 * 24 * 3600 * 1000;
  const body = openid + '.' + exp;
  return body + '.' + signUser(body);
};
const verifyUserToken = (token) => {
  if (!token) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const openid = parts[0];
  if (Number(parts[1]) < Date.now()) return null;
  return signUser(parts[0] + '.' + parts[1]) === parts[2] ? openid : null;
};

app.post('/api/wx/login', async (req, res) => {
  const deviceId = clean(req.body && req.body.deviceId, 64);
  const code = clean(req.body && req.body.code, 200);
  let openid = '';
  if (code && process.env.WX_APPSECRET) {
    try {
      const r = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${process.env.WX_APPID || ''}&secret=${process.env.WX_APPSECRET}&js_code=${code}&grant_type=authorization_code`);
      const j = await r.json();
      if (j.openid) openid = 'wx-' + j.openid;
    } catch (e) { /* fallback below */ }
  }
  if (!openid) {
    if (!deviceId) return res.json(fail('VALIDATION_ERROR', '缺少登录凭证'));
    openid = 'dev-' + sha256(deviceId).slice(0, 20);
  }
  res.json(ok({ token: makeUserToken(openid), openid }));
});

const wxActions = {};
/* ---- 小程序管理端适配（口令直验，无 token） ---- */
const verifyAdminPassword = (p) => Boolean(p) && p === ADMIN_PASSWORD;
function wxAdmin(payload) {
  return Boolean(payload && payload.adminPassword && verifyAdminPassword(payload.adminPassword));
}

wxActions.adminLogin = (payload) => {
  if (!verifyAdminPassword(payload && payload.password)) return fail('FORBIDDEN', '口令错误');
  return ok({ token: makeAdminToken() });
};
wxActions.adminListAIStudioOrders = (payload) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  const status = clean(payload.status, 30);
  const rows = status
    ? db.prepare('SELECT * FROM orders WHERE order_status = ? ORDER BY created_at DESC LIMIT 100').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100').all();
  const orders = rows.map(o => {
    const v = wxOrderDetail(o, orderFiles(o.order_id));
    v.contactPhone = o.contact_phone;
    v.paid = Boolean(o.paid);
    v.amount = o.amount;
    v.productName = o.product_name;
    v.productType = o.product_type;
    v.photoReview = o.photo_review;
    return v;
  });
  return ok({ orders });
};
wxActions.adminReviewAIStudioOrder = (payload) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  const o = getOrder(clean(payload.orderId, 40));
  if (!o) return fail('NOT_FOUND', '订单不存在');
  const decision = clean(payload.decision, 20) || clean(payload.action, 20);
  if (decision === 'pass') {
    /* 状态机守卫 + 幂等：只有真正从待审态迁移到 queued 才触发出图，重复 pass 不再重复烧钱 */
    const moved = db.prepare('UPDATE orders SET photo_review = ?, order_status = ?, updated_at = ? WHERE order_id = ? AND order_status IN (?, ?, ?)')
      .run('passed', 'queued', nowStr(), o.order_id, 'photo_review', 'waiting_photos', 'waiting_authorization');
    if (moved.changes) kickAutoGenerate(o.order_id);
  } else if (decision === 'retake' || decision === 'need_retake') {
    db.prepare('UPDATE orders SET photo_review = ?, photo_note = ?, order_status = ?, updated_at = ? WHERE order_id = ?')
      .run('need_retake', clean(payload.note || payload.reason, 200) || '照片需要重拍', 'waiting_photos', nowStr(), o.order_id);
    notify.send('photo_review', o, { source: 'admin_need_retake' }).catch(() => {});
  } else {
    db.prepare('UPDATE orders SET photo_review = ?, order_status = ?, updated_at = ? WHERE order_id = ?').run('rejected', 'cancelled', nowStr(), o.order_id);
    notify.send('photo_review', o, { source: 'admin_reject' }).catch(() => {});
  }
  audit(o.order_id, 'admin', 'wx_review_' + decision, {});
  return ok();
};
wxActions.adminMarkAIStudioOrderPaid = (payload) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  const o = getOrder(clean(payload.orderId, 40));
  if (!o) return fail('NOT_FOUND', '订单不存在');
  db.prepare('UPDATE orders SET paid = 1, paid_at = ?, updated_at = ? WHERE order_id = ?').run(nowStr(), nowStr(), o.order_id);
  audit(o.order_id, 'admin', 'wx_mark_paid', {});
  return ok();
};
wxActions.adminDeliverAIStudioOrder = (payload) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  const o = getOrder(clean(payload.orderId, 40));
  if (!o) return fail('NOT_FOUND', '订单不存在');
  db.prepare('UPDATE orders SET order_status = ?, closed_at = ?, updated_at = ? WHERE order_id = ?').run('completed', nowStr(), nowStr(), o.order_id);
  audit(o.order_id, 'admin', 'wx_deliver', {});
  return ok({ order: { orderId: o.order_id, order_status: 'completed' } });
};
wxActions.adminSetAIStudioPaymentQR = (payload) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  const fileID = clean(payload.qrFileID || payload.fileID, 300);
  if (!fileID) return fail('VALIDATION_ERROR', '缺少收款码图片');
  db.prepare('INSERT INTO config_kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
    .run('payment_qr', JSON.stringify({ fileID: fileID, note: clean(payload.note, 100) }), nowStr());
  audit(null, 'admin', 'wx_set_payment_qr', {});
  return ok();
};
wxActions.adminUpsertAIStudioSamples = (payload) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  const samples = Array.isArray(payload.samples) ? payload.samples : [];
  let n = 0;
  for (const s of samples) {
    const themeId = clean(s.themeId, 32);
    const url = clean(s.fileUrl || s.fileID, 300);
    if (!themeId || !url) continue;
    const id = clean(s.sampleId, 64) || rid('smp');
    db.prepare(`INSERT INTO samples (sample_id, theme_id, file_url, caption, sort_order, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sample_id) DO UPDATE SET theme_id=excluded.theme_id, file_url=excluded.file_url, caption=excluded.caption, sort_order=excluded.sort_order, enabled=excluded.enabled`)
      .run(id, themeId, url, clean(s.caption, 100), Number(s.sortOrder) || 0, s.enabled === false ? 0 : 1, nowStr());
    n++;
  }
  audit(null, 'admin', 'wx_upsert_samples', { count: n });
  return ok({ updated: n });
};
wxActions.adminUpsertAIStudioBusinessConfig = (payload) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  const cfg = payload.config || payload;
  /* 直接按 v1 键名落库，photosPerTheme 不再丢弃 */
  const cur = getPricing();
  const p = {
    baseThemePrice: Number(cfg.baseThemePrice) || cur.baseThemePrice,
    extraThemePrice: Number(cfg.extraThemePrice) || cur.extraThemePrice,
    maxThemes: Number(cfg.maxThemes) || cur.maxThemes,
    photosPerTheme: Number(cfg.photosPerTheme) || cur.photosPerTheme
  };
  db.prepare('INSERT INTO config_kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
    .run('pricing', JSON.stringify(p), nowStr());
  audit(null, 'admin', 'wx_set_pricing', {});
  return ok();
};
wxActions.adminUpdateMerchProduction = (payload) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  const o = getOrder(clean(payload.orderId, 40));
  if (!o) return fail('NOT_FOUND', '订单不存在');
  const status = clean(payload.status, 30);
  if (!['merch_pending', 'in_production', 'completed'].includes(status)) return fail('VALIDATION_ERROR', '状态无效');
  db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?').run(status, nowStr(), o.order_id);
  audit(o.order_id, 'admin', 'wx_merch_production', { status });
  return ok({ order: { orderId: o.order_id, order_status: status } });
};
wxActions.generateAIStudioImage = async (payload, openid) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  const o = getOrder(clean(payload.orderId, 40));
  if (!o) return fail('NOT_FOUND', '订单不存在');
  const stage = clean(payload.stage, 10);
  const customerPhotos = orderFiles(o.order_id, 'customer');
  if (!customerPhotos.length) return fail('VALIDATION_ERROR', '订单无客户照片');
  try {
    if (stage === 'grid') {
      const themeId = (JSON.parse(o.themes)[0] || {}).themeId;
      const refPrompt = ai.buildPrompt('reference', { themeCount: JSON.parse(o.themes).length, sceneDesc: o.scene_desc || '' });
      const prompt = ai.buildPrompt('grid', { themeId, sceneDesc: o.scene_desc || '' });
      const ref = await ai.generateImage(refPrompt);
      await ai.saveUpload(path.join('orders', o.order_id, 'reference.png'), ref.buffer);
      const grid = await ai.generateImage(prompt);
      const gridUrl = await ai.saveUpload(path.join('orders', o.order_id, 'grid.png'), grid.buffer);
      db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(rid('file'), o.order_id, 'grid_preview', gridUrl, nowStr());
      db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?').run('grid_preview', nowStr(), o.order_id);
      audit(o.order_id, 'admin', 'wx_generate_grid', {});
      return ok({ file: { fileID: gridUrl }, order: { orderId: o.order_id, order_status: 'grid_preview' } });
    }
    if (stage === 'cell') {
      if (o.order_status !== 'cell_selected') return fail('VALIDATION_ERROR', '客户尚未选片');
      const cells = JSON.parse(o.selected_cells || '[]');
      const themeId = (JSON.parse(o.themes)[0] || {}).themeId;
      for (const cell of cells) {
        const img = await ai.generateImage(ai.buildPrompt('cell', { cell, themeId }));
        const url = await ai.saveUpload(path.join('orders', o.order_id, 'cell-' + cell + '.png'), img.buffer);
        db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(rid('file'), o.order_id, 'delivery', url, nowStr());
      }
      db.prepare('UPDATE orders SET order_status = ?, delivered_at = ?, updated_at = ? WHERE order_id = ?')
        .run('delivered', nowStr(), nowStr(), o.order_id);
      audit(o.order_id, 'admin', 'wx_generate_cells', { count: cells.length });
      return ok({ order: { orderId: o.order_id, order_status: 'delivered' } });
    }
    if (stage === 'idphoto') {
      /* 证件照成品：走自部署 HivisionIDPhotos 引擎（抠图 → 加底色 → 排版照），与旧实现逐字段对齐 */
      if (o.product_type !== 'standard') {
        return fail('VALIDATION_ERROR', '该订单不是证件照订单（人像写真订单请使用 grid/cell 阶段）');
      }
      const engine = idPhotoEngineConfig();
      if (!engine.enabled || !engine.apiUrl) {
        return fail('CONFIG_MISSING', '证件照引擎未配置，请在管理后台-模型设置中填写证件照引擎地址（HivisionIDPhotos 服务地址，如 http://ip:8080）');
      }
      const sourceBuffer = readUploadBuffer(customerPhotos[customerPhotos.length - 1].url);
      if (!sourceBuffer || !sourceBuffer.length) {
        return fail('GENERATION_FAILED', '证件照生成失败（读取客户照片）');
      }

      const spec = idphoto.normalizeSpec(o.spec);
      const background = idphoto.normalizeBackground(o.background_color);

      let mattedBuffer;
      try {
        mattedBuffer = await idphoto.matting(engine.apiUrl, sourceBuffer, spec, { faceAlignment: engine.faceAlignment });
      } catch (err) {
        const detail = String((err && err.message) || err).slice(0, 200);
        return fail('GENERATION_FAILED', '证件照生成失败（抠图阶段）：' + detail);
      }

      let photoBuffer;
      try {
        photoBuffer = await idphoto.addBackground(engine.apiUrl, mattedBuffer, background.hex);
      } catch (err) {
        const detail = String((err && err.message) || err).slice(0, 200);
        return fail('GENERATION_FAILED', '证件照生成失败（底色合成阶段）：' + detail);
      }

      const stamp = Date.now();
      const fileUrl = await ai.saveUpload(path.join('orders', o.order_id, 'idphoto-' + stamp + '.jpg'), photoBuffer);
      db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(rid('file'), o.order_id, 'generated', fileUrl, nowStr());

      /* 排版照是附赠产物，失败不阻断（主成品已生成成功） */
      let layoutUrl = null;
      const layoutBuffer = await idphoto.layoutPhoto(engine.apiUrl, photoBuffer, spec);
      if (layoutBuffer) {
        layoutUrl = await ai.saveUpload(path.join('orders', o.order_id, 'layout-' + stamp + '.jpg'), layoutBuffer);
        db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(rid('file'), o.order_id, 'generated', layoutUrl, nowStr());
      }

      audit(o.order_id, 'admin', 'generate_ai_image', {
        stage: 'idphoto',
        spec: spec.name,
        backgroundColor: background.hex,
        engine: 'hivision',
        fileID: fileUrl
      });

      /* 不改订单状态：管理员预览成品后走现有交付流程（与旧实现一致） */
      return ok({
        file: { fileID: fileUrl, fileType: 'generated', stage: 'idphoto' },
        layout: layoutUrl ? { fileID: layoutUrl } : null,
        order: { orderId: o.order_id, order_status: o.order_status }
      });
    }
    return fail('VALIDATION_ERROR', 'stage 须为 grid/cell/idphoto');
  } catch (e) {
    if (e.code === 'CONFIG_MISSING') return fail('CONFIG_MISSING', e.message);
    console.error('[generate]', e && e.message);
    return fail('GENERATION_FAILED', 'AI 生成失败，请稍后重试');
  }
};
const wxNotImplemented = (feature, alt) => () => fail('NOT_IMPLEMENTED', feature + ' 已迁移至网站管理后台：' + alt);
wxActions.exportAIStudioPrintFile = wxNotImplemented('300DPI 制作稿导出', 'www.czpsm.art/PM/admin.html');
wxActions.adminUploadAIStudioGridPreview = wxNotImplemented('手动上传网格', 'www.czpsm.art/PM/admin.html');

/* 运行期模型设置（存 config_kv，供小程序管理面板读写）：
   image_generation（生图接口）+ idphoto_engine（证件照引擎地址）。
   apiKey 只入库、永不回传，与旧云函数一致。 */
const MODEL_SETTINGS_KEY = 'model_settings';
const MODEL_SETTING_SCENES = ['image_generation', 'idphoto_engine'];

function cleanModelSetting(item) {
  if (!item || typeof item !== 'object') return null;
  const scene = clean(item.scene, 40);
  if (MODEL_SETTING_SCENES.indexOf(scene) === -1) return null;
  const entry = { scene };
  if (item.apiUrl != null) entry.apiUrl = clean(item.apiUrl, 300);
  if (item.model != null) entry.model = clean(item.model, 120);
  if (item.imageSize != null) entry.imageSize = clean(item.imageSize, 20);
  if (item.provider != null) entry.provider = clean(item.provider, 40);
  if (item.publicName != null) entry.publicName = clean(item.publicName, 40);
  if (item.enabled != null) entry.enabled = item.enabled === true;
  if (item.faceAlignment != null) entry.faceAlignment = item.faceAlignment !== false;
  if (scene === 'image_generation' && item.apiKey) entry.apiKey = String(item.apiKey).slice(0, 200);
  return entry;
}

function readModelSettings() {
  const row = db.prepare('SELECT value FROM config_kv WHERE key = ?').get(MODEL_SETTINGS_KEY);
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function writeModelSettings(list) {
  const safe = [];
  (Array.isArray(list) ? list : []).slice(0, 10).forEach(item => {
    const entry = cleanModelSetting(item);
    if (entry) safe.push(entry);
  });
  db.prepare(`INSERT INTO config_kv (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .run(MODEL_SETTINGS_KEY, JSON.stringify(safe), nowStr());
  return safe;
}

/* 回传前剥掉 apiKey（密钥不出服务端） */
function publicModelSettings() {
  return readModelSettings().map(s => {
    const out = Object.assign({}, s);
    delete out.apiKey;
    return out;
  });
}

/* 证件照引擎配置：模型面板优先，其次环境变量 PM_IDPHOTO_ENGINE_URL */
function idPhotoEngineConfig() {
  const hit = readModelSettings().find(s => s && s.scene === 'idphoto_engine') || null;
  const envUrl = clean(process.env.PM_IDPHOTO_ENGINE_URL, 300);
  const apiUrl = (hit && hit.apiUrl) || envUrl || '';
  return {
    apiUrl,
    enabled: hit && hit.enabled != null ? hit.enabled !== false : Boolean(envUrl),
    faceAlignment: hit && hit.faceAlignment != null ? hit.faceAlignment !== false : true
  };
}

wxActions.adminUpsertAIStudioRuntimeConfig = (payload) => {
  if (!wxAdmin(payload)) return fail('FORBIDDEN', '口令错误');
  if (!Array.isArray(payload.modelSettings)) return fail('VALIDATION_ERROR', 'modelSettings 无效');
  const saved = writeModelSettings(payload.modelSettings);
  audit('', 'admin', 'upsert_runtime_config', { scenes: saved.map(s => s.scene) });
  return ok({ modelSettings: publicModelSettings() });
};
wxActions.getAIStudioRuntimeConfig = () => ok({ config: { modelSettings: publicModelSettings() } });

function wxUser(req) {
  return verifyUserToken(req.headers['x-user-token']);
}

function requireOrderWx(orderId, openid) {
  const o = getOrder(clean(orderId, 40));
  if (!o) return { error: fail('NOT_FOUND', '订单不存在') };
  if (!openid || o.openid !== openid) return { error: fail('FORBIDDEN', '无权访问该订单') };
  return { order: o };
}

/* 云数据库文档形状的订单视图（detail 页消费） */
function wxOrderDetail(o, files) {
  const byType = (t) => files.filter(f => f.file_type === t);
  const themes = JSON.parse(o.themes || '[]');
  const merchItems = JSON.parse(o.merch_selected || '[]');
  const delivery = byType('delivery').map(f => f.url);
  const photoCheckText = { unchecked: '未审核', passed: '照片合格', need_retake: '需要重拍', rejected: '不适合制作' }[o.photo_review] || '未审核';
  return {
    orderId: o.order_id,
    order_status: o.order_status,
    payment_status: o.paid ? 'paid' : 'unpaid',
    photo_check: o.photo_review,
    photoCheckText: photoCheckText,
    reviewNote: o.photo_note || '',
    productName: o.product_name,
    product_type: o.product_type,
    spec: o.spec || '',
    styleName: o.style_name || '',
    usage: '',
    reference_photo_count: byType('customer').length,
    themes: themes,
    theme_id: themes.length ? themes[0].themeId : '',
    theme_name: themes.length ? themes[0].themeName : '',
    selected_cells: JSON.parse(o.selected_cells || '[]'),
    delivery: delivery,
    delivery_file_count: delivery.length,
    merch_items: merchItems,
    merch_total: merchItems.reduce((s, it) => s + Number(it && it.price ? it.price : 0) * Number(it && it.count ? it.count : 1), 0),
    tracking: '',
    amount: o.amount,
    created_at: o.created_at
  };
}


wxActions.createAIStudioOrder = (payload, openid) => {
  const result = actions.createOrder(Object.assign({}, payload, { source: 'miniprogram' }));
  if (!result.success) return result;
  if (openid) db.prepare('UPDATE orders SET openid = ? WHERE order_id = ?').run(openid, result.orderId);
  return ok({ order: { orderId: result.orderId, order_status: 'waiting_photos', photo_check: 'unchecked' } });
};

wxActions.uploadAIStudioPhoto = (payload, openid) => {
  const chk = requireOrderWx(payload.orderId, openid);
  if (chk.error) return chk.error;
  const o = chk.order;
  if (!['waiting_photos', 'photo_review'].includes(o.order_status)) return fail('VALIDATION_ERROR', '当前状态不可上传');
  const fileID = clean(payload.fileID, 300);
  if (!fileID) return fail('VALIDATION_ERROR', '缺少文件');
  /* 只接受本站上传产生的文件地址（防伪造 fileID 混进管理后台渲染） */
  const fileIDOk = fileID.startsWith(PUBLIC_ORIGIN + '/PM/uploads/') || fileID.startsWith('cloud://');
  if (!fileIDOk) return fail('VALIDATION_ERROR', '文件地址不合法');
  const count = orderFiles(o.order_id, 'customer').length;
  if (count >= 3) return fail('VALIDATION_ERROR', '最多上传 3 张');
  db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, file_name, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(rid('file'), o.order_id, 'customer', fileID, clean(payload.fileName, 120), openid, nowStr());
  if (o.order_status === 'waiting_photos') {
    db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?').run('photo_review', nowStr(), o.order_id);
  }
  audit(o.order_id, openid, 'register_photo', { fileID });
  return ok({ fileId: rid('file'), referencePhotoCount: count + 1 });
};

wxActions.submitAIStudioOrder = (payload, openid) => {
  const chk = requireOrderWx(payload.orderId, openid);
  if (chk.error) return chk.error;
  const o = chk.order;
  const count = orderFiles(o.order_id, 'customer').length;
  if (count < 1) return fail('VALIDATION_ERROR', '请至少上传 1 张照片');
  db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?').run('photo_review', nowStr(), o.order_id);
  audit(o.order_id, openid, 'submit_order', { photos: count });
  notify.send('photo_review', o, { source: 'miniprogram' }).catch(e => console.warn('[notify]', e.message));
  return ok({ order: { orderId: o.order_id, order_status: 'photo_review', photo_check: 'unchecked', reference_photo_count: count } });
};

wxActions.getAIStudioOrderDetail = (payload, openid) => {
  const chk = requireOrderWx(payload.orderId, openid);
  if (chk.error) return chk.error;
  return ok({ order: wxOrderDetail(chk.order, orderFiles(chk.order.order_id)), files: publicFiles(chk.order.order_id) });
};

wxActions.listMyAIStudioOrders = (payload, openid) => {
  /* v1 契约：data + pagination{page,pageSize,total,hasMore}；page 默认 0，pageSize 默认 10、上限 30。
     `orders` 是旧别名，保留给仍读该键的调用方（tests/server.test.mjs 断言它），后续可收敛为单键。 */
  const rawPage = Number(payload && payload.page);
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
  const rawSize = Number(payload && payload.pageSize);
  const pageSize = Number.isInteger(rawSize) && rawSize > 0 ? Math.min(rawSize, 30) : 10;
  const total = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE openid = ?').get(openid).n;
  const rows = db.prepare('SELECT * FROM orders WHERE openid = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(openid, pageSize, page * pageSize);
  const data = rows.map(o => wxOrderDetail(o, orderFiles(o.order_id)));
  return ok({ data, orders: data, pagination: { page, pageSize, total, hasMore: (page + 1) * pageSize < total } });
};

wxActions.queryAIStudioOrder = async (payload) => {
  const result = actions.queryOrder(payload);
  if (!result.success) return result;
  const o = getOrder(payload.orderId);
  const files = publicFiles(o.order_id);
  return ok({ order: Object.assign({}, result.order, { webToken: undefined }), files });
};

wxActions.selectAIStudioPortraitCells = (payload, openid) => {
  const chk = requireOrderWx(payload.orderId, openid);
  if (chk.error) return chk.error;
  const o = chk.order;
  if (o.order_status !== 'grid_preview') return fail('VALIDATION_ERROR', '当前状态不可选片');
  const cells = Array.isArray(payload.cells) ? payload.cells.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 15) : [];
  const target = (o.product_type === 'portrait') ? 5 : (ORDER_PRODUCTS.find(p => p.productId === o.product_id) || {}).deliveryCount || 1;
  if (cells.length !== target) return fail('VALIDATION_ERROR', `请选择 ${target} 格`);
  db.prepare('UPDATE orders SET selected_cells = ?, order_status = ?, updated_at = ? WHERE order_id = ?')
    .run(JSON.stringify(cells), 'cell_selected', nowStr(), o.order_id);
  audit(o.order_id, openid, 'select_cells', { cells });
  return ok({ order: { orderId: o.order_id, order_status: 'cell_selected', selected_cells: cells } });
};

wxActions.selectAIStudioMerch = (payload, openid) => {
  const chk = requireOrderWx(payload.orderId, openid);
  if (chk.error) return chk.error;
  const o = chk.order;
  const items = normalizeMerchItems(payload.items);
  if (!items.length) return fail('VALIDATION_ERROR', '周边选择无效');
  /* 状态机守卫：已完结/已关闭/已取消的订单不能被拉回制作态 */
  const moved = db.prepare('UPDATE orders SET merch_selected = ?, order_status = ?, updated_at = ? WHERE order_id = ? AND order_status NOT IN (?, ?, ?)')
    .run(JSON.stringify(items), 'merch_pending', nowStr(), o.order_id, 'completed', 'closed', 'cancelled');
  if (!moved.changes) return fail('INVALID_STATUS', '当前状态不可选择周边');
  const total = items.reduce((s, it) => s + it.lineTotal, 0);
  audit(o.order_id, openid, 'select_merch', { count: items.length, total });
  return ok({ order: { orderId: o.order_id, order_status: 'merch_pending', merch_total: Math.round(total * 100) / 100 } });
};

wxActions.listAIStudioSamples = () => actions.samples();
wxActions.listAIStudioMerchandise = () => {
  const rows = db.prepare('SELECT * FROM merchandise WHERE enabled = 1 ORDER BY sort_order LIMIT 60').all();
  const data = rows.map(r => ({
    merchId: r.merch_id, name: r.name, category: r.category, desc: r.description,
    price: r.price, imageUrl: r.image_url, imageRatio: '4:5',
    printSpec: JSON.parse(r.print_spec || '{}'), sortOrder: r.sort_order
  }));
  return ok({ data: data.length ? data : DEFAULT_MERCH });
};
wxActions.getAIStudioBusinessConfig = () => ok({ config: getPricing() });
wxActions.getAIStudioPaymentQR = () => actions.paymentQR();
wxActions.analyzeAIStudioPhoto = (payload, openid) => actions.analyzePhoto(payload, null, openid);
wxActions.callAIStudioCustomerService = (payload, openid) => {
  const message = clean(payload.message || payload.question, 500);
  if (!message) return fail('VALIDATION_ERROR', '请输入咨询内容');
  return ok({ response: '您好，我是浅焦映像的客服助手。您的问题已收到：「' + message.slice(0, 60) + '」。拍摄相关的问题：上传清晰正脸照后由 AI 生成写真，成片 1-3 个工作日交付。如有订单问题请在订单页查询或联系商家微信。', provider: 'local_fallback' });
};

app.post('/api/open/wx/:action', async (req, res) => {
  const action = clean(req.params.action, 40);
  const handler = wxActions[action];
  if (!handler) return res.json(fail('VALIDATION_ERROR', '不支持的 action'));
  const openid = wxUser(req);
  const adminActions = ['adminLogin', 'adminListAIStudioOrders', 'adminReviewAIStudioOrder', 'adminMarkAIStudioOrderPaid', 'adminDeliverAIStudioOrder', 'adminSetAIStudioPaymentQR', 'adminUpsertAIStudioSamples', 'adminUpsertAIStudioBusinessConfig', 'adminUpdateMerchProduction', 'generateAIStudioImage', 'exportAIStudioPrintFile', 'adminUploadAIStudioGridPreview', 'adminUpsertAIStudioRuntimeConfig', 'getAIStudioRuntimeConfig'];
  const needsAuth = !adminActions.includes(action) && !['listAIStudioSamples', 'listAIStudioMerchandise', 'getAIStudioBusinessConfig', 'getAIStudioPaymentQR', 'queryAIStudioOrder', 'analyzeAIStudioPhoto'].includes(action);
  if (needsAuth && !openid) return res.json(fail('UNAUTHENTICATED', '请先登录'));
  try {
    res.json(await handler(req.body || {}, openid));
  } catch (e) {
    console.error('wx action failed:', action, e);
    res.json(fail('INTERNAL_ERROR', '服务开小差了，请稍后重试'));
  }
});

/* ---------------- 图片校验（魔数决定扩展名，防 .html/.svg 等被当页面执行） ---------------- */
const IMG_MAGIC = [
  { ext: '.jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: '.webp', test: (b) => b.length > 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' }
];
/* 客户端文件名一律不信任：扩展名按文件真实魔数决定，非图片返回 null */
function imageExt(buf) {
  if (!buf || !buf.length) return null;
  const hit = IMG_MAGIC.find(m => m.test(buf));
  return hit ? hit.ext : null;
}

/* 小程序上传：multipart，X-User-Token 鉴权（openid 归属校验在登记时做） */
app.post('/api/upload/wx', upload.single('file'), async (req, res) => {
  try {
    const openid = wxUser(req);
    if (!openid) return res.json(fail('UNAUTHENTICATED', '请先登录'));
    const { orderId, cloudPath } = req.body;
    if (orderId) {
      const chk = requireOrderWx(orderId, openid);
      if (chk.error) return res.json(chk.error);
    }
    if (!req.file) return res.json(fail('VALIDATION_ERROR', '缺少文件'));
    const safePath = (clean(cloudPath, 120) || 'photo-' + Date.now()).replace(/[^\w.-]/g, '_');
    const rel = path.join('orders', orderId || 'wx-analysis', safePath);
    const ext = imageExt(req.file.buffer);
    if (!ext) return res.json(fail('VALIDATION_ERROR', '仅支持 jpg/png/webp 图片'));
    const abs = path.join(UPLOAD_ROOT, rel + ext);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, req.file.buffer);
    res.json({ success: true, fileID: PUBLIC_ORIGIN + '/PM/uploads/' + (rel + ext).replace(/\\/g, '/') });
  } catch (e) {
    console.error('wx upload failed:', e);
    res.json(fail('INTERNAL_ERROR', '上传失败，请重试'));
  }
});


/* ---------------- 文件上传 ---------------- */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const { orderId, webToken, cloudPath } = req.body;
    const safePath = (clean(cloudPath, 120) || 'photo-' + Date.now()).replace(/[^\w.-]/g, '_');
    let rel;
    if (orderId) {
      const chk = requireOrder(orderId, webToken);
      if (chk.error) return res.json(chk.error);
      if (!req.file) return res.json(fail('VALIDATION_ERROR', '缺少文件'));
      rel = path.join('orders', orderId, safePath);
    } else {
      /* 无订单上下文：仅允许 analysis/ 前缀的 AI 分析用图（防滥用） */
      if (!safePath.startsWith('analysis')) return res.json(fail('FORBIDDEN', '无订单凭证的上传仅限 AI 分析用图'));
      if (!req.file) return res.json(fail('VALIDATION_ERROR', '缺少文件'));
      rel = path.join('analysis', safePath);
    }
    const ext = imageExt(req.file.buffer);
    if (!ext) return res.json(fail('VALIDATION_ERROR', '仅支持 jpg/png/webp 图片'));
    const abs = path.join(UPLOAD_ROOT, rel + ext);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, req.file.buffer);
    const fileID = PUBLIC_ORIGIN + '/PM/uploads/' + (rel + ext).replace(/\\/g, '/');
    res.json({ success: true, fileID });
  } catch (e) {
    console.error('upload failed:', e);
    res.json(fail('INTERNAL_ERROR', '上传失败，请重试'));
  }
});

/* ---------------- 管理端 ---------------- */
app.post('/api/admin/login', (req, res) => {
  if (clean(req.body && req.body.password, 64) !== ADMIN_PASSWORD) {
    return res.json(fail('FORBIDDEN', '口令错误'));
  }
  res.json(ok({ token: makeAdminToken() }));
});

function adminAuth(req, res, next) {
  if (!verifyAdmin(req.headers['x-admin-token'])) return res.json(fail('FORBIDDEN', '管理凭证无效，请重新登录'));
  next();
}
app.use('/api/admin', adminAuth);

/* 管理端文件上传（收款码图等）：存 uploads/payment/，返回公网 URL */
const adminUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
app.post('/api/admin/upload', adminUpload.single('file'), async (req, res) => {
  if (!req.file) return res.json(fail('VALIDATION_ERROR', '缺少文件'));
  const ext = imageExt(req.file.buffer);
  if (!ext) return res.json(fail('VALIDATION_ERROR', '仅支持 jpg/png/webp 图片'));
  const rel = path.join('payment', 'qr-' + Date.now() + ext);
  const abs = path.join(UPLOAD_ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, req.file.buffer);
  res.json(ok({ fileID: PUBLIC_ORIGIN + '/PM/uploads/' + rel.replace(/\\/g, '/') }));
});

/* 收款码配置：{ fileID, note } */
app.post('/api/admin/payment-qr', (req, res) => {
  const fileID = clean(req.body.fileID, 300);
  if (!fileID) return res.json(fail('VALIDATION_ERROR', '缺少收款码图片'));
  const value = { fileID: fileID, note: clean(req.body.note, 100) };
  db.prepare('INSERT INTO config_kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
    .run('payment_qr', JSON.stringify(value), nowStr());
  audit(null, 'admin', 'set_payment_qr', {});
  res.json(ok({ config: value }));
});

app.get('/api/admin/payment-qr', (req, res) => {
  const row = db.prepare("SELECT value FROM config_kv WHERE key = 'payment_qr'").get();
  res.json(ok({ config: row ? JSON.parse(row.value) : null }));
});

app.get('/api/admin/orders', (req, res) => {
  const status = clean(req.query.status, 30);
  const rows = status
    ? db.prepare('SELECT * FROM orders WHERE order_status = ? ORDER BY created_at DESC LIMIT 100').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100').all();
  res.json(ok({ orders: rows.map(maskOrder) }));
});

app.post('/api/admin/order/:id/review', (req, res) => {
  const o = getOrder(req.params.id);
  if (!o) return res.json(fail('NOT_FOUND', '订单不存在'));
  const decision = clean(req.body.decision, 20);
  if (decision === 'pass') {
    /* 状态机守卫 + 幂等：只有真正从待审态迁移到 queued 才触发出图，重复 pass 不再重复烧钱 */
    const moved = db.prepare('UPDATE orders SET photo_review = ?, order_status = ?, updated_at = ? WHERE order_id = ? AND order_status IN (?, ?, ?)')
      .run('passed', 'queued', nowStr(), o.order_id, 'photo_review', 'waiting_photos', 'waiting_authorization');
    if (moved.changes) kickAutoGenerate(o.order_id);
  } else if (decision === 'retake') {
    db.prepare('UPDATE orders SET photo_review = ?, photo_note = ?, order_status = ?, updated_at = ? WHERE order_id = ?')
      .run('need_retake', clean(req.body.note, 200) || '照片需要重拍', 'waiting_photos', nowStr(), o.order_id);
  } else if (decision === 'reject') {
    db.prepare('UPDATE orders SET photo_review = ?, order_status = ?, updated_at = ? WHERE order_id = ?')
      .run('rejected', 'cancelled', nowStr(), o.order_id);
  } else {
    return res.json(fail('VALIDATION_ERROR', 'decision 须为 pass/retake/reject'));
  }
  audit(o.order_id, 'admin', 'review_' + decision, { note: req.body.note || '' });
  res.json(ok({ autoGen: decision === 'pass' ? { kicked: true } : null }));
});

/* AI 生成：stage = grid | cell（需要订单已到对应状态） */
app.post('/api/admin/order/:id/generate', async (req, res) => {
  const o = getOrder(req.params.id);
  if (!o) return res.json(fail('NOT_FOUND', '订单不存在'));
  const stage = clean(req.body.stage, 10);
  const customerPhotos = orderFiles(o.order_id, 'customer');
  if (!customerPhotos.length) return res.json(fail('VALIDATION_ERROR', '订单无客户照片'));

  try {
    if (stage === 'grid') {
      if (!['queued', 'photo_review'].includes(o.order_status)) return res.json(fail('VALIDATION_ERROR', '当前状态不可生成网格'));
      const themeId = (JSON.parse(o.themes)[0] || {}).themeId;
      const prompt = ai.buildPrompt('grid', { themeId, sceneDesc: o.scene_desc || '' });
      const refPrompt = ai.buildPrompt('reference', { themeCount: JSON.parse(o.themes).length, sceneDesc: o.scene_desc || '' });
      // 参考图 + 网格两步（参考图先锚定人物）
      const ref = await ai.generateImage(refPrompt);
      const refUrl = await ai.saveUpload(path.join('orders', o.order_id, 'reference.png'), ref.buffer);
      db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(rid('file'), o.order_id, 'generated', refUrl, nowStr());
      const grid = await ai.generateImage(prompt);
      const gridUrl = await ai.saveUpload(path.join('orders', o.order_id, 'grid.png'), grid.buffer);
      db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(rid('file'), o.order_id, 'grid_preview', gridUrl, nowStr());
      db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?').run('grid_preview', nowStr(), o.order_id);
      audit(o.order_id, 'admin', 'generate_grid', { refUrl, gridUrl });
      return res.json(ok({ gridUrl, refUrl, orderStatus: 'grid_preview' }));
    }
    if (stage === 'cell') {
      if (o.order_status !== 'cell_selected') return res.json(fail('VALIDATION_ERROR', '客户尚未选片'));
      const cells = JSON.parse(o.selected_cells || '[]');
      const themeId = (JSON.parse(o.themes)[0] || {}).themeId;
      const urls = [];
      for (const cell of cells) {
        const prompt = ai.buildPrompt('cell', { cell, themeId });
        const img = await ai.generateImage(prompt);
        const url = await ai.saveUpload(path.join('orders', o.order_id, 'cell-' + cell + '.png'), img.buffer);
        db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(rid('file'), o.order_id, 'delivery', url, nowStr());
        urls.push(url);
      }
      db.prepare('UPDATE orders SET order_status = ?, delivered_at = ?, updated_at = ? WHERE order_id = ?')
        .run('delivered', nowStr(), nowStr(), o.order_id);
      audit(o.order_id, 'admin', 'generate_cells', { count: urls.length });
      return res.json(ok({ urls, orderStatus: 'delivered' }));
    }
    res.json(fail('VALIDATION_ERROR', 'stage 须为 grid/cell'));
  } catch (e) {
    console.error('generate failed:', e);
    if (e.code === 'CONFIG_MISSING') return res.json(fail('CONFIG_MISSING', e.message));
    console.error('[generate]', e && e.message);
    res.json(fail('GENERATION_FAILED', 'AI 生成失败，请稍后重试'));
  }
});

app.post('/api/admin/order/:id/mark-paid', (req, res) => {
  const o = getOrder(req.params.id);
  if (!o) return res.json(fail('NOT_FOUND', '订单不存在'));
  db.prepare('UPDATE orders SET paid = 1, paid_at = ?, updated_at = ? WHERE order_id = ?').run(nowStr(), nowStr(), o.order_id);
  audit(o.order_id, 'admin', 'mark_paid', {});
  res.json(ok());
});

app.post('/api/admin/order/:id/deliver', (req, res) => {
  const o = getOrder(req.params.id);
  if (!o) return res.json(fail('NOT_FOUND', '订单不存在'));
  const next = o.product_type === 'portrait' ? 'completed' : 'completed';
  db.prepare('UPDATE orders SET order_status = ?, closed_at = ?, updated_at = ? WHERE order_id = ?').run(next, nowStr(), nowStr(), o.order_id);
  audit(o.order_id, 'admin', 'deliver', {});
  res.json(ok({ orderStatus: next }));
});

app.post('/api/admin/samples', (req, res) => {
  const samples = Array.isArray(req.body.samples) ? req.body.samples : [];
  let n = 0;
  for (const s of samples) {
    const themeId = clean(s.themeId, 32);
    const url = clean(s.fileUrl || s.fileID, 300);
    if (!themeId || !url) continue;
    const id = clean(s.sampleId, 64) || rid('smp');
    db.prepare(`INSERT INTO samples (sample_id, theme_id, file_url, caption, sort_order, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sample_id) DO UPDATE SET theme_id=excluded.theme_id, file_url=excluded.file_url,
      caption=excluded.caption, sort_order=excluded.sort_order, enabled=excluded.enabled`)
      .run(id, themeId, url, clean(s.caption, 100), Number(s.sortOrder) || 0, s.enabled === false ? 0 : 1, nowStr());
    n++;
  }
  audit(null, 'admin', 'upsert_samples', { count: n });
  res.json(ok({ updated: n }));
});

app.post('/api/admin/config', (req, res) => {
  const key = clean(req.body.key, 30);
  if (!['pricing', 'payment_qr', 'runtime'].includes(key)) return res.json(fail('VALIDATION_ERROR', 'key 无效'));
  db.prepare('INSERT INTO config_kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
    .run(key, JSON.stringify(req.body.value), nowStr());
  audit(null, 'admin', 'set_config', { key });
  res.json(ok());
});

app.get('/api/admin/audit', (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all();
  res.json(ok({ logs: rows }));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`photomuse-server listening on 127.0.0.1:${PORT}`);
});
