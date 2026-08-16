const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// ---------------------------------------------------------------------------
// 服务端目录常量（与 miniprogram/utils/ai-studio-config.js 同构的独立副本，
// 不 cross-require，避免并行改动互相影响；新增套餐时此处同步维护）
// ---------------------------------------------------------------------------

const PRODUCTS = [
  {
    productId: 'id_photo_9_9',
    name: '3.9 证件照体验版',
    price: 3.9,
    deliveryCount: 1,
    productionLine: 'auto',
    description: '1 个规格，1 张高清电子版，适合考试报名、身份照、社保资料。'
  },
  {
    productId: 'resume_photo_29_9',
    name: '29.9 简历形象照',
    price: 29.9,
    deliveryCount: 3,
    productionLine: 'semi_auto',
    description: '1 个商务风格，适合简历、职业平台和工牌头像。'
  },
  {
    productId: 'portrait_suite_69',
    name: '69.9 人像写真套系',
    price: 69.9,
    deliveryCount: 5,
    productType: 'portrait',
    productionLine: 'manual',
    description: '多风格人像写真，5 张精修成片，人工拍摄指导与精修交付。'
  }
];

const THEMES = [
  { themeId: 'id_photo', name: '证件照', description: '白底/蓝底/灰底等规格化证件与报名照' },
  { themeId: 'business', name: '商务形象', description: '简历、职业平台与工牌头像风格' },
  { themeId: 'portrait', name: '人像写真', description: '多风格轻写真与人工精修套系' }
];

const STYLES = [
  { styleId: 'ID-01', category: 'id_photo', name: '标准白底证件照', productionLine: 'auto' },
  { styleId: 'ID-02', category: 'id_photo', name: '蓝底报名照', productionLine: 'auto' },
  { styleId: 'ID-03', category: 'id_photo', name: '灰底商务证件照', productionLine: 'auto' },
  { styleId: 'BZ-01', category: 'business', name: '白衬衫简历照', productionLine: 'semi_auto' },
  { styleId: 'PT-01', category: 'portrait', name: '自然光人像写真', productionLine: 'manual' }
];

// 与 getAIStudioRuntimeConfig 保持一致的内置默认运行配置（公开脱敏输出用）
const DEFAULT_CONFIG = {
  modelSettings: [
    {
      scene: 'customer_service',
      enabled: true,
      provider: 'local_fallback',
      model: 'local-scripted-service',
      fallbackModel: 'local-scripted-service',
      maxTokens: 600,
      temperature: 0.4,
      publicName: '影楼客服助手'
    },
    {
      scene: 'image_generation',
      enabled: false,
      provider: 'manual',
      model: 'manual-human-qc',
      workflowId: 'id_photo_mvp_manual_v1',
      requiresHumanQC: true,
      outputType: 'id_photo',
      publicName: '人工半自动证件照流程'
    }
  ],
  promptTemplates: [
    {
      promptKey: 'ai_studio_service_v1',
      scene: 'customer_service',
      version: 1,
      enabled: true,
      content: '你是 AI 影楼客服，负责解释证件照下单、收图标准、授权合规、订单状态和交付规则。回答要简短、温和、明确，不承诺全自动，不处理未成年人、仿冒公众人物或低俗欺骗用途。'
    }
  ],
  routes: [
    {
      routeKey: 'id_photo_auto_v1',
      productIds: ['id_photo_9_9', 'resume_photo_29_9'],
      styleIds: ['ID-01', 'ID-02', 'ID-03', 'BZ-01'],
      customerServiceScene: 'customer_service',
      imageGenerationScene: 'image_generation',
      processingMode: 'semi_auto',
      enabled: true
    }
  ]
};

const SUPPORTED_ACTIONS = ['catalog', 'queryOrder', 'paymentQR', 'runtimeConfig'];

exports.main = async (event = {}) => {
  try {
    // 1. API Key 白名单校验（环境变量 AI_STUDIO_OPEN_API_KEYS，逗号分隔多 key）
    const apiKey = cleanText(event.apiKey, 128);
    if (!isValidApiKey(apiKey)) {
      return fail('FORBIDDEN', '无效的 API Key');
    }

    // 2. action 校验
    const action = cleanText(event.action, 40);
    if (!SUPPORTED_ACTIONS.includes(action)) {
      return fail('VALIDATION_ERROR', '不支持的 action');
    }

    // 3. payload 归一化（默认 {}）
    const payload = normalizePayload(event.payload);

    // 4. 审计（写入失败静默；createdAt 用 serverDate 便于事后审计/限速核查）
    const { OPENID } = cloud.getWXContext();
    writeAudit(OPENID, action, payload).catch(() => {});

    // 5. 分发
    switch (action) {
      case 'catalog':
        return handleCatalog();
      case 'queryOrder':
        return await handleQueryOrder(payload);
      case 'paymentQR':
        return await handlePaymentQR();
      case 'runtimeConfig':
        return await handleRuntimeConfig();
      default:
        return fail('VALIDATION_ERROR', '不支持的 action');
    }
  } catch (error) {
    console.error('photomuseOpenApi failed:', error);
    return fail('INTERNAL_ERROR', '开放接口调用失败，请稍后重试');
  }
};

// ---------------------------------------------------------------------------
// action 处理器
// ---------------------------------------------------------------------------

function handleCatalog() {
  return {
    success: true,
    products: PRODUCTS,
    themes: THEMES,
    styles: STYLES
  };
}

async function handleQueryOrder(payload) {
  const orderId = cleanText(payload.orderId, 80);
  const contactPhone = normalizePhone(payload.contactPhone);
  const queryPassword = cleanText(payload.queryPassword, 32);

  if (!orderId || !contactPhone || queryPassword.length < 6) {
    return fail('VALIDATION_ERROR', '请填写订单号、手机号和查询密码');
  }

  const result = await db.collection('ai_studio_orders')
    .where({ orderId, contactPhone, queryPasswordHash: hashQueryPassword(queryPassword) })
    .limit(1)
    .get();
  const order = result.data && result.data[0];
  if (!order) return fail('NOT_FOUND', '订单不存在或查询信息不匹配');

  const filesResult = await db.collection('ai_studio_files')
    .where({ orderId, _openid: order._openid })
    .orderBy('createdAt', 'asc')
    .get();

  return {
    success: true,
    order: sanitizeOrder(order),
    files: (filesResult.data || []).map(toPublicFile)
  };
}

async function handlePaymentQR() {
  // 集合由 adminSetAIStudioPaymentQR 写入：{ configId: 'default', fileID, note, ... }
  const result = await db.collection('ai_studio_payment_config')
    .where({ configId: 'default' })
    .limit(1)
    .get();
  const record = result.data && result.data[0];
  if (!record) return { success: true, config: null };

  return {
    success: true,
    config: {
      fileID: record.fileID,
      note: record.note
    }
  };
}

async function handleRuntimeConfig() {
  try {
    const [settings, templates, routes] = await Promise.all([
      readCollection('ai_studio_model_settings'),
      readCollection('ai_studio_prompt_templates'),
      readCollection('ai_studio_routes')
    ]);

    return {
      success: true,
      config: sanitizeConfig({
        modelSettings: settings.length ? settings : DEFAULT_CONFIG.modelSettings,
        promptTemplates: templates.length ? templates : DEFAULT_CONFIG.promptTemplates,
        routes: routes.length ? routes : DEFAULT_CONFIG.routes
      })
    };
  } catch (error) {
    console.error('photomuseOpenApi runtimeConfig failed:', error);
    return {
      success: true,
      config: sanitizeConfig(DEFAULT_CONFIG),
      message: '使用默认影楼运行配置'
    };
  }
}

// ---------------------------------------------------------------------------
// 审计
// ---------------------------------------------------------------------------

function writeAudit(actorOpenid, action, payload = {}) {
  const orderId = cleanText(payload.orderId, 80);
  const auditPayload = { apiAction: action };
  if (orderId) auditPayload.orderId = orderId;

  return db.collection('ai_studio_audit_logs').add({
    data: {
      orderId: orderId || '',
      actorOpenid: actorOpenid || 'open_api',
      action: 'open_api_call',
      payload: auditPayload,
      createdAt: db.serverDate()
    }
  });
}

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

function isValidApiKey(apiKey) {
  if (!apiKey) return false;
  const allowedKeys = String(process.env.AI_STUDIO_OPEN_API_KEYS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return allowedKeys.includes(apiKey);
}

function normalizePayload(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload;
  return {};
}

async function readCollection(name) {
  const result = await db.collection(name).where({ enabled: true }).limit(50).get();
  return result.data || [];
}

function sanitizeConfig(config) {
  return {
    modelSettings: (config.modelSettings || []).map(stripPrivateFields),
    promptTemplates: (config.promptTemplates || []).map(stripPrivateFields),
    routes: (config.routes || []).map(stripPrivateFields)
  };
}

function stripPrivateFields(item) {
  const copy = { ...item };
  delete copy._id;
  delete copy._openid;
  delete copy.apiKey;
  delete copy.secret;
  delete copy.token;
  delete copy.headers;
  delete copy.content;
  return copy;
}

function sanitizeOrder(order) {
  const { queryPasswordHash, ...safeOrder } = order;
  return safeOrder;
}

function toPublicFile(file) {
  return {
    fileId: file._id,
    fileType: file.fileType,
    fileID: file.fileID,
    fileName: file.fileName,
    size: file.size,
    status: file.status,
    createdAt: file.createdAt
  };
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizePhone(value) {
  const phone = cleanText(value, 20).replace(/\s+/g, '');
  return /^1\d{10}$/.test(phone) ? phone : '';
}

function hashQueryPassword(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function fail(code, message) {
  return { success: false, code, message };
}
