const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const PRODUCTS = [
  { productId: 'id_photo_9_9', name: '3.9 证件照体验版', price: 3.9, deliveryCount: 1, productionLine: 'auto', productType: 'standard' },
  { productId: 'resume_photo_29_9', name: '29.9 简历形象照', price: 29.9, deliveryCount: 3, productionLine: 'semi_auto', productType: 'standard' },
  { productId: 'portrait_suite_69', name: '69.9 AI 写真套图', price: 69.9, deliveryCount: 5, productionLine: 'manual_ai', productType: 'portrait' }
];

const STYLES = [
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

// 多主题阶梯定价服务端默认值（ai_studio_business_config 集合可覆盖，与 utils/ai-studio-config.js 的 PORTRAIT_PRICING 一致）
const DEFAULT_PORTRAIT_PRICING = {
  baseThemePrice: 69.9,
  extraThemePrice: 39.9,
  maxThemes: 3,
  photosPerTheme: 5
};

const AUTH_VERSION = 'ai-studio-auth-v1';

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    const product = PRODUCTS.find(item => item.productId === event.productId);
    const isPortrait = Boolean(product && product.productType === 'portrait');
    const styleInput = cleanText(event.styleId, 20);
    const style = STYLES.find(item => item.styleId === styleInput);

    let pricing = null;
    let portraitThemes = [];
    if (isPortrait) {
      pricing = await getBusinessPricing();
      const themeValidationError = fail('VALIDATION_ERROR', `请选择 1-${pricing.maxThemes} 个有效写真主题`);
      // themes（themeId 数组）优先；兼容旧调用只传单个 themeId
      const rawThemeIds = Array.isArray(event.themes) && event.themes.length > 0
        ? event.themes
        : (cleanText(event.themeId, 40) ? [event.themeId] : []);
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

    if (!OPENID) return fail('UNAUTHENTICATED', '请先登录后再下单');
    if (!product) return fail('VALIDATION_ERROR', '请选择有效套餐');
    if (!style && (!isPortrait || styleInput)) return fail('VALIDATION_ERROR', '请选择有效风格');
    const sceneDesc = cleanText(event.sceneDesc, 300);
    const contactPhone = normalizePhone(event.contactPhone);
    const queryPassword = cleanText(event.queryPassword, 32);
    if (!contactPhone) return fail('VALIDATION_ERROR', '请填写用于查询订单的手机号');
    if (queryPassword.length < 6) return fail('VALIDATION_ERROR', '查询密码至少 6 位');

    const authorization = event.authorization || {};
    if (!authorization.isSelfOrAuthorized || !authorization.isAdult || !authorization.agreesProduction) {
      return fail('AUTHORIZATION_REQUIRED', '请先确认本人/成年人授权');
    }

    // 服务端阶梯计价：首主题按 baseThemePrice，后续主题每个加 extraThemePrice（仅写真订单，standard 流程不读取定价集合）
    const themeCount = portraitThemes.length;
    const portraitPrice = pricing ? round1(pricing.baseThemePrice + (themeCount - 1) * pricing.extraThemePrice) : 0;
    const portraitDeliveryCount = pricing ? themeCount * pricing.photosPerTheme : 0;

    const orderId = createOrderId();
    const now = Date.now();
    const order = {
      orderId,
      _openid: OPENID,
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
      usage: cleanText(event.usage, 80),
      backgroundColor: cleanText(event.backgroundColor, 20),
      clothingOption: cleanText(event.clothingOption, 40),
      spec: cleanText(event.spec, 40),
      customerNote: cleanText(event.customerNote, 300),
      scene_desc: sceneDesc,
      contactPhone,
      queryPasswordHash: hashQueryPassword(queryPassword),
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
      source: 'miniprogram',
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
    await writeAudit(orderId, OPENID, 'create_order', {
      productId: product.productId,
      styleId: style ? style.styleId : '',
      productType: product.productType,
      themeId: isPortrait ? portraitThemes[0].themeId : '',
      themeIds: isPortrait ? portraitThemes.map(item => item.themeId) : [],
      themeCount,
      price: order.price,
      deliveryCount: order.deliveryCount
    });

    return {
      success: true,
      order: {
        orderId,
        order_status: order.order_status,
        photo_check: order.photo_check
      }
    };
  } catch (error) {
    console.error('createAIStudioOrder failed:', error);
    return fail('INTERNAL_ERROR', '创建订单失败，请稍后重试');
  }
};

async function getBusinessPricing() {
  const fallback = { ...DEFAULT_PORTRAIT_PRICING };
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

function createOrderId() {
  return `AIStudio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

async function writeAudit(orderId, actorOpenid, action, payload = {}) {
  await db.collection('ai_studio_audit_logs').add({
    data: {
      orderId,
      actorOpenid,
      action,
      payload,
      createdAt: db.serverDate()
    }
  });
}

function fail(code, message) {
  return { success: false, code, message };
}
