const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    const orderId = cleanText(event.orderId, 80);
    if (!OPENID) return fail('UNAUTHENTICATED', '请先登录后再查看订单');
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    const orderResult = await db.collection('ai_studio_orders')
      .where({ orderId, _openid: OPENID })
      .limit(1)
      .get();
    const order = orderResult.data && orderResult.data[0];
    if (!order) return fail('NOT_FOUND', '订单不存在或无权访问');

    const filesResult = await db.collection('ai_studio_files')
      .where({ orderId, _openid: OPENID })
      .orderBy('createdAt', 'asc')
      .get();

    return {
      success: true,
      order,
      files: filesResult.data.map(toPublicFile)
    };
  } catch (error) {
    console.error('getAIStudioOrderDetail failed:', error);
    return fail('INTERNAL_ERROR', '获取订单详情失败，请稍后重试');
  }
};

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

function fail(code, message) {
  return { success: false, code, message };
}
