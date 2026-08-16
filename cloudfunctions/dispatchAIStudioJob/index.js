const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    const orderId = cleanText(event.orderId, 80);
    if (!OPENID) return fail('UNAUTHENTICATED', '请先登录');
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    const order = await getAccessibleOrder(orderId, OPENID, event.adminPassword);
    if (!order) return fail('NOT_FOUND', '订单不存在或无权访问');
    if (!['queued', 'generating', 'qc'].includes(order.order_status)) {
      return fail('INVALID_STATUS', '当前订单状态不需要派发出图任务');
    }

    const existing = await db.collection('ai_studio_jobs')
      .where({ orderId, status: db.command.in(['queued', 'generating', 'qc']) })
      .limit(1)
      .get();

    if (existing.data && existing.data[0]) {
      return {
        success: true,
        job: existing.data[0],
        message: '已有进行中的出图任务'
      };
    }

    const route = await getRoute(order);
    const imageSetting = await getImageSetting(route.imageGenerationScene || 'image_generation');
    const jobStatus = imageSetting.provider === 'manual' || !imageSetting.enabled ? 'queued' : 'queued';

    const job = {
      orderId,
      _openid: order._openid,
      jobType: 'ai_studio_image_generation',
      status: jobStatus,
      dispatchMode: imageSetting.enabled ? 'configured_provider' : 'manual_required',
      provider: imageSetting.provider || 'manual',
      model: imageSetting.model || 'manual-human-qc',
      workflowId: imageSetting.workflowId || 'id_photo_mvp_manual_v1',
      routeKey: route.routeKey,
      productId: order.productId,
      styleId: order.styleId,
      requiresHumanQC: imageSetting.requiresHumanQC !== false,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    const addResult = await db.collection('ai_studio_jobs').add({ data: job });

    await db.collection('ai_studio_orders').where({ orderId }).update({
      data: {
        order_status: 'queued',
        updatedAt: db.serverDate()
      }
    });

    await db.collection('ai_studio_audit_logs').add({
      data: {
        orderId,
        actorOpenid: OPENID,
        action: 'dispatch_image_job',
        payload: {
          jobId: addResult._id,
          provider: job.provider,
          workflowId: job.workflowId,
          dispatchMode: job.dispatchMode
        },
        createdAt: db.serverDate()
      }
    });

    return {
      success: true,
      job: {
        jobId: addResult._id,
        ...job
      }
    };
  } catch (error) {
    console.error('dispatchAIStudioJob failed:', error);
    return fail('INTERNAL_ERROR', '派发出图任务失败');
  }
};

async function getAccessibleOrder(orderId, openid, adminPassword) {
  const ownResult = await db.collection('ai_studio_orders').where({ orderId, _openid: openid }).limit(1).get();
  if (ownResult.data && ownResult.data[0]) return ownResult.data[0];

  if (!isAdmin(openid) || !isAdminPassword(adminPassword)) return null;

  const result = await db.collection('ai_studio_orders').where({ orderId }).limit(1).get();
  return result.data && result.data[0];
}

async function getRoute(order) {
  const result = await db.collection('ai_studio_routes').where({ enabled: true }).limit(50).get();
  const routes = result.data || [];
  const matched = routes.find(route =>
    (!Array.isArray(route.productIds) || route.productIds.length === 0 || route.productIds.includes(order.productId)) &&
    (!Array.isArray(route.styleIds) || route.styleIds.length === 0 || route.styleIds.includes(order.styleId))
  );
  return matched || {
    routeKey: 'id_photo_auto_v1',
    imageGenerationScene: 'image_generation',
    processingMode: 'semi_auto'
  };
}

async function getImageSetting(scene) {
  const result = await db.collection('ai_studio_model_settings').where({ scene, enabled: true }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : {
    scene,
    enabled: false,
    provider: 'manual',
    model: 'manual-human-qc',
    workflowId: 'id_photo_mvp_manual_v1',
    requiresHumanQC: true
  };
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

function fail(code, message) {
  return { success: false, code, message };
}
