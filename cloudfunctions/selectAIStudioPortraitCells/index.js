const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const MIN_CELL_INDEX = 1;
const MAX_CELL_INDEX = 15;
const DEFAULT_PHOTOS_PER_THEME = 5;

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    const orderId = cleanText(event.orderId, 80);
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    const cells = normalizeCells(event.cells);
    if (!cells) return fail('VALIDATION_ERROR', '请选择有效的分镜编号');

    const order = await findOrder(event, orderId, OPENID);
    if (!order) return fail('NOT_FOUND', '订单不存在或查询信息不匹配');

    if (order.product_type !== 'portrait') {
      return fail('VALIDATION_ERROR', '该订单不是写真套图订单');
    }
    if (order.order_status !== 'grid_preview') {
      return fail('INVALID_STATUS', '当前状态不能选片');
    }

    // 旧单主题订单（无 themes 数组）：完全沿用旧逻辑，写 selected_cells
    if (!Array.isArray(order.themes) || order.themes.length === 0) {
      const deliveryCount = normalizeNumber(order.deliveryCount) || DEFAULT_PHOTOS_PER_THEME;
      if (cells.length < 1 || cells.length > deliveryCount) {
        return fail('VALIDATION_ERROR', `请选择 1-${deliveryCount} 个分镜`);
      }
      await db.collection('ai_studio_orders').where({ orderId }).update({
        data: {
          selected_cells: cells,
          order_status: 'cell_selected',
          cell_selected_at: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      await writeAudit(orderId, OPENID || 'credential', 'select_portrait_cells', {
        cells,
        themeId: order.theme_id || ''
      });
      return {
        success: true,
        order: {
          orderId,
          order_status: 'cell_selected',
          selected_cells: cells
        }
      };
    }

    // 多主题订单：按主题选片。为兼容旧调用，themeId 未传时默认第一个主题
    const themeIdInput = cleanText(event.themeId, 40);
    const themeIndex = themeIdInput
      ? order.themes.findIndex(item => item && item.themeId === themeIdInput)
      : order.themes.findIndex(item => item && item.themeId);
    if (themeIndex < 0 || !order.themes[themeIndex]) {
      return fail('VALIDATION_ERROR', '主题不属于该订单');
    }
    const activeThemeId = order.themes[themeIndex].themeId;

    // 每主题可选分镜上限 = deliveryCount / theme_count（兜底 5）
    const themeCount = normalizeNumber(order.theme_count) || order.themes.length;
    const deliveryCount = normalizeNumber(order.deliveryCount);
    let photosPerTheme = themeCount > 0 ? Math.floor(deliveryCount / themeCount) : 0;
    if (!Number.isFinite(photosPerTheme) || photosPerTheme < 1) photosPerTheme = DEFAULT_PHOTOS_PER_THEME;
    if (cells.length < 1 || cells.length > photosPerTheme) {
      return fail('VALIDATION_ERROR', `请选择 1-${photosPerTheme} 个分镜`);
    }

    // 当且仅当所有主题都已完成选片时，订单才进入 cell_selected
    const nextThemes = order.themes.map((item, index) => (
      index === themeIndex ? { ...item, selectedCells: cells } : item
    ));
    const allThemesSelected = nextThemes.every(
      item => Array.isArray(item.selectedCells) && item.selectedCells.length > 0
    );

    const updateData = {
      [`themes.${themeIndex}.selectedCells`]: cells,
      order_status: allThemesSelected ? 'cell_selected' : 'grid_preview',
      updatedAt: db.serverDate()
    };
    if (allThemesSelected) {
      updateData.cell_selected_at = db.serverDate();
    }

    await db.collection('ai_studio_orders').where({ orderId }).update({
      data: updateData
    });

    await writeAudit(orderId, OPENID || 'credential', 'select_portrait_cells', {
      cells,
      themeId: activeThemeId,
      allThemesSelected
    });

    return {
      success: true,
      order: {
        orderId,
        order_status: allThemesSelected ? 'cell_selected' : 'grid_preview',
        themeId: activeThemeId,
        selected_cells: cells,
        themes: nextThemes
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
