const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!OPENID) return fail('UNAUTHENTICATED', '请先登录后再查看订单');

    const page = normalizePage(event.page);
    const pageSize = normalizePageSize(event.pageSize);
    const where = { _openid: OPENID };

    const [listResult, countResult] = await Promise.all([
      db.collection('ai_studio_orders')
        .where(where)
        .orderBy('createdAt', 'desc')
        .skip(page * pageSize)
        .limit(pageSize)
        .get(),
      db.collection('ai_studio_orders').where(where).count()
    ]);

    return {
      success: true,
      data: listResult.data.map(toOrderSummary),
      pagination: {
        page,
        pageSize,
        total: countResult.total,
        hasMore: (page + 1) * pageSize < countResult.total
      }
    };
  } catch (error) {
    console.error('listMyAIStudioOrders failed:', error);
    return fail('INTERNAL_ERROR', '获取订单失败，请稍后重试');
  }
};

function toOrderSummary(order) {
  return {
    orderId: order.orderId,
    productName: order.productName,
    styleName: order.styleName,
    price: order.price,
    order_status: order.order_status,
    photo_check: order.photo_check,
    reference_photo_count: order.reference_photo_count || 0,
    delivery_file_count: order.delivery_file_count || 0,
    reviewNote: order.reviewNote || '',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function normalizePage(value) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 0 ? page : 0;
}

function normalizePageSize(value) {
  const size = Number(value);
  if (!Number.isInteger(size) || size <= 0) return 10;
  return Math.min(size, 30);
}

function fail(code, message) {
  return { success: false, code, message };
}
