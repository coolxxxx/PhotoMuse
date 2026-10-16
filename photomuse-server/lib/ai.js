/* ============================================================
 * 浅焦映像 · AI 调用层（fkall OpenAI 兼容节点）
 * 生图：/v1/images/generations（同步，url 或 b64）
 * 视觉：/v1/chat/completions（多模态）
 * 生成结果统一下载到本地 uploads 目录
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = process.env.PM_UPLOAD_ROOT || path.join(__dirname, '..', 'uploads');

/* 内置默认节点（fkall OpenAI 兼容）；端点可换成任意 OpenAI 兼容服务 */
const DEFAULT_BASE = 'https://api.3213218.xyz/v1';
const DEFAULT_IMG_MODEL = 'fkall-图像';
const DEFAULT_TXT_MODEL = 'fkall-文本';

/* 运行期配置提供者：由 server.js 注入（读 config_kv 的管理面板设置）。
   每次调用时解析 → 面板改完立即生效，无需重启服务。 */
let runtimeProvider = null;
function bindRuntimeConfig(fn) { runtimeProvider = fn; }

/* 把「完整端点」或「纯 base」统一成 base：
     https://api.x.com/v1/images/generations → https://api.x.com/v1
     https://api.x.com/v1                    → https://api.x.com/v1 */
function normalizeBase(raw) {
  let s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return DEFAULT_BASE;
  s = s.replace(/\/images\/generations$/i, '').replace(/\/chat\/completions$/i, '');
  return s.replace(/\/+$/, '') || DEFAULT_BASE;
}

/* 解析优先级：管理面板 image_generation 场景 > 环境变量 > 内置默认。
   面板只需填「base URL（或完整 images/generations 地址）+ Key + 模型名」即可，
   对话/视觉端点按同一 base 自动推导。 */
function resolveConfig() {
  const panel = (runtimeProvider && runtimeProvider()) || {};
  const panelUrl = String(panel.apiUrl || '').trim();
  const envGen = String(process.env.PM_GEN_API || '').trim();
  const envChat = String(process.env.PM_CHAT_API || '').trim();

  let genApi;
  if (panelUrl) {
    genApi = /\/images\/generations$/i.test(panelUrl) ? panelUrl : normalizeBase(panelUrl) + '/images/generations';
  } else {
    genApi = envGen || DEFAULT_BASE + '/images/generations';
  }

  let chatApi;
  if (envChat) chatApi = envChat;
  else if (panelUrl) chatApi = normalizeBase(panelUrl) + '/chat/completions';
  else chatApi = DEFAULT_BASE + '/chat/completions';

  return {
    enabled: panel.enabled !== false,
    genApi,
    chatApi,
    key: String(panel.apiKey || '').trim() || String(process.env.PM_AI_KEY || '').trim(),
    imgModel: String(panel.model || '').trim() || String(process.env.PM_IMG_MODEL || '').trim() || DEFAULT_IMG_MODEL,
    txtModel: String(process.env.PM_TXT_MODEL || '').trim() || DEFAULT_TXT_MODEL,
    imageSize: String(panel.imageSize || '').trim() || '1024x1792'
  };
}

function requireAIConfig(cfg) {
  const e = new Error('');
  e.code = 'CONFIG_MISSING';
  if (!cfg.enabled) {
    e.message = 'AI 生图已在管理后台-模型设置中停用';
    throw e;
  }
  if (!cfg.key) {
    e.message = 'AI 生图未配置：请在管理后台-模型设置填写接口地址（base URL）与 Key，或设置环境变量 PM_AI_KEY';
    throw e;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 三阶段提示词（与 generateAIStudioImage 同构：影楼质感+表情因果+光照拓扑） */
const STUDIO_QUALITY_CLAUSE = '影楼成片质感要求：这是一张专业影楼级精修人像成片，画面中只有被拍摄的人物本身与其所处环境，绝不出现灯具、灯架、柔光箱、反光板、摄影师等任何摄影器材或工作人员。人物布光专业立体：主光方向明确统一，面部一侧受光充分、另一侧自然过渡到柔和阴影（伦勃朗式明暗层次），发丝有柔和的轮廓光，眼神光明亮有神，人物与背景/环境有自然的光影分离。使用中画幅相机与人像镜头的成像语言：85mm 浅景深，背景自然柔化、层次干净。商业精修级后期的质感：肤色均匀透亮但保留真实的皮肤纹理与细节，服装材质纹理清晰，整体色调统一高级，达到杂志封面级的商业人像水准。';
const EXPRESSION_CAUSAL_CLAUSE = '人物神态要求：每个画面中人物的表情由该画面的具体情境自然触发，眼神有内容、嘴角有情绪来由，禁止无来由的空洞摆拍微笑或呆滞直视镜头。';
const CELL_LIGHT_TOPOLOGY = '光照一致性：保持与预览格完全相同的光源方向、明暗关系与背景光层次——光源固定在世界坐标中，高清化只提升细节分辨率，不得擅自改变光效方向、阴影位置或色调，眼神光方向、面部亮暗侧、发丝轮廓光方位必须与预览格一一对应。';

const THEME_HINTS = {
  guofeng: '汉服、园林长廊、竹林溪水，水墨留白背景，拍出温婉端庄的古风质感',
  sports: '球场、街头、城市跑道，动感构图配高对比光影，元气氛围直接拉满',
  casual: '咖啡店、居家窗边、街头随拍，自然光加浅景深，轻松拿捏氛围感',
  travel: '海边日落、古镇石巷、山野草原，大场景构图配旅行穿搭，出片即封面',
  family: '温馨互动、拥抱对视、全家福站位，柔和暖调光线，幸福感溢出屏幕',
  professional: '商务正装、简洁渐变背景、杂志封面级职业形象，自信专业气质',
  retro: '复古西装衬衫、胶片颗粒质感、暖黄霓虹与百叶窗光影，港星氛围',
  sino: '新中式改良服装、茶席绢本屏风、温润木色与留白构图，东方雅致',
  french: '复古礼服、宫廷质感窗帘与烛台、油画色温与古典布光，优雅浓郁',
  film: '日常质感服装、自然场景、胶片色温与浅景深叙事构图，故事感氛围',
  destination: '全球旅拍地标场景：热带海岛、雪山垭口、沙漠驼影、山间瀑布等大场景，人物清晰构图辽阔；客户可在场景描述中指定具体地标'
};

function buildPrompt(stage, { cell, themeId, sceneDesc, themeCount }) {
  if (stage === 'reference') {
    return `你是顶级的AI电影摄影师，正在为客户建立写真基准锚点【参考图0】。本次拍摄共 ${themeCount} 个主题。` +
      (sceneDesc ? `客户场景需求：${sceneDesc}。` : '') +
      `画面界定人物长相五官、发型、服装配饰、环境基调，并确定统一的主光方向、影调与色彩体系（后续所有分镜沿用）。` +
      STUDIO_QUALITY_CLAUSE + EXPRESSION_CAUSAL_CLAUSE;
  }
  if (stage === 'grid') {
    const hint = THEME_HINTS[themeId] || '';
    return `你是顶级的AI电影摄影师，正在基于【参考图0】生成 3 行 5 列共 15 个分镜的摄影预览网格（单张拼图）。主题场景：${hint}。` +
      `15 个视角依次为：极端特写、非正面中景、低角度仰拍、过肩镜头、正上方俯拍、左侧90度轮廓、右侧90度面部特写、远景鸟瞰、荷兰角倾斜、低调暗调逆光、服饰纹理特写、左侧过肩、高调闪光、情景广角、极低角度前景遮挡。` +
      `各分格与参考图人物完全一致，共享同一光源方向与影调，无克隆人。` + EXPRESSION_CAUSAL_CLAUSE;
  }
  if (stage === 'cell') {
    const hint = THEME_HINTS[themeId] || '';
    return `你是顶级的AI电影摄影师，正在把预览网格中第 ${cell} 格渲染为单张高清大图。精确复制该格的机位构图、人物姿态与场景（主题场景：${hint}）。` +
      CELL_LIGHT_TOPOLOGY +
      `画面升级：增加微小细节与真实物理纹理（皮肤质感、衣物纤维），4K 以上，干净商业数码质感不加颗粒。人物长相发型服装与参考保持 100% 一致，绝不换人换装。` + STUDIO_QUALITY_CLAUSE;
  }
  return '生成一张专业影楼级人像照片。' + STUDIO_QUALITY_CLAUSE;
}

/* 提交生图并返回 { buffer, ext } */
async function generateImage(prompt, size) {
  const cfg = resolveConfig();
  requireAIConfig(cfg);
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(cfg.genApi, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cfg.imgModel, prompt, n: 1, size: size || cfg.imageSize })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 150));
      const data = await res.json();
      const item = data && Array.isArray(data.data) ? data.data[0] : null;
      const url = item && (item.url || (item.b64_json ? 'data:image/png;base64,' + item.b64_json : null));
      if (!url) throw new Error('响应无图片');
      const buffer = url.startsWith('data:')
        ? Buffer.from(url.split(',')[1], 'base64')
        : Buffer.from(await (await fetch(url)).arrayBuffer());
      if (buffer.length < 20000) throw new Error('图片过小');
      return { buffer, ext: url.startsWith('data:') ? 'png' : (url.match(/\.(png|jpe?g|webp)(\?|$)/i) || [, 'jpg'])[1] };
    } catch (e) {
      lastErr = e;
      const transient = /HTTP (429|500|502|503|504)|queue is full|ECONNRESET|socket hang up/i.test(String(e.message));
      if (!transient || attempt === 2) throw e;
      await sleep(3000 * (attempt + 1));
    }
  }
  throw lastErr;
}

/* 视觉分析：看照片 → 5 主题评分 */
async function analyzePhoto(imageUrl) {
  const cfg = resolveConfig();
  requireAIConfig(cfg);
  const res = await fetch(cfg.chatApi, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.txtModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: '分析这张照片中人物的气质、适合的写真风格。以 JSON 输出：{"summary":"一句话总结","scores":[{"themeId":"guofeng","themeName":"古风写真","score":0-100,"reason":"简短理由"},...全部5个主题:guofeng/sports/casual/travel/family]}，只输出 JSON。' }
        ]
      }]
    })
  });
  if (!res.ok) throw new Error('视觉分析失败 HTTP ' + res.status);
  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('分析结果解析失败');
  return JSON.parse(m[0]);
}

/* 把 buffer 存到 uploads，返回公网 URL 路径（/PM/uploads/...）。
   异步写盘：writeFileSync 会阻塞事件循环，大图写入时会拖慢所有并发请求。 */
async function saveUpload(relPath, buffer) {
  const abs = path.join(UPLOAD_ROOT, relPath);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, buffer);
  return '/PM/uploads/' + relPath.replace(/\\/g, '/');
}

module.exports = { generateImage, analyzePhoto, saveUpload, buildPrompt, THEME_HINTS, bindRuntimeConfig, resolveConfig };
