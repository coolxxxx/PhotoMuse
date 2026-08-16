// 部署说明：本函数会同步调用外部 OpenAI 兼容生图接口，生图耗时较长（常见 30-90 秒）。
// 部署时必须将本云函数的超时时间设置为 120 秒（在微信开发者工具/云开发控制台中调整，
// 或在本函数目录 config.json 中配置 { "timeout": 120 }），内存建议不低于 256MB。
const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const GENERATION_STAGES = ['reference', 'grid', 'cell', 'trial', 'sample'];
const GENERATION_TIMEOUT_MS = 120000;
const DOWNLOAD_TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------------
// 服务端写真主题白名单（与小程序端 utils/ai-studio-config.js 的 PORTRAIT_THEMES 保持一致，
// desc / sceneHint 用于为网格、分镜、试拍、样张拼装带主题维度的提示词）
// ---------------------------------------------------------------------------
const PORTRAIT_THEMES = [
  {
    themeId: 'guofeng',
    name: '古风写真',
    desc: '汉服加身，园林叠影，一键穿越的水墨意境大片。',
    sceneHint: '汉服、园林长廊、竹林溪水，水墨留白背景，拍出温婉端庄的古风质感'
  },
  {
    themeId: 'sports',
    name: '运动活力',
    desc: '球场街头双场景切换，定格你最飒的动感瞬间。',
    sceneHint: '球场、街头、城市跑道，动感构图配高对比光影，元气氛围直接拉满'
  },
  {
    themeId: 'casual',
    name: '休闲日常',
    desc: '咖啡居家街拍三连，把松弛感日常拍成高光时刻。',
    sceneHint: '咖啡店、居家窗边、街头随拍，自然光加浅景深，轻松拿捏氛围感'
  },
  {
    themeId: 'travel',
    name: '旅拍风光',
    desc: '海边古镇山野任你选，一张照片装下整段旅程。',
    sceneHint: '海边日落、古镇石巷、山野草原，大场景构图配旅行穿搭，出片即封面'
  },
  {
    themeId: 'family',
    name: '亲子合照',
    desc: '从温馨互动到全家福，把陪伴拍成值得收藏的样子。',
    sceneHint: '温馨互动、拥抱对视、全家福站位，柔和暖调光线，幸福感溢出屏幕'
  }
];

// ---------------------------------------------------------------------------
// 内置阶段中文提示词模板
// 内容转译自 docs/系统指令：多角度专业摄影作品集生成器（终极版）.md 的三阶段指令
// ---------------------------------------------------------------------------

// 阶段一：建立【参考图 0】（核心一致性锚点）
const REFERENCE_PROMPT_TEMPLATE = '你是顶级的 AI 电影摄影师和图像生成专家，正在按照严格的三个阶段为客户生成具有绝对一致性的专业摄影作品集。现在执行阶段一：建立核心一致性锚点。请根据用户的描述，生成一张超高清的基准图像，我们称之为【参考图 0】。这张基准图必须明确界定人物的长相与五官特征、发型、身材比例、服装与配饰、主要道具以及核心环境基调，并统一确定整体光影与色彩风格。【参考图 0】是后续所有分镜网格与高清大图生成的绝对基因库：人物的身份特征、服装样式与环境氛围都以此图为唯一标准，后续生成只能复用该锚点，不得另行创造新的人物设定。画面必须达到专业摄影级质感：构图干净、对焦精准、肤质真实细腻、服装材质细节清晰、人物神态自然，严禁出现肢体变形、多人同框或画面元素混乱。';

// 阶段二：生成 3 行 5 列共 15 分镜的摄影预览网格
const GRID_PROMPT_TEMPLATE = '你是顶级的 AI 电影摄影师和图像生成专家，正在执行三阶段流程的阶段二：生成摄影预览网格。请严格基于【参考图 0】的人物、服装与环境基调，生成一张 3 行 5 列共 15 个分镜的完整拼图网格，15 个视角依次为：1 Extreme Close-Up：浅景深眼部或面部极端特写；2 Mid-Shot：非正面中景，交代部分背景；3 Low Angle：低角度仰拍，带环境动态感；4 Over-the-shoulder：越过前景肩膀，焦点在主体；5 Top-Down：正上方俯拍，展现空间关系；6 Left Profile 90°：左侧轮廓，强调光影对比或剪影；7 Right Profile 90°：右侧精致面部特写；8 Bird\'s Eye：远景鸟瞰，人物化为宏大环境中的元素；9 Dutch Tilt：荷兰角倾斜构图，传达张力与动感；10 Low-key：低调暗调，逆光强调氛围与轮廓细节；11 Macro：服饰纹理、首饰、手部等非面部特写；12 Left OTS：左侧视角电影感过肩镜头；13 High-key：强闪光直射，时尚杂志封面感；14 Environmental Wide：电影叙事感情景广角，传达情绪；15 Extreme Low Angle：透过树枝、玻璃等前景拍摄，增加纵深。一致性要求：各分格构图协调、神态自然过渡，与【参考图 0】完全一致；网格内容不得重复，严禁出现克隆人。';

// 阶段三：高清大图模式（复刻预览网格第 {cell} 格）
const CELL_PROMPT_TEMPLATE = '你是顶级的 AI 电影摄影师和图像生成专家，正在执行三阶段流程的阶段三：高清大图模式。请针对阶段二预览网格中的第 {cell} 格，生成一张单张、完整的电影级渲染高清大图。内容要求：精确复制预览网格第 {cell} 格的内容、机位构图与布光，不得改变该分镜已确定的拍摄角度、景别、人物姿态、服装与环境元素。画面升级：增加大量微小细节与真实物理纹理，包括真实的皮肤质感与光影层次、衣物纤维与材质细节，分辨率提升至 4K 以上，并加入细腻的电影胶片颗粒感（Film Grain），使成片比预览网格更加精致逼真。绝对一致性：人物的长相、五官、发型、身材与服装必须与【参考图 0】保持 100% 一致，绝不可出现换人或换衣服的情况。';

// 试拍预览（trial）：主题风格单张试拍，供用户在下单/拍摄前预览主题效果
const TRIAL_PROMPT_TEMPLATE = '你是顶级的 AI 电影摄影师，正在为客户的写真订单生成主题试拍预览。请围绕指定写真主题生成一张单张的高质量风格试拍照片，直观呈现该主题最具代表性的服装造型、场景与光影氛围。画面需达到专业摄影级质感：构图干净、对焦精准、肤质真实细腻、人物神态自然，严禁出现肢体变形、多人同框或画面元素混乱。';

// 样张（sample）：纯主题风格官方展示样片，不掺杂任何订单个人信息
const SAMPLE_PROMPT_TEMPLATE = '你是顶级的 AI 人像摄影师，请为指定写真主题生成一张官方展示样张：画面为单张高品质主题样片，突出该主题最具代表性的服装造型、场景与光影风格，构图完整、细节精致、氛围到位，达到商业样片级质感，严禁出现肢体变形或画面元素混乱。';

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权触发生图');
    }

    const orderId = cleanText(event.orderId, 80);
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    const stage = cleanText(event.stage, 20);
    if (!GENERATION_STAGES.includes(stage)) return fail('VALIDATION_ERROR', '生图阶段无效');

    let cell = null;
    if (stage === 'cell') {
      const parsedCell = Number(event.cell);
      if (!Number.isInteger(parsedCell) || parsedCell < 1 || parsedCell > 15) {
        return fail('VALIDATION_ERROR', '分镜编号无效，应为 1-15 的整数');
      }
      cell = parsedCell;
    }

    const setting = await getImageGenerationSetting();
    if (!setting || setting.provider !== 'openai_compatible' || !setting.apiUrl || !setting.apiKey) {
      return fail('CONFIG_MISSING', '生图接口未配置，请先在管理后台-模型设置中配置 apiUrl 与 apiKey');
    }

    const order = await getOrder(orderId);
    if (!order) return fail('NOT_FOUND', '订单不存在');

    // 主题维度：grid / cell / trial 默认订单第一个主题（可选 themeId 覆盖，须属于该订单）；
    // sample 必带 themeId，只需命中主题白名单（样张与订单主题无关）
    const themeResolution = resolveStageTheme(order, stage, event.themeId);
    if (!themeResolution.ok) return fail(themeResolution.code, themeResolution.message);
    const theme = themeResolution.theme;

    const prompt = buildPrompt(order, stage, cell, theme);
    const requestModel = cleanText(setting.model, 120) || 'cogview-4';
    const imageSize = cleanText(setting.imageSize, 20) || '1024x1024';

    let imageBuffer;
    try {
      imageBuffer = await callImageGeneration({
        apiUrl: setting.apiUrl,
        requestPath: setting.requestPath,
        apiKey: setting.apiKey,
        model: requestModel,
        imageSize,
        prompt
      });
    } catch (error) {
      console.error('generateAIStudioImage provider failed:', error);
      const detail = truncateText(error && error.message ? error.message : String(error), 200);
      return fail('GENERATION_FAILED', `生图接口调用失败：${detail}`);
    }

    const themeSuffix = theme ? `-${theme.themeId}` : '';
    const cloudPath = `ai-studio/${orderId}/generated/${stage}${themeSuffix}${cell !== null ? cell : ''}-${Date.now()}.png`;
    const fileName = stage === 'grid'
      ? 'grid-preview.png'
      : stage === 'reference'
        ? 'reference-0.png'
        : stage === 'trial'
          ? `trial-${theme ? theme.themeId : 'preview'}-${Date.now()}.png`
          : stage === 'sample'
            ? `sample-${theme ? theme.themeId : 'theme'}-${Date.now()}.png`
            : `cell-${cell}.png`;
    const fileType = stage === 'grid' ? 'grid_preview' : stage === 'sample' ? 'sample' : 'generated';

    const uploadResult = await cloud.uploadFile({ cloudPath, fileContent: imageBuffer });
    const fileID = uploadResult.fileID;

    if (stage === 'grid') {
      const replaceWhere = { orderId, fileType: 'grid_preview', status: 'uploaded' };
      if (theme) replaceWhere.themeId = theme.themeId;
      await db.collection('ai_studio_files')
        .where(replaceWhere)
        .update({
          data: {
            status: 'replaced',
            updatedAt: db.serverDate()
          }
        });
    }

    await db.collection('ai_studio_files').add({
      data: {
        orderId,
        _openid: order._openid,
        fileType,
        ...(theme ? { themeId: theme.themeId } : {}),
        fileID,
        fileName,
        size: imageBuffer.length,
        mimeType: 'image/png',
        stage,
        ...(cell !== null ? { cell } : {}),
        status: 'uploaded',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    // trial / sample 不改变订单状态；grid 仍将订单置为待选片，并只重置该主题的选片
    let orderStatus = order.order_status;
    if (stage === 'grid') {
      const updateData = {
        order_status: 'grid_preview',
        grid_preview_uploaded_at: db.serverDate(),
        updatedAt: db.serverDate()
      };
      const themeIndex = theme && Array.isArray(order.themes)
        ? order.themes.findIndex(item => item && item.themeId === theme.themeId)
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
      orderStatus = 'grid_preview';
    }

    await writeAudit(orderId, OPENID, 'generate_ai_image', {
      stage,
      ...(cell !== null ? { cell } : {}),
      ...(theme ? { themeId: theme.themeId } : {}),
      provider: requestModel,
      fileID
    });

    return {
      success: true,
      file: {
        fileID,
        fileType,
        stage,
        ...(cell !== null ? { cell } : {}),
        ...(theme ? { themeId: theme.themeId } : {})
      },
      order: {
        orderId,
        order_status: orderStatus
      }
    };
  } catch (error) {
    console.error('generateAIStudioImage failed:', error);
    return fail('INTERNAL_ERROR', '生成图片失败');
  }
};

// ---------------------------------------------------------------------------
// 主题解析与提示词构建
// ---------------------------------------------------------------------------

function resolveStageTheme(order, stage, themeIdRaw) {
  const themeIdInput = cleanText(themeIdRaw, 40);

  if (order.product_type !== 'portrait') {
    if (themeIdInput) return { ok: false, code: 'VALIDATION_ERROR', message: '主题不属于该订单' };
    return { ok: true, theme: null };
  }

  // 样张：themeId 必填，只需命中主题白名单
  if (stage === 'sample') {
    if (!themeIdInput) {
      return { ok: false, code: 'VALIDATION_ERROR', message: '样张生成必须指定写真主题' };
    }
    const meta = PORTRAIT_THEMES.find(item => item.themeId === themeIdInput);
    if (!meta) return { ok: false, code: 'VALIDATION_ERROR', message: '请选择有效的写真主题' };
    return { ok: true, theme: { themeId: meta.themeId, themeName: meta.name } };
  }

  // reference 阶段不带主题维度（基准图覆盖订单全部主题）
  if (stage === 'reference') {
    return { ok: true, theme: null };
  }

  // grid / cell / trial：默认订单第一个主题，传入 themeId 时必须属于该订单
  const orderThemes = getOrderThemes(order);
  if (!orderThemes.length) {
    if (themeIdInput) return { ok: false, code: 'VALIDATION_ERROR', message: '主题不属于该订单' };
    return { ok: true, theme: null };
  }
  const targetThemeId = themeIdInput || orderThemes[0].themeId;
  const hit = orderThemes.find(item => item.themeId === targetThemeId);
  if (!hit) return { ok: false, code: 'VALIDATION_ERROR', message: '主题不属于该订单' };
  return { ok: true, theme: { themeId: hit.themeId, themeName: hit.themeName } };
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

function buildPrompt(order, stage, cell, theme) {
  if (stage === 'reference') return buildReferencePrompt(order);
  if (stage === 'grid') return joinPrompt(GRID_PROMPT_TEMPLATE, buildThemeSection(theme));
  if (stage === 'cell') return joinPrompt(CELL_PROMPT_TEMPLATE.split('{cell}').join(cell), buildThemeSection(theme));
  if (stage === 'trial') {
    const sceneDesc = cleanText(order.scene_desc, 300);
    return joinPrompt(
      TRIAL_PROMPT_TEMPLATE,
      buildThemeSection(theme),
      sceneDesc ? `用户补充的场景描述：${sceneDesc}。请在保持主题风格一致的前提下，将上述场景融入试拍画面。` : ''
    );
  }
  return joinPrompt(SAMPLE_PROMPT_TEMPLATE, buildThemeSection(theme));
}

function buildThemeSection(theme) {
  if (!theme || !theme.themeId) return '';
  const meta = PORTRAIT_THEMES.find(item => item.themeId === theme.themeId);
  if (!meta) {
    return theme.themeName ? `本次写真主题：${cleanText(theme.themeName, 60)}。` : '';
  }
  const parts = [`本次写真主题：${meta.name}。`];
  if (meta.desc) parts.push(`主题说明：${meta.desc}`);
  if (meta.sceneHint) parts.push(`主题场景提示：${meta.sceneHint}。请将该主题的服装、道具与环境元素自然融入画面。`);
  return parts.join('\n');
}

function buildReferencePrompt(order) {
  const parts = [REFERENCE_PROMPT_TEMPLATE];
  if (order.product_type === 'portrait') {
    const orderThemes = getOrderThemes(order);
    const themeNames = orderThemes.map(item => cleanText(item.themeName, 60)).filter(Boolean);
    const sceneDesc = cleanText(order.scene_desc, 300);
    if (themeNames.length) parts.push(`本次拍摄共 ${themeNames.length} 个主题：${themeNames.join('、')}。`);
    const hints = orderThemes
      .map(item => {
        const meta = PORTRAIT_THEMES.find(t => t.themeId === item.themeId);
        return meta ? `${meta.name}：${meta.sceneHint}` : '';
      })
      .filter(Boolean);
    if (hints.length) parts.push(`各主题场景提示：${hints.join('；')}。【参考图 0】需兼容所有已选主题的服装与场景基调。`);
    if (sceneDesc) parts.push(`用户补充的场景描述：${sceneDesc}。请将以上主题与场景描述融入【参考图 0】的服装、道具与环境基调之中。`);
  } else {
    const styleName = cleanText(order.styleName, 80);
    const backgroundColor = cleanText(order.backgroundColor, 20);
    if (styleName) parts.push(`拍摄风格要求：${styleName}。`);
    if (backgroundColor) parts.push(`照片底色要求：${backgroundColor}。请确保基准图背景呈现为纯净的指定底色。`);
  }
  return parts.filter(Boolean).join('\n');
}

function joinPrompt(...parts) {
  return parts.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// 外部接口调用（OpenAI 兼容生图）
// ---------------------------------------------------------------------------

function buildEndpoint(apiUrl, requestPath) {
  if (!requestPath) return apiUrl;
  const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  const path = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  return base + path;
}

function callImageGeneration({ apiUrl, requestPath, apiKey, model, imageSize, prompt }) {
  return new Promise((resolve, reject) => {
    const endpoint = buildEndpoint(apiUrl, requestPath);
    let parsedUrl;
    try {
      parsedUrl = new URL(endpoint);
    } catch (error) {
      reject(new Error('生图接口地址无效'));
      return;
    }
    if (parsedUrl.protocol !== 'https:') {
      reject(new Error('生图接口地址必须使用 https'));
      return;
    }

    const body = JSON.stringify({
      model: model || 'cogview-4',
      prompt,
      n: 1,
      size: imageSize || '1024x1024'
    });

    const req = https.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'POST',
      timeout: GENERATION_TIMEOUT_MS,
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
          const item = data && Array.isArray(data.data) ? data.data[0] : null;
          if (item && item.url) {
            downloadImage(String(item.url)).then(resolve, reject);
            return;
          }
          if (item && item.b64_json) {
            resolve(Buffer.from(item.b64_json, 'base64'));
            return;
          }
          reject(new Error('provider response shape invalid'));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('生图接口请求超时'));
    });
    req.write(body);
    req.end();
  });
}

function downloadImage(url, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      reject(new Error('生成结果图片地址无效'));
      return;
    }
    if (parsedUrl.protocol !== 'https:') {
      reject(new Error('生成结果图片地址必须使用 https'));
      return;
    }

    const req = https.get({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      timeout: DOWNLOAD_TIMEOUT_MS,
      headers: { 'User-Agent': 'PhotoMuse-AIStudio/1.0' }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        res.resume();
        downloadImage(new URL(res.headers.location, parsedUrl).toString(), maxRedirects - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        reject(new Error(`下载生成图片失败 status ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => { chunks.push(chunk); });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('下载生成图片超时'));
    });
  });
}

// ---------------------------------------------------------------------------
// 数据访问与工具
// ---------------------------------------------------------------------------

async function getImageGenerationSetting() {
  const result = await db.collection('ai_studio_model_settings')
    .where({ scene: 'image_generation', enabled: true })
    .limit(1)
    .get();
  return result.data && result.data[0];
}

async function getOrder(orderId) {
  const result = await db.collection('ai_studio_orders').where({ orderId }).limit(1).get();
  return result.data && result.data[0];
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

function truncateText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
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
