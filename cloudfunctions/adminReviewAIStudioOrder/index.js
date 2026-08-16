const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权审核订单');
    }

    const orderId = cleanText(event.orderId, 80);
    const action = cleanText(event.action, 30);
    const reason = cleanText(event.reason, 300);

    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');
    if (!['pass', 'need_retake', 'reject'].includes(action)) {
      return fail('VALIDATION_ERROR', '审核动作无效');
    }

    const order = await getOrder(orderId);
    if (!order) return fail('NOT_FOUND', '订单不存在');

    let updateData;
    if (action === 'pass') {
      updateData = {
        order_status: 'queued',
        photo_check: 'passed',
        reviewNote: reason,
        reviewedAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
    } else if (action === 'need_retake') {
      updateData = {
        order_status: 'waiting_photos',
        photo_check: 'need_retake',
        reviewNote: reason || '照片不符合制作要求，请重新上传清晰正脸照。',
        reviewedAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
    } else {
      updateData = {
        order_status: 'cancelled',
        photo_check: 'rejected',
        reviewNote: reason || '照片或用途不符合制作规则。',
        reviewedAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
    }

    await db.collection('ai_studio_orders').where({ orderId }).update({ data: updateData });

    if (action === 'need_retake') {
      await db.collection('ai_studio_files')
        .where({ orderId, fileType: 'customer_photo', status: 'uploaded' })
        .update({
          data: {
            status: 'retake_requested',
            updatedAt: db.serverDate()
          }
        });
    }

    if (action === 'pass') {
      await db.collection('ai_studio_jobs').add({
        data: {
          orderId,
          _openid: order._openid,
          jobType: 'id_photo_mvp',
          status: 'queued',
          productId: order.productId,
          styleId: order.styleId,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    }

    await writeAudit(orderId, OPENID, `admin_review_${action}`, { reason });

    return {
      success: true,
      order: {
        orderId,
        order_status: updateData.order_status,
        photo_check: updateData.photo_check,
        reviewNote: updateData.reviewNote
      }
    };
  } catch (error) {
    console.error('adminReviewAIStudioOrder failed:', error);
    return fail('INTERNAL_ERROR', '审核订单失败');
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
