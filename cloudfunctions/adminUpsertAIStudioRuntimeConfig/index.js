const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权配置模型');
    }

    const modelSettings = Array.isArray(event.modelSettings) ? event.modelSettings : [];
    const promptTemplates = Array.isArray(event.promptTemplates) ? event.promptTemplates : [];
    const routes = Array.isArray(event.routes) ? event.routes : [];

    const updates = [];
    for (const setting of modelSettings) {
      updates.push(upsertByKey('ai_studio_model_settings', 'scene', normalizeModelSetting(setting), OPENID));
    }
    for (const template of promptTemplates) {
      updates.push(upsertByKey('ai_studio_prompt_templates', 'promptKey', normalizePromptTemplate(template), OPENID));
    }
    for (const route of routes) {
      updates.push(upsertByKey('ai_studio_routes', 'routeKey', normalizeRoute(route), OPENID));
    }

    await Promise.all(updates);

    return {
      success: true,
      updated: updates.length,
      message: 'AI 影楼运行配置已保存'
    };
  } catch (error) {
    console.error('adminUpsertAIStudioRuntimeConfig failed:', error);
    return fail('INTERNAL_ERROR', '保存 AI 影楼运行配置失败');
  }
};

async function upsertByKey(collectionName, keyField, data, actorOpenid) {
  if (!data[keyField]) throw new Error(`${keyField} is required`);

  const nowData = {
    ...data,
    updatedBy: actorOpenid,
    updatedAt: db.serverDate()
  };

  const result = await db.collection(collectionName).where({ [keyField]: data[keyField] }).limit(1).get();
  if (result.data && result.data[0]) {
    await db.collection(collectionName).doc(result.data[0]._id).update({ data: nowData });
  } else {
    await db.collection(collectionName).add({
      data: {
        ...nowData,
        createdBy: actorOpenid,
        createdAt: db.serverDate()
      }
    });
  }
}

function normalizeModelSetting(input = {}) {
  return {
    scene: cleanText(input.scene, 60),
    enabled: input.enabled !== false,
    provider: cleanText(input.provider, 60) || 'local_fallback',
    model: cleanText(input.model, 120) || 'local-scripted-service',
    fallbackModel: cleanText(input.fallbackModel, 120),
    workflowId: cleanText(input.workflowId, 120),
    maxTokens: clampNumber(input.maxTokens, 100, 2000, 600),
    temperature: clampNumber(input.temperature, 0, 2, 0.4),
    requiresHumanQC: input.requiresHumanQC !== false,
    outputType: cleanText(input.outputType, 40),
    publicName: cleanText(input.publicName, 80),
    // 生图接口私有配置（仅入库存；读取侧由 getAIStudioRuntimeConfig 的 stripPrivateFields 剥离 apiKey）
    apiUrl: cleanText(input.apiUrl, 300),
    apiKey: cleanText(input.apiKey, 300),
    imageSize: cleanText(input.imageSize, 20) || '1024x1024',
    requestPath: cleanText(input.requestPath, 120)
  };
}

function normalizePromptTemplate(input = {}) {
  return {
    promptKey: cleanText(input.promptKey, 80),
    scene: cleanText(input.scene, 60),
    version: clampNumber(input.version, 1, 999, 1),
    enabled: input.enabled !== false,
    content: cleanText(input.content, 3000)
  };
}

function normalizeRoute(input = {}) {
  return {
    routeKey: cleanText(input.routeKey, 80),
    enabled: input.enabled !== false,
    productIds: normalizeStringArray(input.productIds, 20, 80),
    styleIds: normalizeStringArray(input.styleIds, 30, 40),
    customerServiceScene: cleanText(input.customerServiceScene, 60) || 'customer_service',
    imageGenerationScene: cleanText(input.imageGenerationScene, 60) || 'image_generation',
    processingMode: cleanText(input.processingMode, 40) || 'semi_auto'
  };
}

function normalizeStringArray(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value.map(item => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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

function fail(code, message) {
  return { success: false, code, message };
}
