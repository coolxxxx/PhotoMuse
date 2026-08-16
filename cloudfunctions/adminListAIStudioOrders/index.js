const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权访问订单管理');
    }

    const page = normalizePage(event.page);
    const pageSize = normalizePageSize(event.pageSize);
    const status = cleanText(event.status, 40);
    const where = status ? { order_status: status } : {};

    const [listResult, countResult] = await Promise.all([
      db.collection('ai_studio_orders')
        .where(where)
        .orderBy('createdAt', 'desc')
        .skip(page * pageSize)
        .limit(pageSize)
        .get(),
      db.collection('ai_studio_orders').where(where).count()
    ]);

    const orders = listResult.data || [];
    const orderIds = orders.map(order => order.orderId);
    let filesByOrder = {};

    if (orderIds.length > 0) {
      const filesResult = await db.collection('ai_studio_files')
        .where({ orderId: _.in(orderIds) })
        .orderBy('createdAt', 'asc')
        .get();

      filesByOrder = (filesResult.data || []).reduce((acc, file) => {
        if (!acc[file.orderId]) acc[file.orderId] = [];
        acc[file.orderId].push({
          fileId: file._id,
          fileType: file.fileType,
          fileID: file.fileID,
          fileName: file.fileName,
          size: file.size,
          status: file.status,
          createdAt: file.createdAt
        });
        return acc;
      }, {});
    }

    return {
      success: true,
      data: orders.map(order => ({
        ...order,
        files: filesByOrder[order.orderId] || []
      })),
      pagination: {
        page,
        pageSize,
        total: countResult.total,
        hasMore: (page + 1) * pageSize < countResult.total
      }
    };
  } catch (error) {
    console.error('adminListAIStudioOrders failed:', error);
    return fail('INTERNAL_ERROR', '获取影楼订单看板失败');
  }
};

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

function normalizePage(value) {
  const page = Number(value);
  return Number.isInteger(page) && page >= 0 ? page : 0;
}

function normalizePageSize(value) {
  const size = Number(value);
  if (!Number.isInteger(size) || size <= 0) return 10;
  return Math.min(size, 30);
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function fail(code, message) {
  return { success: false, code, message };
}
