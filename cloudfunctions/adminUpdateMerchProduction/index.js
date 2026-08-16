const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const PRODUCTION_FLOW = {
  start: { from: ['merch_pending'], to: 'in_production' },
  ship: { from: ['in_production'], to: 'completed' },
  complete: { from: ['in_production'], to: 'completed' }
};

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权流转制作状态');
    }

    const orderId = cleanText(event.orderId, 80);
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    const action = cleanText(event.action, 20);
    const rule = PRODUCTION_FLOW[action];
    if (!rule) return fail('VALIDATION_ERROR', '制作流转动作无效（须为 start/ship/complete）');

    const trackingNo = cleanText(event.trackingNo, 100);

    const order = await getOrder(orderId);
    if (!order) return fail('NOT_FOUND', '订单不存在');

    if (!rule.from.includes(order.order_status)) {
      return fail('INVALID_STATUS', '当前状态不能执行该制作动作');
    }

    const data = {
      order_status: rule.to,
      updatedAt: db.serverDate()
    };
    if (action === 'start') {
      data.production_started_at = db.serverDate();
    } else {
      data.shipped_at = db.serverDate();
      if (trackingNo) data.trackingNo = trackingNo;
    }

    await db.collection('ai_studio_orders').where({ orderId }).update({ data });

    const payload = trackingNo ? { trackingNo } : {};
    await writeAudit(orderId, OPENID, 'merch_production_' + action, payload);

    const result = { orderId, order_status: rule.to };
    if (action !== 'start' && trackingNo) result.trackingNo = trackingNo;

    return { success: true, order: result };
  } catch (error) {
    console.error('adminUpdateMerchProduction failed:', error);
    return fail('INTERNAL_ERROR', '流转制作状态失败');
  }
};

async function getOrder(orderId) {
  const result = await db.collection('ai_studio_orders').where({ orderId }).limit(1).get();
  return result.data && result.data[0];
}

function isAdmin(openid) {
  const raw = process.env.AI_STUDIO_ADMIN_OPENIDS || '';
  return raw.split(',').map(item => item.trim()).filter(Boolean).includes(openid);
}

function isAdminPassword(value) {
  const expected = process.env.AI_STUDIO_ADMIN_PASSWORD || '';
  if (!expected) return false;
  if (typeof value !== 'string') return false;
  return value.trim() === expected;
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
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
