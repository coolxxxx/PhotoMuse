const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const PRODUCTS = [
  { productId: 'id_photo_9_9', name: '3.9 证件照体验版', price: 3.9, deliveryCount: 1, productionLine: 'auto' },
  { productId: 'resume_photo_29_9', name: '29.9 简历形象照', price: 29.9, deliveryCount: 3, productionLine: 'semi_auto' }
];

const STYLES = [
  { styleId: 'ID-01', category: 'id_photo', name: '标准白底证件照', productionLine: 'auto' },
  { styleId: 'ID-02', category: 'id_photo', name: '蓝底报名照', productionLine: 'auto' },
  { styleId: 'ID-03', category: 'id_photo', name: '灰底商务证件照', productionLine: 'auto' },
  { styleId: 'BZ-01', category: 'business', name: '白衬衫简历照', productionLine: 'semi_auto' }
];

const AUTH_VERSION = 'ai-studio-auth-v1';

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    const product = PRODUCTS.find(item => item.productId === event.productId);
    const style = STYLES.find(item => item.styleId === event.styleId);

    if (!OPENID) return fail('UNAUTHENTICATED', '请先登录后再下单');
    if (!product) return fail('VALIDATION_ERROR', '请选择有效套餐');
    if (!style) return fail('VALIDATION_ERROR', '请选择有效风格');
    const contactPhone = normalizePhone(event.contactPhone);
    const queryPassword = cleanText(event.queryPassword, 32);
    if (!contactPhone) return fail('VALIDATION_ERROR', '请填写用于查询订单的手机号');
    if (queryPassword.length < 6) return fail('VALIDATION_ERROR', '查询密码至少 6 位');

    const authorization = event.authorization || {};
    if (!authorization.isSelfOrAuthorized || !authorization.isAdult || !authorization.agreesProduction) {
      return fail('AUTHORIZATION_REQUIRED', '请先确认本人/成年人授权');
    }

    const orderId = createOrderId();
    const now = Date.now();
    const order = {
      orderId,
      _openid: OPENID,
      productId: product.productId,
      productName: product.name,
      price: product.price,
      deliveryCount: product.deliveryCount,
      productionLine: product.productionLine,
      styleId: style.styleId,
      styleName: style.name,
      usage: cleanText(event.usage, 80),
      backgroundColor: cleanText(event.backgroundColor, 20),
      clothingOption: cleanText(event.clothingOption, 40),
      spec: cleanText(event.spec, 40),
      customerNote: cleanText(event.customerNote, 300),
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

    await db.collection('ai_studio_orders').add({ data: order });
    await writeAudit(orderId, OPENID, 'create_order', {
      productId: product.productId,
      styleId: style.styleId
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
