/**
 * 审核通过后的自动出图流水线（到「可 QC」）
 * 鉴权：管理员 OPENID+口令，或 internal=true + 相同口令（供其它云函数串联）
 * 流程：
 *   standard/证件照 → stage=idphoto（Hivision 引擎）
 *   portrait 写真   → reference → 每主题 grid → 默认分镜 cell
 * 完成/失败后调用 notifyAIStudioOrder 发邮件
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const orderId = String(event.orderId || '').trim();
  const adminPassword = event.adminPassword;
  const internal = event.internal === true;

  try {
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');
    const allowed = internal
      ? isAdminPassword(adminPassword)
      : (isAdmin(OPENID) && isAdminPassword(adminPassword));
    if (!allowed) return fail('FORBIDDEN', '无权触发出图流水线');

    const order = await getOrder(orderId);
    if (!order) return fail('NOT_FOUND', '订单不存在');
    if (!['queued', 'generating', 'photo_review'].includes(order.order_status) && order.photo_check !== 'passed') {
      // 允许已 pass 的 queued；其它状态不强行出图
      if (order.order_status !== 'queued' && order.order_status !== 'generating') {
        return fail('INVALID_STATUS', `当前状态 ${order.order_status} 不适合自动出图`);
      }
    }

    const productId = order.productId || '';
    const isPortrait = productId.includes('portrait') || (order.portrait_themes && order.portrait_themes.length);
    const themes = resolveThemes(order);
    const cells = parseCells(process.env.AI_STUDIO_AUTO_GEN_CELLS || '1,2,3');

    await markGenerating(orderId);
    await notify(orderId, 'review_passed', { autoGen: true });

    const steps = [];
    const failures = [];

    if (isPortrait) {
      steps.push({ stage: 'reference' });
      for (const t of themes) {
        steps.push({ stage: 'grid', themeId: t.themeId, themeName: t.themeName || t.themeId });
      }
      for (const t of themes) {
        for (const cell of cells) {
          steps.push({ stage: 'cell', themeId: t.themeId, cell });
        }
      }
    } else {
      steps.push({ stage: 'idphoto' });
    }

    const done = [];
    for (const step of steps) {
      const payload = {
        orderId,
        stage: step.stage,
        adminPassword,
        internal: true,
        themeId: step.themeId,
        cell: step.cell
      };
      try {
        const res = await cloud.callFunction({ name: 'generateAIStudioImage', data: payload });
        const body = res && res.result;
        if (body && body.success === false) {
          failures.push({ step, error: body.message || body.code || 'generate failed' });
          /* 生图接口未配置等硬失败：中止后续，避免空转烧钱 */
          if (body.code === 'CONFIG_MISSING' || body.code === 'FORBIDDEN') break;
        } else {
          done.push(step);
        }
      } catch (e) {
        failures.push({ step, error: e.message || String(e) });
      }
    }

    if (failures.length && !done.length) {
      await notify(orderId, 'generation_failed', { error: failures[0].error });
      await markStatus(orderId, 'queued', { autoGenStatus: 'failed' });
      return {
        success: false,
        code: 'GENERATION_FAILED',
        message: failures[0].error,
        done,
        failures
      };
    }

    const summary = isPortrait
      ? `写真：参考图+网格${themes.length}组，分镜 ${done.filter(s => s.stage === 'cell').length} 张（默认 ${cells.join('/')}）`
      : '证件照：已完成引擎出图';
    await notify(orderId, 'generation_ready', { summary });
    await markStatus(orderId, 'qc', { autoGenStatus: failures.length ? 'partial' : 'ready', autoGenSummary: summary });

    return { success: true, done, failures, summary };
  } catch (error) {
    console.error('autoGenerateAIStudioOrder failed:', error);
    try { await notify(orderId, 'generation_failed', { error: error.message || '未知错误' }); } catch (e) { /* noop */ }
    return fail('INTERNAL_ERROR', '自动出图流水线失败');
  }
};

function resolveThemes(order) {
  const raw = order.portrait_themes || order.themes || [];
  return raw.map(t => {
    if (!t) return null;
    if (typeof t === 'string') return { themeId: t, themeName: t };
    return { themeId: t.themeId, themeName: t.themeName || t.themeId };
  }).filter(t => t && t.themeId);
}

function parseCells(raw) {
  return String(raw).split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n >= 1 && n <= 15);
}

async function getOrder(orderId) {
  const r = await db.collection('ai_studio_orders').where({ orderId }).limit(1).get();
  return r.data && r.data[0];
}

async function markGenerating(orderId) {
  await db.collection('ai_studio_orders').where({ orderId }).update({
    data: { order_status: 'generating', autoGenStatus: 'running', updatedAt: db.serverDate() }
  });
}

async function markStatus(orderId, status, extra) {
  await db.collection('ai_studio_orders').where({ orderId }).update({
    data: Object.assign({ order_status: status, updatedAt: db.serverDate() }, extra || {})
  });
}

async function notify(orderId, type, extra) {
  try {
    await cloud.callFunction({
      name: 'notifyAIStudioOrder',
      data: Object.assign({ type, orderId }, extra || {})
    });
  } catch (e) {
    console.warn('notify skipped:', e.message);
  }
}

function isAdmin(openid) {
  const raw = process.env.AI_STUDIO_ADMIN_OPENIDS || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean).includes(openid);
}

function isAdminPassword(value) {
  const expected = process.env.AI_STUDIO_ADMIN_PASSWORD || '';
  return Boolean(expected) && typeof value === 'string' && value.trim() === expected;
}

function fail(code, message) {
  return { success: false, code, message };
}
