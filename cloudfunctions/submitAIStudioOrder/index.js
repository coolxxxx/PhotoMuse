const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    const orderId = cleanText(event.orderId, 80);
    if (!OPENID) return fail('UNAUTHENTICATED', '请先登录后再提交');
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    const order = await getOwnOrder(orderId, OPENID);
    if (!order) return fail('NOT_FOUND', '订单不存在或无权访问');
    if (order.adult_identity_authorization !== 'confirmed') {
      return fail('AUTHORIZATION_REQUIRED', '请先确认本人/成年人授权');
    }

    const countResult = await db.collection('ai_studio_files')
      .where({ orderId, _openid: OPENID, fileType: 'customer_photo', status: 'uploaded' })
      .count();

    if (countResult.total < 1) return fail('PHOTO_REQUIRED', '请至少上传 1 张正脸照片');
    if (countResult.total > 3) return fail('PHOTO_LIMIT_EXCEEDED', '最多上传 3 张参考照片');

    await db.collection('ai_studio_orders').where({ orderId, _openid: OPENID }).update({
      data: {
        order_status: 'photo_review',
        photo_check: 'unchecked',
        reference_photo_count: countResult.total,
        submittedAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await writeAudit(orderId, OPENID, 'submit_order', {
      referencePhotoCount: countResult.total
    });

    return {
      success: true,
      order: {
        orderId,
        order_status: 'photo_review',
        photo_check: 'unchecked',
        reference_photo_count: countResult.total
      }
    };
  } catch (error) {
    console.error('submitAIStudioOrder failed:', error);
    return fail('INTERNAL_ERROR', '提交订单失败，请稍后重试');
  }
};

async function getOwnOrder(orderId, openid) {
  const result = await db.collection('ai_studio_orders')
    .where({ orderId, _openid: openid })
    .limit(1)
    .get();
  return result.data && result.data[0];
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
