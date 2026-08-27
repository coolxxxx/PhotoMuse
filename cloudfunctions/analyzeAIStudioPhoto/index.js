// 部署说明：本函数会同步调用外部视觉模型（超时 30 秒），建议将云函数超时时间
// 设置为不低于 40 秒（微信开发者工具/云开发控制台调整，或本目录 config.json
// 配置 { "timeout": 40 }），内存建议不低于 256MB。
const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const ANALYSIS_TIMEOUT_MS = 30000;

// 写真主题常量表：id -> 中文名（与 photomuseOpenApi 的 PORTRAIT_THEMES 同构）
const THEME_NAMES = {
  guofeng: '古风写真',
  sports: '运动活力',
  casual: '休闲日常',
  travel: '旅拍风光',
  family: '亲子合照'
};
const THEME_IDS = Object.keys(THEME_NAMES);

// 内置视觉分析提示词（要求模型严格只输出 JSON）
const ANALYSIS_PROMPT = [
  '你是一位专业的摄影视觉分析师。请仔细观察这张用户照片，分析照片中人物的性别、大致年龄段、气质风格、发型、着装以及照片的光线条件。',
  '在完成人物分析后，请针对以下 5 个写真主题（themeId 与名称固定）：',
  '- guofeng：古风写真',
  '- sports：运动活力',
  '- casual：休闲日常',
  '- travel：旅拍风光',
  '- family：亲子合照',
  '逐一给出 0-100 的适配度评分（分数越高表示该人物越适合拍摄此主题），并为每个主题写一句话理由。',
  '严格只输出 JSON，不要输出任何解释性文字、前后缀或 Markdown 代码块，输出格式如下：',
  '{"summary":"人物概况一句话（包含性别、年龄段、气质风格等要点）","scores":[{"themeId":"guofeng","score":92,"reason":"一句话理由"},{"themeId":"sports","score":65,"reason":"一句话理由"},{"themeId":"casual","score":80,"reason":"一句话理由"},{"themeId":"travel","score":75,"reason":"一句话理由"},{"themeId":"family","score":50,"reason":"一句话理由"}]}',
  'scores 数组必须且只能包含上述 5 个 themeId，顺序不限。'
].join('\n');

exports.main = async (event = {}) => {
  // 1. 鉴权：优先 OPENID（小程序调用）；无 OPENID 时（网站经网关调用）校验 apiKey
  const { OPENID } = cloud.getWXContext();
  const actorOpenid = OPENID || 'open_api';
  if (!OPENID && !isValidApiKey(cleanText(event.apiKey, 128))) {
    return fail('UNAUTHENTICATED', '请先登录');
  }

  try {
    // 2. 入参校验
    const fileID = cleanText(event.fileID || event.fileId, 300);
    if (!fileID || !fileID.startsWith('cloud://')) {
      return fail('VALIDATION_ERROR', '照片文件参数无效');
    }

    // 3. 配置读取：photo_analysis 场景必须是 openai_compatible 且配置完整
    const setting = await getPhotoAnalysisSetting();
    if (!setting || setting.provider !== 'openai_compatible' || !setting.apiUrl || !setting.apiKey || !setting.model) {
      return fail('CONFIG_MISSING', '视觉分析模型未配置，请在管理后台-模型设置中配置 photo_analysis 场景（需支持视觉的模型，如 glm-4v-plus）');
    }
    const requestModel = cleanText(setting.model, 120);

    // 4. 照片转 https 临时链接
    let tempFileUrl = '';
    try {
      const urlResult = await cloud.getTempFileURL({ fileList: [fileID] });
      const item = urlResult && urlResult.fileList && urlResult.fileList[0];
      /* 兼容字段名：真实 wx-server-sdk 返回 tempFileURL，mock/旧文档为 tempFileUrl */
      const url = item && (item.tempFileUrl || item.tempFileURL) ? String(item.tempFileUrl || item.tempFileURL) : '';
      if (!url.startsWith('https://')) throw new Error('tempFileUrl missing or not https');
      tempFileUrl = url;
    } catch (error) {
      console.error('analyzeAIStudioPhoto getTempFileURL failed:', error);
      return fail('INTERNAL_ERROR', '获取照片链接失败');
    }

    // 5. 调用视觉模型（OpenAI 兼容 chat completions，多模态消息）
    let content;
    try {
      content = await callVisionModel({
        apiUrl: setting.apiUrl,
        apiKey: setting.apiKey,
        model: requestModel,
        imageUrl: tempFileUrl,
        maxTokens: setting.maxTokens || 600
      });
    } catch (error) {
      console.error('analyzeAIStudioPhoto provider failed:', error);
      return fail('ANALYSIS_FAILED', '照片分析服务调用失败，请稍后重试');
    }

    // 6. 解析响应内容（剥代码围栏 -> JSON.parse -> themeId 不全时正则提取重试）
    const analysis = parseAnalysis(content);
    if (!analysis) {
      return fail('ANALYSIS_FAILED', '分析结果解析失败，请稍后重试');
    }

    // 7. 审计（失败静默）
    db.collection('ai_studio_audit_logs').add({
      data: {
        actorOpenid,
        action: 'analyze_photo',
        payload: {
          topTheme: analysis.scores[0].themeId,
          provider: requestModel
        },
        createdAt: db.serverDate()
      }
    }).catch(() => {});

    return {
      success: true,
      analysis: {
        summary: analysis.summary,
        scores: analysis.scores
      }
    };
  } catch (error) {
    console.error('analyzeAIStudioPhoto failed:', error);
    return fail('INTERNAL_ERROR', '照片分析失败');
  }
};

// ---------------------------------------------------------------------------
// 鉴权
// ---------------------------------------------------------------------------

function isValidApiKey(apiKey) {
  if (!apiKey) return false;
  const allowedKeys = String(process.env.AI_STUDIO_OPEN_API_KEYS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  return allowedKeys.includes(apiKey);
}

// ---------------------------------------------------------------------------
// 配置读取
// ---------------------------------------------------------------------------

async function getPhotoAnalysisSetting() {
  const result = await db.collection('ai_studio_model_settings')
    .where({ scene: 'photo_analysis', enabled: true })
    .limit(1)
    .get();
  return result.data && result.data[0];
}

// ---------------------------------------------------------------------------
// 视觉模型调用（OpenAI 兼容 chat completions）
// ---------------------------------------------------------------------------

function callVisionModel({ apiUrl, apiKey, model, imageUrl, maxTokens }) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(apiUrl);
    } catch (error) {
      reject(new Error('视觉分析接口地址无效'));
      return;
    }
    if (parsedUrl.protocol !== 'https:') {
      reject(new Error('视觉分析接口地址必须使用 https'));
      return;
    }

    const body = JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: ANALYSIS_PROMPT }
          ]
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
      stream: false
    });

    const req = https.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'POST',
      timeout: ANALYSIS_TIMEOUT_MS,
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
            reject(new Error(`provider status ${res.statusCode}: ${raw.slice(0, 300)}`));
            return;
          }
          const data = JSON.parse(raw);
          const messageContent = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
          if (typeof messageContent !== 'string' || !messageContent.trim()) {
            reject(new Error('provider response shape invalid'));
            return;
          }
          resolve(messageContent);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('视觉分析请求超时'));
    });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 响应解析与归一化
// ---------------------------------------------------------------------------

function parseAnalysis(content) {
  const text = stripCodeFence(content);

  // 第一轮：直接 JSON.parse，themeId 齐全则直接采用
  const first = safeParseObject(text);
  if (first && hasAllThemeIds(first)) return normalizeAnalysis(first);

  // 第二轮：解析失败或 themeId 不全时，正则提取首个 {...} 再 parse
  const match = text.match(/\{[\s\S]*\}/);
  const second = match ? safeParseObject(match[0]) : null;
  const candidate = second && Array.isArray(second.scores) ? second
    : (first && Array.isArray(first.scores) ? first : null);
  if (!candidate) return null;

  // 缺失的 themeId 由归一化补全（score 50 / reason 暂无数据）
  return normalizeAnalysis(candidate);
}

function stripCodeFence(content) {
  let text = String(content || '').trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) text = fenced[1].trim();
  return text;
}

function safeParseObject(text) {
  try {
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch (error) {
    return null;
  }
}

function hasAllThemeIds(data) {
  if (!Array.isArray(data.scores)) return false;
  return THEME_IDS.every(themeId =>
    data.scores.some(item => item && typeof item === 'object' && item.themeId === themeId)
  );
}

function normalizeAnalysis(data) {
  const summary = typeof data.summary === 'string' && data.summary.trim()
    ? data.summary.trim().slice(0, 200)
    : '';

  const byTheme = {};
  if (Array.isArray(data.scores)) {
    for (const item of data.scores) {
      if (!item || typeof item !== 'object') continue;
      const themeId = THEME_IDS.includes(item.themeId) ? item.themeId : null;
      if (!themeId || byTheme[themeId]) continue;
      byTheme[themeId] = {
        themeId,
        themeName: THEME_NAMES[themeId],
        score: clampScore(item.score),
        reason: typeof item.reason === 'string' && item.reason.trim()
          ? item.reason.trim().slice(0, 200)
          : '暂无数据'
      };
    }
  }

  // 缺失的 themeId 补 score 50 / reason 暂无数据
  const scores = THEME_IDS.map(themeId => byTheme[themeId] || {
    themeId,
    themeName: THEME_NAMES[themeId],
    score: 50,
    reason: '暂无数据'
  });

  // 按分数降序
  scores.sort((a, b) => b.score - a.score);

  return { summary, scores };
}

function clampScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function fail(code, message) {
  return { success: false, code, message };
}
