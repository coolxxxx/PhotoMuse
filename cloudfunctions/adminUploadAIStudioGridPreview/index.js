const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const GRID_PREVIEW_ALLOWED_STATUSES = ['queued', 'grid_preview', 'cell_selected'];

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权上传预览网格');
    }

    const orderId = cleanText(event.orderId, 80);
    const fileID = cleanText(event.fileID, 300);
    const fileName = cleanText(event.fileName, 120);
    const size = normalizeNumber(event.size);
    const mimeType = cleanText(event.mimeType, 60);
    const note = cleanText(event.note, 200);

    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');
    if (!fileID || !fileID.startsWith('cloud://')) return fail('VALIDATION_ERROR', '预览网格文件参数无效');

    const order = await getOrder(orderId);
    if (!order) return fail('NOT_FOUND', '订单不存在');

    if (order.product_type !== 'portrait') {
      return fail('VALIDATION_ERROR', '该订单不是写真套图订单');
    }
    if (!GRID_PREVIEW_ALLOWED_STATUSES.includes(order.order_status)) {
      return fail('INVALID_STATUS', '当前状态不能上传预览网格');
    }

    // 主题维度：可选 themeId，默认订单第一个主题；传入时必须属于该订单
    const orderThemes = getOrderThemes(order);
    const themeIdInput = cleanText(event.themeId, 40);
    let targetTheme = null;
    if (themeIdInput) {
      targetTheme = orderThemes.find(item => item.themeId === themeIdInput) || null;
      if (!targetTheme) return fail('VALIDATION_ERROR', '主题不属于该订单');
    } else if (orderThemes.length > 0) {
      targetTheme = orderThemes[0];
    }

    // 旧网格置 replaced：仅替换同主题下已上传的 grid_preview
    const replaceWhere = { orderId, fileType: 'grid_preview', status: 'uploaded' };
    if (targetTheme) replaceWhere.themeId = targetTheme.themeId;
    await db.collection('ai_studio_files')
      .where(replaceWhere)
      .update({
        data: {
          status: 'replaced',
          updatedAt: db.serverDate()
        }
      });

    await db.collection('ai_studio_files').add({
      data: {
        orderId,
        _openid: order._openid,
        fileType: 'grid_preview',
        ...(targetTheme ? { themeId: targetTheme.themeId } : {}),
        fileID,
        fileName,
        size,
        mimeType,
        status: 'uploaded',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    const updateData = {
      order_status: 'grid_preview',
      grid_preview_uploaded_at: db.serverDate(),
      updatedAt: db.serverDate()
    };
    // 仅重置该主题的选片（多主题订单按主题内嵌 selectedCells；旧单主题订单沿用 selected_cells）
    const themeIndex = targetTheme && Array.isArray(order.themes)
      ? order.themes.findIndex(item => item && item.themeId === targetTheme.themeId)
      : -1;
    if (themeIndex >= 0) {
      const entry = order.themes[themeIndex] || {};
      if (Array.isArray(entry.selectedCells) && entry.selectedCells.length > 0) {
        updateData[`themes.${themeIndex}.selectedCells`] = [];
      }
    } else if (Array.isArray(order.selected_cells) && order.selected_cells.length > 0) {
      updateData.selected_cells = [];
    }

    await db.collection('ai_studio_orders').where({ orderId }).update({
      data: updateData
    });

    await writeAudit(orderId, OPENID, 'admin_upload_grid_preview', {
      fileID,
      fileName,
      note,
      ...(targetTheme ? { themeId: targetTheme.themeId } : {})
    });

    return {
      success: true,
      order: {
        orderId,
        order_status: 'grid_preview',
        ...(targetTheme ? { themeId: targetTheme.themeId } : {})
      }
    };
  } catch (error) {
    console.error('adminUploadAIStudioGridPreview failed:', error);
    return fail('INTERNAL_ERROR', '上传预览网格失败');
  }
};

async function getOrder(orderId) {
  const result = await db.collection('ai_studio_orders').where({ orderId }).limit(1).get();
  return result.data && result.data[0];
}

// 归一化订单主题列表：新订单读 themes 数组；旧单主题订单回退 theme_id/theme_name
function getOrderThemes(order) {
  if (Array.isArray(order.themes) && order.themes.length > 0) {
    return order.themes
      .filter(item => item && item.themeId)
      .map(item => ({ themeId: item.themeId, themeName: item.themeName || '' }));
  }
  if (order.theme_id) {
    return [{ themeId: order.theme_id, themeName: order.theme_name || '' }];
  }
  return [];
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
