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

// ---------------------------------------------------------------------------
// 网站独立版下单常量（createAIStudioOrder 的服务端同构副本，不 cross-require，
// 与上方 catalog 目录常量相互独立，新增套餐时两处同步维护）
// ---------------------------------------------------------------------------

const ORDER_PRODUCTS = [
  { productId: 'id_photo_9_9', name: '3.9 证件照体验版', price: 3.9, deliveryCount: 1, productionLine: 'auto', productType: 'standard' },
  { productId: 'resume_photo_29_9', name: '29.9 简历形象照', price: 29.9, deliveryCount: 3, productionLine: 'semi_auto', productType: 'standard' },
  { productId: 'portrait_suite_69', name: '69.9 AI 写真套图', price: 69.9, deliveryCount: 5, productionLine: 'manual_ai', productType: 'portrait' }
];

const ORDER_STYLES = [
  { styleId: 'ID-01', category: 'id_photo', name: '标准白底证件照', productionLine: 'auto' },
  { styleId: 'ID-02', category: 'id_photo', name: '蓝底报名照', productionLine: 'auto' },
  { styleId: 'ID-03', category: 'id_photo', name: '灰底商务证件照', productionLine: 'auto' },
  { styleId: 'BZ-01', category: 'business', name: '白衬衫简历照', productionLine: 'semi_auto' }
];

const PORTRAIT_THEMES = [
  { themeId: 'guofeng', name: '古风写真' },
  { themeId: 'sports', name: '运动活力' },
  { themeId: 'casual', name: '休闲日常' },
  { themeId: 'travel', name: '旅拍风光' },
  { themeId: 'family', name: '亲子合照' }
];

// 多主题阶梯定价服务端默认值（ai_studio_business_config 集合 configId='default' 可覆盖，
// 与 createAIStudioOrder 的 DEFAULT_PORTRAIT_PRICING 同构，不 cross-require）
const DEFAULT_BUSINESS_CONFIG = {
  baseThemePrice: 69.9,
  extraThemePrice: 39.9,
  maxThemes: 3,
  photosPerTheme: 5
};

// 周边商品内置种子（ai_studio_merchandise 集合为空/读取异常时兜底，
// 与 listAIStudioMerchandise / selectAIStudioMerch 的 DEFAULT_MERCH 同构）
const DEFAULT_MERCH = [
  {
    merchId: 'wall_8',
    name: '挂墙主视觉·8寸实木框',
    category: 'wall',
    desc: '进口实木框搭配高清微喷，进门第一眼就是写真馆质感',
    price: 49,
    imageRatio: '4:5',
    printSpec: { widthMM: 203, heightMM: 254, dpi: 300, bleedMM: 3 },
    sortOrder: 1
  },
  {
    merchId: 'wall_12',
    name: '挂墙主视觉·12寸大画幅',
    category: 'wall',
    desc: '12 寸大画幅细节数倍放大，撑起整面墙的高光主视觉',
    price: 79,
    imageRatio: '5:6',
    printSpec: { widthMM: 254, heightMM: 305, dpi: 300, bleedMM: 3 },
    sortOrder: 2
  },
  {
    merchId: 'desk_5',
    name: '水晶摆台·5寸',
    category: 'desk',
    desc: '高透水晶面板摆台，随手一放就是工位治愈角',
    price: 29,
    imageRatio: '5:7',
    printSpec: { widthMM: 127, heightMM: 178, dpi: 300, bleedMM: 3 },
    sortOrder: 3
  },
  {
    merchId: 'calendar',
    name: '定制挂历·13页',
    category: 'calendar',
    desc: '13 页月历编排，一年十二个月天天有你的高光',
    price: 39,
    imageRatio: '1:1.41',
    printSpec: { widthMM: 210, heightMM: 297, dpi: 300, bleedMM: 3 },
    sortOrder: 4
  },
  {
    merchId: 'wallet',
    name: '钱包照套装·6张',
    category: 'wallet',
    desc: '6 张随身卡位尺寸，把最喜欢的瞬间放进口袋',
    price: 9.9,
    imageRatio: '4:3',
    printSpec: { widthMM: 89, heightMM: 64, dpi: 300, bleedMM: 3 },
    sortOrder: 5
  },
  {
    merchId: 'pendant',
    name: '亚克力挂件·圆形5cm×2个',
    category: 'pendant',
    desc: '圆形亚克力挂件一对，挂包挂钥匙都好看',
    price: 19,
    imageRatio: '1:1',
    printSpec: { widthMM: 50, heightMM: 50, dpi: 300, bleedMM: 3 },
    sortOrder: 6
  },
  {
    merchId: 'album',
    name: '精装相册·10P 方形',
    category: 'album',
    desc: '方形精装 10P 翻页即影集，自留送礼两相宜',
    price: 69,
    imageRatio: '1:1',
    printSpec: { widthMM: 254, heightMM: 254, dpi: 300, bleedMM: 3 },
    sortOrder: 7
  }
];

const AUTH_VERSION = 'ai-studio-auth-v1';
const MAX_CUSTOMER_PHOTOS = 3;
const MIN_CELL_INDEX = 1;
const MAX_CELL_INDEX = 15;

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

const SUPPORTED_ACTIONS = [
  'catalog', 'queryOrder', 'paymentQR', 'runtimeConfig', 'createOrder', 'registerPhoto', 'getOrder', 'selectCells',
  'businessConfig', 'samples', 'merchandise', 'analyzePhoto', 'selectMerch'
];

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
      case 'createOrder':
        return await handleCreateOrder(payload);
      case 'registerPhoto':
        return await handleRegisterPhoto(payload);
      case 'getOrder':
        return await handleGetOrder(payload);
      case 'selectCells':
        return await handleSelectCells(payload);
      case 'businessConfig':
        return await handleBusinessConfig();
      case 'samples':
        return await handleSamples();
      case 'merchandise':
        return await handleMerchandise();
      case 'analyzePhoto':
        return await handleAnalyzePhoto(payload, apiKey);
      case 'selectMerch':
        return await handleSelectMerch(payload);
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
// 网站独立版 action 处理器（订单所有权用 web_token 哈希校验）
// ---------------------------------------------------------------------------

async function handleCreateOrder(payload) {
  const product = ORDER_PRODUCTS.find(item => item.productId === payload.productId);
  const isPortrait = Boolean(product && product.productType === 'portrait');
  const styleInput = cleanText(payload.styleId, 20);
  const style = ORDER_STYLES.find(item => item.styleId === styleInput);

  let pricing = null;
  let portraitThemes = [];
  if (isPortrait) {
    pricing = await getBusinessPricing();
    const themeValidationError = fail('VALIDATION_ERROR', `请选择 1-${pricing.maxThemes} 个有效写真主题`);
    // themes（themeId 数组）优先；兼容旧调用只传单个 themeId
    const rawThemeIds = Array.isArray(payload.themes) && payload.themes.length > 0
      ? payload.themes
      : (cleanText(payload.themeId, 40) ? [payload.themeId] : []);
    const uniqueThemeIds = Array.from(new Set(rawThemeIds.map(item => cleanText(item, 40)).filter(Boolean)));
    if (uniqueThemeIds.length < 1 || uniqueThemeIds.length > pricing.maxThemes) {
      return themeValidationError;
    }
    const resolvedThemes = [];
    for (const themeId of uniqueThemeIds) {
      const hit = PORTRAIT_THEMES.find(item => item.themeId === themeId);
      if (!hit) return themeValidationError;
      resolvedThemes.push({ themeId: hit.themeId, themeName: hit.name });
    }
    portraitThemes = resolvedThemes;
  }

  if (!product) return fail('VALIDATION_ERROR', '请选择有效套餐');
  if (!style && (!isPortrait || styleInput)) return fail('VALIDATION_ERROR', '请选择有效风格');

  const contactPhone = normalizePhone(payload.contactPhone);
  const queryPassword = cleanText(payload.queryPassword, 32);
  if (!contactPhone) return fail('VALIDATION_ERROR', '请填写用于查询订单的手机号');
  if (queryPassword.length < 6) return fail('VALIDATION_ERROR', '查询密码至少 6 位');

  const authorization = payload.authorization || {};
  if (!authorization.isSelfOrAuthorized || !authorization.isAdult || !authorization.agreesProduction) {
    return fail('AUTHORIZATION_REQUIRED', '请先确认本人/成年人授权');
  }

  // 服务端阶梯计价：首主题按 baseThemePrice，后续主题每个加 extraThemePrice（仅写真订单，standard 流程不读取定价集合）
  const themeCount = portraitThemes.length;
  const portraitPrice = pricing ? round1(pricing.baseThemePrice + (themeCount - 1) * pricing.extraThemePrice) : 0;
  const portraitDeliveryCount = pricing ? themeCount * pricing.photosPerTheme : 0;

  const webToken = crypto.randomBytes(24).toString('hex');
  const orderId = createOrderId();
  const now = Date.now();
  const order = {
    orderId,
    _openid: '',
    productId: product.productId,
    productName: product.name,
    price: isPortrait ? portraitPrice : product.price,
    deliveryCount: isPortrait ? portraitDeliveryCount : product.deliveryCount,
    productionLine: product.productionLine,
    product_type: product.productType,
    theme_id: isPortrait ? portraitThemes[0].themeId : '',
    theme_name: isPortrait ? portraitThemes[0].themeName : '',
    styleId: style ? style.styleId : '',
    styleName: style ? style.name : '',
    usage: cleanText(payload.usage, 80),
    backgroundColor: cleanText(payload.backgroundColor, 20),
    clothingOption: cleanText(payload.clothingOption, 40),
    spec: cleanText(payload.spec, 40),
    customerNote: cleanText(payload.customerNote, 300),
    scene_desc: cleanText(payload.sceneDesc, 300),
    contactPhone,
    queryPasswordHash: hashQueryPassword(queryPassword),
    web_token_hash: hashWebToken(webToken),
    payment_status: 'unpaid',
    order_status: 'waiting_photos',
    photo_check: 'unchecked',
    adult_identity_authorization: 'confirmed',
    case_permission: 'unconfirmed',
    refund_status: 'none',
    upsell_status: 'not_upsold',
    reference_photo_count: 0,
    delivery_file_count: 0,
    authorization: {
      version: AUTH_VERSION,
      isSelfOrAuthorized: true,
      isAdult: true,
      agreesProduction: true,
      acceptedAt: now
    },
    source: 'web',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };

  if (isPortrait) {
    // 多主题套系：选片内嵌到每个主题；theme_id/theme_name 保留第一个主题以兼容旧管理端展示
    order.themes = portraitThemes.map(item => ({
      themeId: item.themeId,
      themeName: item.themeName,
      selectedCells: []
    }));
    order.theme_count = themeCount;
  } else {
    order.selected_cells = [];
  }

  await db.collection('ai_studio_orders').add({ data: order });

  // webToken 仅此一次返回，服务端只落哈希
  return {
    success: true,
    order: {
      orderId,
      webToken,
      order_status: order.order_status
    }
  };
}

async function handleRegisterPhoto(payload) {
  const orderId = cleanText(payload.orderId, 80);
  const webToken = cleanText(payload.webToken, 128);
  const fileID = cleanText(payload.fileID || payload.fileId, 300);

  if (!orderId || !webToken || !fileID.startsWith('cloud://')) {
    return fail('VALIDATION_ERROR', '上传文件参数无效');
  }

  const tokenHash = hashWebToken(webToken);
  const order = await findWebOrder(orderId, tokenHash);
  if (!order) return fail('NOT_FOUND', '订单不存在或令牌不匹配');

  if (!['waiting_photos', 'photo_review'].includes(order.order_status)) {
    return fail('INVALID_STATUS', '当前订单状态不允许继续上传照片');
  }

  const countResult = await db.collection('ai_studio_files')
    .where({ orderId, fileType: 'customer_photo', status: 'uploaded' })
    .count();

  if (countResult.total >= MAX_CUSTOMER_PHOTOS) {
    return fail('PHOTO_LIMIT_EXCEEDED', '最多上传 3 张参考照片');
  }

  const addResult = await db.collection('ai_studio_files').add({
    data: {
      orderId,
      _openid: order._openid || '',
      fileType: 'customer_photo',
      fileID,
      fileName: cleanText(payload.fileName, 120),
      size: normalizeNumber(payload.size),
      mimeType: cleanText(payload.mimeType, 60),
      status: 'uploaded',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  const nextCount = countResult.total + 1;

  await db.collection('ai_studio_orders').where({ orderId, web_token_hash: tokenHash }).update({
    data: {
      reference_photo_count: nextCount,
      updatedAt: db.serverDate()
    }
  });

  return {
    success: true,
    fileId: addResult._id,
    referencePhotoCount: nextCount
  };
}

async function handleGetOrder(payload) {
  const orderId = cleanText(payload.orderId, 80);
  const webToken = cleanText(payload.webToken, 128);
  if (!orderId || !webToken) return fail('NOT_FOUND', '订单不存在或令牌不匹配');

  const order = await findWebOrder(orderId, hashWebToken(webToken));
  if (!order) return fail('NOT_FOUND', '订单不存在或令牌不匹配');

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

async function handleSelectCells(payload) {
  const orderId = cleanText(payload.orderId, 80);
  if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

  const cells = normalizeCells(payload.cells);
  if (!cells) return fail('VALIDATION_ERROR', '请选择 1-5 个分镜');

  // 代理到 selectAIStudioPortraitCells，保持分主题选片语义（themeId、全部主题选完才 cell_selected）
  const callResult = await cloud.callFunction({
    name: 'selectAIStudioPortraitCells',
    data: {
      orderId,
      cells,
      themeId: cleanText(payload.themeId, 40),
      webToken: cleanText(payload.webToken, 200),
      contactPhone: cleanText(payload.contactPhone, 20),
      queryPassword: cleanText(payload.queryPassword, 32)
    }
  }).catch(() => null);

  if (!callResult || !callResult.result) {
    return fail('CELLS_FAILED', '选片服务不可用，请稍后重试');
  }
  return callResult.result;
}

// ---------------------------------------------------------------------------
// 开放能力扩展 action 处理器（目录读取 + 内部函数代理透传）
// ---------------------------------------------------------------------------

async function handleBusinessConfig() {
  // 定价单例：ai_studio_business_config configId='default'，读不到/异常一律回退默认值
  const config = await getBusinessPricing();
  return { success: true, config };
}

async function handleSamples() {
  try {
    const result = await db.collection('ai_studio_samples')
      .where({ enabled: true })
      .orderBy('sortOrder', 'asc')
      .limit(50)
      .get();
    const rows = result.data || [];
    return {
      success: true,
      data: rows.map(doc => ({
        sampleId: doc._id,
        themeId: cleanText(doc.themeId, 32),
        fileID: cleanText(doc.fileID, 300),
        caption: cleanText(doc.caption, 100),
        sortOrder: normalizeNumber(doc.sortOrder)
      }))
    };
  } catch (error) {
    console.error('photomuseOpenApi samples failed:', error);
    return { success: true, data: [] };
  }
}

async function handleMerchandise() {
  try {
    const result = await db.collection('ai_studio_merchandise')
      .where({ enabled: true })
      .orderBy('sortOrder', 'asc')
      .limit(50)
      .get();
    const rows = (result.data || []).map(toPublicMerch);
    if (rows.length < 1) return { success: true, data: DEFAULT_MERCH };
    rows.sort((a, b) => a.sortOrder - b.sortOrder);
    return { success: true, data: rows };
  } catch (error) {
    console.error('photomuseOpenApi merchandise failed:', error);
    return { success: true, data: DEFAULT_MERCH };
  }
}

async function handleAnalyzePhoto(payload, apiKey) {
  // 内部代理 analyzeAIStudioPhoto（复用其 apiKey 鉴权通道），业务结果原样透传
  const fileID = cleanText(payload.fileID || payload.fileId, 300);
  let callResult;
  try {
    callResult = await cloud.callFunction({
      name: 'analyzeAIStudioPhoto',
      data: { fileID, apiKey }
    });
  } catch (error) {
    console.error('photomuseOpenApi analyzePhoto failed:', error);
    return fail('ANALYSIS_FAILED', '照片分析服务不可用');
  }
  const result = callResult && callResult.result;
  if (result && typeof result === 'object') return result;
  return fail('ANALYSIS_FAILED', '照片分析服务不可用');
}

async function handleSelectMerch(payload) {
  // 内部代理 selectAIStudioMerch（webToken/三元组通道由其自行校验），payload 原样透传
  let callResult;
  try {
    callResult = await cloud.callFunction({
      name: 'selectAIStudioMerch',
      data: { ...payload }
    });
  } catch (error) {
    console.error('photomuseOpenApi selectMerch failed:', error);
    return fail('MERCH_FAILED', (error && error.message) || '周边选择失败');
  }
  const result = callResult && callResult.result;
  if (result && typeof result === 'object') return result;
  return fail('MERCH_FAILED', '周边选择失败');
}

// ---------------------------------------------------------------------------
// 审计
// ---------------------------------------------------------------------------

function writeAudit(actorOpenid, action, payload = {}) {
  const orderId = cleanText(payload.orderId, 80);
  const productId = cleanText(payload.productId, 64);
  const auditPayload = { apiAction: action };
  if (orderId) auditPayload.orderId = orderId;
  if (productId) auditPayload.productId = productId;

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

async function getBusinessPricing() {
  // 与 createAIStudioOrder.getBusinessPricing 同构：单例读取 + 字段校验 + 默认值兜底
  const fallback = { ...DEFAULT_BUSINESS_CONFIG };
  try {
    const result = await db.collection('ai_studio_business_config')
      .where({ configId: 'default' })
      .limit(1)
      .get();
    const record = result.data && result.data[0];
    if (!record) return fallback;
    const baseThemePrice = pickPrice(record.baseThemePrice, fallback.baseThemePrice);
    const extraThemePrice = pickPrice(record.extraThemePrice, fallback.extraThemePrice);
    const maxThemes = pickInteger(record.maxThemes, 1, 5, fallback.maxThemes);
    const photosPerTheme = pickInteger(record.photosPerTheme, 1, 15, fallback.photosPerTheme);
    return { baseThemePrice, extraThemePrice, maxThemes, photosPerTheme };
  } catch (error) {
    console.error('getBusinessPricing failed, fallback to defaults:', error);
    return fallback;
  }
}

function toPublicMerch(doc) {
  // 与 listAIStudioMerchandise.toPublicMerch 同构的公开快照
  const spec = doc.printSpec || {};
  return {
    merchId: cleanText(doc.merchId || doc._id, 64),
    name: cleanText(doc.name, 60),
    category: cleanText(doc.category, 32),
    desc: cleanText(doc.desc, 120),
    price: normalizeNumber(doc.price),
    imageRatio: cleanText(doc.imageRatio, 16),
    printSpec: {
      widthMM: normalizeNumber(spec.widthMM),
      heightMM: normalizeNumber(spec.heightMM),
      dpi: normalizeNumber(spec.dpi) || 300,
      bleedMM: normalizeNumber(spec.bleedMM) || 3
    },
    sortOrder: normalizeNumber(doc.sortOrder)
  };
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
  const { queryPasswordHash, web_token_hash, ...safeOrder } = order;
  return safeOrder;
}

function toPublicFile(file) {
  const pub = {
    fileId: file._id,
    fileType: file.fileType,
    fileID: file.fileID,
    fileName: file.fileName,
    size: file.size,
    status: file.status,
    createdAt: file.createdAt
  };
  if (file.themeId) pub.themeId = file.themeId;
  return pub;
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

function hashWebToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function createOrderId() {
  return `AIStudio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function findWebOrder(orderId, tokenHash) {
  const result = await db.collection('ai_studio_orders')
    .where({ orderId, web_token_hash: tokenHash })
    .limit(1)
    .get();
  return result.data && result.data[0];
}

async function findOwnedOrder(payload, orderId) {
  const webToken = cleanText(payload.webToken, 128);
  if (webToken) {
    const webOrder = await findWebOrder(orderId, hashWebToken(webToken));
    if (webOrder) return webOrder;
  }

  const contactPhone = normalizePhone(payload.contactPhone);
  const queryPassword = cleanText(payload.queryPassword, 32);
  if (contactPhone && queryPassword.length >= 6) {
    const result = await db.collection('ai_studio_orders')
      .where({
        orderId,
        contactPhone,
        queryPasswordHash: hashQueryPassword(queryPassword)
      })
      .limit(1)
      .get();
    return result.data && result.data[0];
  }

  return null;
}

function normalizeCells(value) {
  if (!Array.isArray(value)) return null;
  const unique = new Set();
  for (const item of value) {
    if (!Number.isInteger(item) || item < MIN_CELL_INDEX || item > MAX_CELL_INDEX) return null;
    unique.add(item);
  }
  const cells = Array.from(unique);
  return cells.length >= 1 ? cells : null;
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function pickPrice(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99999) return fallback;
  return round1(parsed);
}

function pickInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function fail(code, message) {
  return { success: false, code, message };
}
