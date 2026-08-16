const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权标记支付');
    }

    const orderId = cleanText(event.orderId, 80);
    const paidNote = cleanText(event.paidNote, 200);

    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    const order = await getOrder(orderId);
    if (!order) return fail('NOT_FOUND', '订单不存在');

    if (order.payment_status === 'paid') {
      return {
        success: true,
        message: '订单已是已支付状态',
        order: {
          orderId,
          payment_status: 'paid'
        }
      };
    }

    await db.collection('ai_studio_orders').where({ orderId }).update({
      data: {
        payment_status: 'paid',
        paidNote,
        paidAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await writeAudit(orderId, OPENID, 'admin_mark_order_paid', { paidNote });

    return {
      success: true,
      order: {
        orderId,
        payment_status: 'paid'
      }
    };
  } catch (error) {
    console.error('adminMarkAIStudioOrderPaid failed:', error);
    return fail('INTERNAL_ERROR', '标记支付失败');
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
