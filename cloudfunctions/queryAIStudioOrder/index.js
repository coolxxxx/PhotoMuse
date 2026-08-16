const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  try {
    const orderId = cleanText(event.orderId, 80);
    const contactPhone = normalizePhone(event.contactPhone);
    const queryPassword = cleanText(event.queryPassword, 32);

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
  } catch (error) {
    console.error('queryAIStudioOrder failed:', error);
    return fail('INTERNAL_ERROR', '查询订单失败，请稍后重试');
  }
};

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
