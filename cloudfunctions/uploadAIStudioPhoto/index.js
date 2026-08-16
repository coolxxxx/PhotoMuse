const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const MAX_PHOTOS = 3;

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    const orderId = cleanText(event.orderId, 80);
    const fileID = cleanText(event.fileID || event.fileId, 300);

    if (!OPENID) return fail('UNAUTHENTICATED', '请先登录后再上传');
    if (!orderId || !fileID.startsWith('cloud://')) {
      return fail('VALIDATION_ERROR', '上传文件参数无效');
    }

    const order = await getOwnOrder(orderId, OPENID);
    if (!order) return fail('NOT_FOUND', '订单不存在或无权访问');
    if (!['waiting_photos', 'photo_review'].includes(order.order_status)) {
      return fail('INVALID_STATUS', '当前订单状态不允许继续上传照片');
    }

    const countResult = await db.collection('ai_studio_files')
      .where({ orderId, _openid: OPENID, fileType: 'customer_photo', status: 'uploaded' })
      .count();

    if (countResult.total >= MAX_PHOTOS) {
      return fail('PHOTO_LIMIT_EXCEEDED', '最多上传 3 张参考照片');
    }

    const fileRecord = {
      orderId,
      _openid: OPENID,
      fileType: 'customer_photo',
      fileID,
      fileName: cleanText(event.fileName, 120),
      size: normalizeNumber(event.size),
      mimeType: cleanText(event.mimeType, 60),
      status: 'uploaded',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    const addResult = await db.collection('ai_studio_files').add({ data: fileRecord });
    const nextCount = countResult.total + 1;

    await db.collection('ai_studio_orders').where({ orderId, _openid: OPENID }).update({
      data: {
        reference_photo_count: nextCount,
        updatedAt: db.serverDate()
      }
    });

    await writeAudit(orderId, OPENID, 'upload_customer_photo', {
      fileId: addResult._id,
      referencePhotoCount: nextCount
    });

    return {
      success: true,
      fileId: addResult._id,
      referencePhotoCount: nextCount
    };
  } catch (error) {
    console.error('uploadAIStudioPhoto failed:', error);
    return fail('INTERNAL_ERROR', '登记照片失败，请稍后重试');
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

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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
