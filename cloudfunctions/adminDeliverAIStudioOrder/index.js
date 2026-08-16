const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权交付订单');
    }

    const orderId = cleanText(event.orderId, 80);
    const deliveryFiles = Array.isArray(event.deliveryFiles) ? event.deliveryFiles : [];
    const deliveryNote = cleanText(event.deliveryNote, 300);

    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');
    if (deliveryFiles.length < 1) return fail('VALIDATION_ERROR', '请至少上传 1 张交付图');
    if (deliveryFiles.length > 12) return fail('VALIDATION_ERROR', '单次最多登记 12 张交付图');

    const order = await getOrder(orderId);
    if (!order) return fail('NOT_FOUND', '订单不存在');

    const preparedFiles = deliveryFiles.map(file => ({
      orderId,
      _openid: order._openid,
      fileType: 'delivery',
      fileID: cleanText(file.fileID || file.fileId, 300),
      fileName: cleanText(file.fileName, 120),
      size: normalizeNumber(file.size),
      mimeType: cleanText(file.mimeType, 60),
      status: 'delivered',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }));

    if (preparedFiles.some(file => !file.fileID.startsWith('cloud://'))) {
      return fail('VALIDATION_ERROR', '交付图文件参数无效');
    }

    for (const file of preparedFiles) {
      await db.collection('ai_studio_files').add({ data: file });
    }

    await db.collection('ai_studio_orders').where({ orderId }).update({
      data: {
        order_status: 'delivered',
        delivery_file_count: preparedFiles.length,
        deliveryNote,
        deliveredAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await db.collection('ai_studio_jobs').where({ orderId }).update({
      data: {
        status: 'delivered',
        updatedAt: db.serverDate()
      }
    }).catch(() => {});

    await writeAudit(orderId, OPENID, 'admin_deliver_order', {
      deliveryFileCount: preparedFiles.length,
      deliveryNote
    });

    return {
      success: true,
      order: {
        orderId,
        order_status: 'delivered',
        delivery_file_count: preparedFiles.length
      }
    };
  } catch (error) {
    console.error('adminDeliverAIStudioOrder failed:', error);
    return fail('INTERNAL_ERROR', '交付订单失败');
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
