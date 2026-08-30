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
const { ORDER_PRODUCTS, PORTRAIT_THEMES, STYLES, DEFAULT_PRICING, STATUS_LABELS } = require('./lib/catalog');
const ai = require('./lib/ai');

const PORT = process.env.PORT || 8900;
const ADMIN_PASSWORD = process.env.PM_ADMIN_PASSWORD || '';
const PUBLIC_ORIGIN = process.env.PM_PUBLIC_ORIGIN || 'https://www.czpsm.art';
const UPLOAD_ROOT = process.env.PM_UPLOAD_ROOT || path.join(__dirname, 'uploads');
if (!ADMIN_PASSWORD) { console.error('缺少 PM_ADMIN_PASSWORD 环境变量'); process.exit(1); }

seedConfig('pricing', DEFAULT_PRICING);

const app = express();
app.use(express.json({ limit: '2mb' }));

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

const fail = (code, message) => ({ success: false, code, message });
const ok = (extra) => Object.assign({ success: true }, extra || {});

function audit(orderId, actor, action, payload) {
  db.prepare('INSERT INTO audit_logs (order_id, actor, action, payload, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(orderId || null, actor, action, JSON.stringify(payload || {}), nowStr());
}

function getPricing() {
  const row = db.prepare('SELECT value FROM config_kv WHERE key = ?').get('pricing');
  try { return JSON.parse(row.value); } catch (e) { return DEFAULT_PRICING; }
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
  const rows = db.prepare("SELECT * FROM merchandise WHERE enabled = 1").all();
  const pricing = getPricing();
  const categories = {};
  rows.forEach(r => { categories[r.category] = categories[r.category] || { categoryId: r.category, items: [] }; });
  return ok({ config: { pricing } });
};

actions.paymentQR = () => {
  const row = db.prepare("SELECT value FROM config_kv WHERE key = 'payment_qr'").get();
  return ok({ qr: row ? JSON.parse(row.value) : null });
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

  const amount = isPortrait
    ? pricing.basePrice + Math.max(0, themes.length - (pricing.freeThemes || 1)) * pricing.perTheme
    : product.price;

  const orderId = rid('PM');
  const webToken = crypto.randomBytes(18).toString('hex');
  db.prepare(`INSERT INTO orders (order_id, product_type, product_id, product_name, source, contact_phone,
    query_password_hash, web_token_hash, amount, themes, style_id, style_name, scene_desc, background_color,
    order_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting_photos', ?, ?)`).run(
    orderId, product.productType, product.productId, product.name,
    clean(payload.source, 10) || 'web', phone, sha256(pwd), sha256(webToken),
    amount, JSON.stringify(themes), style ? style.styleId : null, style ? style.name : null,
    clean(payload.sceneDesc, 300) || null, style ? style.backgroundColor : null, nowStr(), nowStr()
  );
  audit(orderId, 'customer', 'create_order', { productId: product.productId, themes });

  return ok({ orderId, webToken, amount, orderStatus: 'waiting_photos' });
};

function requireOrder(orderId, webToken) {
  const o = getOrder(clean(orderId, 40));
  if (!o) return { error: fail('NOT_FOUND', '订单不存在') };
  if (!webToken || sha256(String(webToken)) !== o.web_token_hash) return { error: fail('FORBIDDEN', '订单凭证无效') };
  return { order: o };
}

actions.registerPhoto = (payload) => {
  const chk = requireOrder(payload.orderId, payload.webToken);
  if (chk.error) return chk.error;
  const o = chk.order;
  if (!['waiting_photos', 'photo_review'].includes(o.order_status)) return fail('VALIDATION_ERROR', '当前状态不可上传');
  const fileID = clean(payload.fileID, 300);
  if (!fileID) return fail('VALIDATION_ERROR', '缺少文件');
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
  return ok({ orderStatus: 'photo_review' });
};

actions.getOrder = (payload) => {
  const chk = requireOrder(payload.orderId, payload.webToken);
  if (chk.error) return chk.error;
  return ok({ order: orderView(chk.order) });
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
  return ok({ order: maskOrder(o) });
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

actions.selectMerch = (payload) => {
  const chk = requireOrder(payload.orderId, payload.webToken);
  if (chk.error) return chk.error;
  const o = chk.order;
  if (!Array.isArray(payload.items)) return fail('VALIDATION_ERROR', '周边清单无效');
  db.prepare('UPDATE orders SET merch_selected = ?, order_status = ?, updated_at = ? WHERE order_id = ?')
    .run(JSON.stringify(payload.items.slice(0, 20)), 'merch_pending', nowStr(), o.order_id);
  audit(o.order_id, 'customer', 'select_merch', { count: payload.items.length });
  return ok({ orderStatus: 'merch_pending' });
};

actions.analyzePhoto = async (payload) => {
  const fileID = clean(payload.fileID, 300);
  if (!fileID) return fail('VALIDATION_ERROR', '缺少分析图片');
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
    const result = await handler(payload);
    res.json(result);
  } catch (e) {
    console.error('action failed:', action, e);
    res.json(fail('INTERNAL_ERROR', '服务开小差了，请稍后重试'));
  }
});

/* ---------------- 文件上传 ---------------- */
app.post('/api/upload', upload.single('file'), (req, res) => {
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
    const ext = (path.extname(req.file.originalname || '') || '.jpg').slice(0, 6).toLowerCase();
    const abs = path.join(UPLOAD_ROOT, rel + ext);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, req.file.buffer);
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
    db.prepare('UPDATE orders SET photo_review = ?, order_status = ?, updated_at = ? WHERE order_id = ?')
      .run('passed', 'queued', nowStr(), o.order_id);
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
  res.json(ok());
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
      const refUrl = ai.saveUpload(path.join('orders', o.order_id, 'reference.png'), ref.buffer);
      db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(rid('file'), o.order_id, 'generated', refUrl, nowStr());
      const grid = await ai.generateImage(prompt);
      const gridUrl = ai.saveUpload(path.join('orders', o.order_id, 'grid.png'), grid.buffer);
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
        const url = ai.saveUpload(path.join('orders', o.order_id, 'cell-' + cell + '.png'), img.buffer);
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
    res.json(fail('GENERATION_FAILED', 'AI 生成失败：' + String(e.message).slice(0, 120)));
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
