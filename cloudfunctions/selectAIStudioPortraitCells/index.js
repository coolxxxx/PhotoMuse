const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const MIN_CELL_INDEX = 1;
const MAX_CELL_INDEX = 15;

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    const orderId = cleanText(event.orderId, 80);
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    const cells = normalizeCells(event.cells);
    if (!cells) return fail('VALIDATION_ERROR', '请选择 1-5 个分镜');

    const order = await findOrder(event, orderId, OPENID);
    if (!order) return fail('NOT_FOUND', '订单不存在或查询信息不匹配');

    if (order.product_type !== 'portrait') {
      return fail('VALIDATION_ERROR', '该订单不是写真套图订单');
    }
    if (order.order_status !== 'grid_preview') {
      return fail('INVALID_STATUS', '当前状态不能选片');
    }
    const deliveryCount = normalizeNumber(order.deliveryCount) || 5;
    if (cells.length < 1 || cells.length > deliveryCount) {
      return fail('VALIDATION_ERROR', '请选择 1-5 个分镜');
    }

    await db.collection('ai_studio_orders').where({ orderId }).update({
      data: {
        selected_cells: cells,
        order_status: 'cell_selected',
        cell_selected_at: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await writeAudit(orderId, OPENID || 'credential', 'select_portrait_cells', { cells });

    return {
      success: true,
      order: {
        orderId,
        order_status: 'cell_selected',
        selected_cells: cells
      }
    };
  } catch (error) {
    console.error('selectAIStudioPortraitCells failed:', error);
    return fail('INTERNAL_ERROR', '选片失败，请稍后重试');
  }
};

async function findOrder(event, orderId, openid) {
  if (openid) {
    const ownedResult = await db.collection('ai_studio_orders')
      .where({ orderId, _openid: openid })
      .limit(1)
      .get();
    const owned = ownedResult.data && ownedResult.data[0];
    if (owned) return owned;
  }

  const contactPhone = normalizePhone(event.contactPhone);
  const queryPassword = cleanText(event.queryPassword, 32);
  if (contactPhone && queryPassword.length >= 6) {
    const result = await db.collection('ai_studio_orders')
      .where({
        orderId,
        contactPhone,
        queryPasswordHash: hashQueryPassword(queryPassword)
      })
      .limit(1)
      .get();
    return result.data && result.data[0];
  }

  return null;
}

function normalizeCells(value) {
  if (!Array.isArray(value)) return null;
  const unique = new Set();
  for (const item of value) {
    if (!Number.isInteger(item) || item < MIN_CELL_INDEX || item > MAX_CELL_INDEX) return null;
    unique.add(item);
  }
  const cells = Array.from(unique);
  return cells.length >= 1 ? cells : null;
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizePhone(value) {
  const phone = cleanText(value, 20).replace(/\s+/g, '');
  return /^1\d{10}$/.test(phone) ? phone : '';
}

function hashQueryPassword(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
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
