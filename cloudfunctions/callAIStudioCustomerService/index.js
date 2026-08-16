const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const DEFAULT_PROMPT = '你是 AI 影楼客服，负责解释证件照下单、收图标准、授权合规、订单状态和交付规则。回答要简短、温和、明确，不承诺全自动，不处理未成年人、仿冒公众人物或低俗欺骗用途。';

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!OPENID) return fail('UNAUTHENTICATED', '请先登录');

    const message = cleanText(event.message || event.question, 500);
    const orderId = cleanText(event.orderId, 80);
    if (!message) return fail('VALIDATION_ERROR', '请输入咨询内容');

    if (orderId) {
      const ownOrder = await db.collection('ai_studio_orders').where({ orderId, _openid: OPENID }).limit(1).get();
      if (!ownOrder.data || !ownOrder.data[0]) return fail('FORBIDDEN', '无权咨询该订单');
    }

    const [setting, prompt] = await Promise.all([
      getModelSetting('customer_service'),
      getPromptTemplate('ai_studio_service_v1')
    ]);

    let response;
    let providerUsed = setting.provider || 'local_fallback';

    if (setting.enabled && setting.provider === 'openai_compatible' && process.env.AI_STUDIO_TEXT_API_URL && process.env.AI_STUDIO_TEXT_API_KEY) {
      response = await callOpenAICompatible({
        url: process.env.AI_STUDIO_TEXT_API_URL,
        apiKey: process.env.AI_STUDIO_TEXT_API_KEY,
        model: setting.model,
        systemPrompt: prompt.content || DEFAULT_PROMPT,
        message,
        maxTokens: setting.maxTokens || 600,
        temperature: setting.temperature ?? 0.4
      }).catch(error => {
        console.error('AI studio customer service provider failed:', error.message);
        providerUsed = 'local_fallback';
        return localReply(message);
      });
    } else {
      providerUsed = 'local_fallback';
      response = localReply(message);
    }

    await db.collection('ai_studio_audit_logs').add({
      data: {
        orderId,
        actorOpenid: OPENID,
        action: 'customer_service_message',
        payload: {
          provider: providerUsed,
          messageLength: message.length
        },
        createdAt: db.serverDate()
      }
    }).catch(() => {});

    return {
      success: true,
      response,
      provider: providerUsed,
      model: providerUsed === 'local_fallback' ? 'local-scripted-service' : setting.model
    };
  } catch (error) {
    console.error('callAIStudioCustomerService failed:', error);
    return {
      success: true,
      response: localReply(event.message || event.question || ''),
      provider: 'local_fallback',
      message: '已使用本地客服话术'
    };
  }
};

async function getModelSetting(scene) {
  const result = await db.collection('ai_studio_model_settings').where({ scene, enabled: true }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : {
    scene,
    enabled: true,
    provider: 'local_fallback',
    model: 'local-scripted-service',
    maxTokens: 600,
    temperature: 0.4
  };
}

async function getPromptTemplate(promptKey) {
  const result = await db.collection('ai_studio_prompt_templates').where({ promptKey, enabled: true }).limit(1).get();
  return result.data && result.data[0] ? result.data[0] : {
    promptKey,
    content: DEFAULT_PROMPT
  };
}

function callOpenAICompatible({ url, apiKey, model, systemPrompt, message, maxTokens, temperature }) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:') {
      reject(new Error('AI_STUDIO_TEXT_API_URL must use https'));
      return;
    }

    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: maxTokens,
      temperature,
      stream: false
    });

    const req = https.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'POST',
      timeout: 8000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`provider status ${res.statusCode}`));
            return;
          }
          const data = JSON.parse(raw);
          const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (!content) {
            reject(new Error('provider response shape invalid'));
            return;
          }
          resolve(String(content).trim().slice(0, 1200));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('provider timeout'));
    });
    req.write(body);
    req.end();
  });
}

function localReply(message) {
  const text = String(message || '');
  if (text.includes('照片') || text.includes('上传') || text.includes('怎么拍')) {
    return '请上传 1-3 张清晰正脸照：白天自然光、脸部无遮挡、不戴帽子墨镜口罩、不要多人合照。照片不合格我们会提醒补拍，不会硬做。';
  }
  if (text.includes('授权') || text.includes('隐私') || text.includes('安全吗')) {
    return '制作前需要确认本人或已授权、人物已满 18 岁。原图只用于本次制作，未经单独案例授权不会公开展示。';
  }
  if (text.includes('多久') || text.includes('时间') || text.includes('交付')) {
    return '证件照 MVP 采用半自动审核和人工 QC，通常会在审核通过后尽快交付；正式承诺时间可按运营排单设置。';
  }
  if (text.includes('价格') || text.includes('多少钱')) {
    return '当前开放 9.9 证件照极速版和 29.9 简历形象照。你可以先选套餐和底色，上传照片后进入审核流程。';
  }
  return '您好，我是 AI 影楼客服助手。可以帮你说明下单流程、照片要求、授权隐私、订单状态和交付规则。';
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function fail(code, message) {
  return { success: false, code, message };
}
