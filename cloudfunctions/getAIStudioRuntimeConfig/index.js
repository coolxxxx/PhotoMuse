const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const DEFAULT_CONFIG = {
  modelSettings: [
    {
      scene: 'customer_service',
      enabled: true,
      provider: 'local_fallback',
      model: 'local-scripted-service',
      fallbackModel: 'local-scripted-service',
      maxTokens: 600,
      temperature: 0.4,
      publicName: '影楼客服助手'
    },
    {
      scene: 'image_generation',
      enabled: false,
      provider: 'manual',
      model: 'manual-human-qc',
      workflowId: 'id_photo_mvp_manual_v1',
      requiresHumanQC: true,
      outputType: 'id_photo',
      publicName: '人工半自动证件照流程'
    }
  ],
  promptTemplates: [
    {
      promptKey: 'ai_studio_service_v1',
      scene: 'customer_service',
      version: 1,
      enabled: true,
      content: '你是 AI 影楼客服，负责解释证件照下单、收图标准、授权合规、订单状态和交付规则。回答要简短、温和、明确，不承诺全自动，不处理未成年人、仿冒公众人物或低俗欺骗用途。'
    }
  ],
  routes: [
    {
      routeKey: 'id_photo_auto_v1',
      productIds: ['id_photo_9_9', 'resume_photo_29_9'],
      styleIds: ['ID-01', 'ID-02', 'ID-03', 'BZ-01'],
      customerServiceScene: 'customer_service',
      imageGenerationScene: 'image_generation',
      processingMode: 'semi_auto',
      enabled: true
    }
  ]
};

exports.main = async () => {
  try {
    const [settings, templates, routes] = await Promise.all([
      readCollection('ai_studio_model_settings'),
      readCollection('ai_studio_prompt_templates'),
      readCollection('ai_studio_routes')
    ]);

    return {
      success: true,
      config: sanitizeConfig({
        modelSettings: settings.length ? settings : DEFAULT_CONFIG.modelSettings,
        promptTemplates: templates.length ? templates : DEFAULT_CONFIG.promptTemplates,
        routes: routes.length ? routes : DEFAULT_CONFIG.routes
      })
    };
  } catch (error) {
    console.error('getAIStudioRuntimeConfig failed:', error);
    return {
      success: true,
      config: sanitizeConfig(DEFAULT_CONFIG),
      message: '使用默认影楼运行配置'
    };
  }
};

async function readCollection(name) {
  const result = await db.collection(name).where({ enabled: true }).limit(50).get();
  return result.data || [];
}

function sanitizeConfig(config) {
  return {
    modelSettings: (config.modelSettings || []).map(stripPrivateFields),
    promptTemplates: (config.promptTemplates || []).map(stripPrivateFields),
    routes: (config.routes || []).map(stripPrivateFields)
  };
}

function stripPrivateFields(item) {
  const copy = { ...item };
  delete copy._id;
  delete copy._openid;
  delete copy.apiKey;
  delete copy.secret;
  delete copy.token;
  delete copy.headers;
  delete copy.content;
  return copy;
}
