// 部署说明：本函数会同步调用外部 OpenAI 兼容生图接口，生图耗时较长（常见 30-90 秒）。
// 部署时必须将本云函数的超时时间设置为 120 秒（在微信开发者工具/云开发控制台中调整，
// 或在本函数目录 config.json 中配置 { "timeout": 120 }），内存建议不低于 256MB。
// idphoto 阶段会串行调用自部署 HivisionIDPhotos 引擎（抠图 / 加底色 / 排版照，每步上限 90 秒），
// 建议将超时进一步上调（如 300 秒）以覆盖最坏情况。
const cloud = require('wx-server-sdk');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// idphoto 为证件照成品专用阶段（standard 订单 + 自部署 HivisionIDPhotos 引擎），配置与生图接口相互独立
const GENERATION_STAGES = ['reference', 'grid', 'cell', 'trial', 'sample', 'idphoto'];
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
// 影楼质感条款吸收自 photodesign-skill（器材参数语言）与 rembrandt-portrait-lighting
// （光比/明暗建模）方法论，措辞经真实生图回归验证（scripts/gen-family-series.js）
// ---------------------------------------------------------------------------

// 影楼质感共通段：全部阶段模板共用（家庭系列样张实测有效的措辞）
// 要点：① 布光只写"画面里的光效结果"，绝不提灯具/影棚等场景词，否则生成图会把柔光箱拍进画面
//       ② 商业精修质感保留真实皮肤纹理，禁止塑料磨皮
//       ③ 中画幅人像镜头语言营造浅景深专业感
const STUDIO_QUALITY_CLAUSE = '影楼成片质感要求：这是一张专业影楼级精修人像成片，画面中只有被拍摄的人物本身与其所处环境，绝不出现灯具、灯架、柔光箱、反光板、摄影师等任何摄影器材或工作人员。人物布光专业立体：主光方向明确统一，面部一侧受光充分、另一侧自然过渡到柔和阴影（伦勃朗式明暗层次），发丝有柔和的轮廓光，眼神光明亮有神，人物与背景/环境有自然的光影分离。使用中画幅相机与人像镜头的成像语言：85mm 浅景深，背景自然柔化、层次干净。商业精修级后期的质感：肤色均匀透亮但保留真实的皮肤纹理与细节，服装材质纹理清晰，整体色调统一高级，达到杂志封面级的商业人像水准。';

// 表情因果链（吸收南鸢 Skill）：神态必须由画面事件触发，禁止空洞摆拍
const EXPRESSION_CAUSAL_CLAUSE = '人物神态要求：每个画面中人物的表情由该画面的具体情境自然触发（如微风拂动发丝、手中道具的互动、回眸瞬间、与环境的真实交流），眼神有内容、嘴角有情绪来由，禁止无来由的空洞摆拍微笑或呆滞直视镜头。';

// 阶段一：建立【参考图 0】（核心一致性锚点）
const REFERENCE_PROMPT_TEMPLATE = '你是顶级的 AI 电影摄影师和图像生成专家，正在按照严格的三个阶段为客户生成具有绝对一致性的专业摄影作品集。现在执行阶段一：建立核心一致性锚点。请根据用户的描述，生成一张超高清的基准图像，我们称之为【参考图 0】。这张基准图必须明确界定人物的长相与五官特征、发型、身材比例、服装与配饰、主要道具以及核心环境基调，并统一确定整体光影与色彩风格：主光方向、明暗基调、背景光层次一经确定即为全组标准，后续所有分镜沿用。【参考图 0】是后续所有分镜网格与高清大图生成的绝对基因库：人物的身份特征、服装样式与环境氛围都以此图为唯一标准，后续生成只能复用该锚点，不得另行创造新的人物设定。' + STUDIO_QUALITY_CLAUSE + EXPRESSION_CAUSAL_CLAUSE + '严禁出现肢体变形、多人同框或画面元素混乱。';

// 阶段二：生成 3 行 5 列共 15 分镜的摄影预览网格
const GRID_PROMPT_TEMPLATE = '你是顶级的 AI 电影摄影师和图像生成专家，正在执行三阶段流程的阶段二：生成摄影预览网格。请严格基于【参考图 0】的人物、服装与环境基调，生成一张 3 行 5 列共 15 个分镜的完整拼图网格，15 个视角依次为：1 Extreme Close-Up：浅景深眼部或面部极端特写；2 Mid-Shot：非正面中景，交代部分背景；3 Low Angle：低角度仰拍，带环境动态感；4 Over-the-shoulder：越过前景肩膀，焦点在主体；5 Top-Down：正上方俯拍，展现空间关系；6 Left Profile 90°：左侧轮廓，强调光影对比或剪影；7 Right Profile 90°：右侧精致面部特写；8 Bird\'s Eye：远景鸟瞰，人物化为宏大环境中的元素；9 Dutch Tilt：荷兰角倾斜构图，传达张力与动感；10 Low-key：低调暗调，逆光强调氛围与轮廓细节；11 Macro：服饰纹理、首饰、手部等非面部特写；12 Left OTS：左侧视角电影感过肩镜头；13 High-key：强闪光直射，时尚杂志封面感；14 Environmental Wide：电影叙事感情景广角，传达情绪；15 Extreme Low Angle：透过树枝、玻璃等前景拍摄，增加纵深。一致性要求：各分格构图协调、神态自然过渡，与【参考图 0】完全一致；全组 15 个分镜共享【参考图 0】确定的同一光源方向、影调与色彩体系，机位与景别变化时光效关系保持不变，形成成套的系列感；网格内容不得重复，严禁出现克隆人。' + EXPRESSION_CAUSAL_CLAUSE;

// 阶段三：高清大图模式（复刻预览网格第 {cell} 格）
// 光照拓扑条款（吸收南鸢 Skill）：机位变化不能带着光源旋转，防止高清化后光影漂移
const CELL_PROMPT_TEMPLATE = '你是顶级的 AI 电影摄影师和图像生成专家，正在执行三阶段流程的阶段三：高清大图模式。请针对阶段二预览网格中的第 {cell} 格，生成一张单张、完整的电影级渲染高清大图。内容要求：精确复制预览网格第 {cell} 格的内容、机位构图与布光，不得改变该分镜已确定的拍摄角度、景别、人物姿态、服装与环境元素。光照一致性：保持与预览格完全相同的光源方向、明暗关系与背景光层次——光源固定在世界坐标中，高清化只提升细节分辨率，不得擅自改变光效方向、阴影位置或色调，眼神光方向、面部亮暗侧、发丝轮廓光方位必须与预览格一一对应。画面升级：增加大量微小细节与真实物理纹理，包括真实的皮肤质感与光影层次、衣物纤维与材质细节，分辨率提升至 4K 以上，成片保持干净的商业数码质感（不添加胶片颗粒或噪点），使成片比预览网格更加精致逼真。绝对一致性：人物的长相、五官、发型、身材与服装必须与【参考图 0】保持 100% 一致，绝不可出现换人或换衣服的情况。' + STUDIO_QUALITY_CLAUSE;

// 试拍预览（trial）：主题风格单张试拍，供用户在下单/拍摄前预览主题效果
const TRIAL_PROMPT_TEMPLATE = '你是顶级的 AI 电影摄影师，正在为客户的写真订单生成主题试拍预览。请围绕指定写真主题生成一张单张的高质量风格试拍照片，直观呈现该主题最具代表性的服装造型、场景与光影氛围。' + STUDIO_QUALITY_CLAUSE + EXPRESSION_CAUSAL_CLAUSE + '严禁出现肢体变形、多人同框或画面元素混乱。';

// 样张（sample）：纯主题风格官方展示样片，不掺杂任何订单个人信息
const SAMPLE_PROMPT_TEMPLATE = '你是顶级的 AI 人像摄影师，请为指定写真主题生成一张官方展示样张：画面为单张高品质主题样片，突出该主题最具代表性的服装造型、场景与光影风格，构图完整、细节精致、氛围到位。' + STUDIO_QUALITY_CLAUSE + EXPRESSION_CAUSAL_CLAUSE + '严禁出现肢体变形或画面元素混乱。';

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

    // 证件照成品：standard 订单专用，走自部署 HivisionIDPhotos 引擎，与生图配置可并存互不影响
    if (stage === 'idphoto') {
      return generateIdPhoto(orderId, OPENID);
    }

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
      imageBuffer = await callImageGenerationWithRetry({
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

// 瞬态错误退避重试：生图站高峰期队列满（503/429）很常见，直接失败会伤订单。
// 只对"快速返回"的服务端瞬态错误重试；连接拒绝/参数错误/慢超时不重试（重试无意义或时间不够）。
const RETRYABLE_ERROR_PATTERN = /provider status (429|500|502|503|504)|queue is full|ECONNRESET|socket hang up/i;
const RETRY_DELAYS_MS = [3000, 6000, 10000];
const RETRY_TIME_BUDGET_MS = 40000; // 已耗时超过此值则放弃重试，避免撞云函数总超时

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function callImageGenerationWithRetry(options) {
  const startedAt = Date.now();
  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callImageGeneration(options);
    } catch (error) {
      lastError = error;
      const message = error && error.message ? String(error.message) : String(error);
      const retryable = RETRYABLE_ERROR_PATTERN.test(message);
      const canRetry = retryable
        && attempt < RETRY_DELAYS_MS.length
        && (Date.now() - startedAt) < RETRY_TIME_BUDGET_MS;
      if (!canRetry) { throw error; }
      console.error(`generateAIStudioImage transient failure (attempt ${attempt + 1}), retrying in ${RETRY_DELAYS_MS[attempt]}ms:`, message);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

function callImageGeneration({ apiUrl, requestPath, apiKey, model, imageSize, prompt }) {  return new Promise((resolve, reject) => {
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
// 证件照引擎（HivisionIDPhotos 自部署服务，允许 http 内网/自有服务器地址）
// ---------------------------------------------------------------------------

const ID_PHOTO_TIMEOUT_MS = 90000;

// 证件照规格（px @300DPI），与小程序端配置保持同值
const ID_PHOTO_SPECS = {
  '一寸': { width: 295, height: 413 },
  '小一寸': { width: 260, height: 378 },
  '二寸': { width: 413, height: 579 },
  '小二寸': { width: 390, height: 567 },
  '五寸': { width: 1050, height: 1500 },
  '六寸': { width: 1200, height: 1800 }
};

// 证件照底色（HEX，不带 #），与小程序端配置保持同值
const BACKGROUND_COLORS = {
  '白底': 'FFFFFF',
  '蓝底': '438EDB',
  '红底': 'DE2910',
  '灰底': '535A60',
  '深蓝底': '1C4F9C'
};

async function generateIdPhoto(orderId, actorOpenid) {
  // 先做订单校验（不依赖引擎配置）：portrait 订单即使未配引擎也应得到明确的类型错误
  const order = await getOrder(orderId);
  if (!order) return fail('NOT_FOUND', '订单不存在');
  if (order.product_type !== 'standard') {
    return fail('VALIDATION_ERROR', '该订单不是证件照订单（AI 写真订单请使用生图接口）');
  }

  // 证件照引擎配置独立于生图接口：ai_studio_model_settings scene='idphoto_engine'
  const setting = await getIdPhotoEngineSetting();
  if (!setting || !setting.apiUrl) {
    return fail('CONFIG_MISSING', '证件照引擎未配置，请在管理后台-模型设置中配置证件照引擎地址（HivisionIDPhotos 服务地址，如 http://ip:8080）');
  }

  const photo = await getLatestCustomerPhoto(orderId);
  if (!photo) return fail('VALIDATION_ERROR', '订单没有可用的客户照片');

  let sourceBuffer;
  try {
    const download = await cloud.downloadFile({ fileID: photo.fileID });
    sourceBuffer = download.fileContent;
  } catch (error) {
    console.error('generateAIStudioImage download customer photo failed:', error);
    return fail('GENERATION_FAILED', '证件照生成失败（读取客户照片）');
  }
  if (!sourceBuffer || !sourceBuffer.length) {
    return fail('GENERATION_FAILED', '证件照生成失败（客户照片内容为空）');
  }

  const specName = cleanText(order.spec, 40);
  const specHit = ID_PHOTO_SPECS[specName];
  const spec = specHit ? { name: specName, ...specHit } : { name: '一寸', ...ID_PHOTO_SPECS['一寸'] };

  const backgroundName = cleanText(order.backgroundColor, 20);
  const backgroundHex = BACKGROUND_COLORS[backgroundName] || BACKGROUND_COLORS['白底'];

  // 第一步：/idphoto 人像抠图并按规格裁切，产出透明底高清 PNG
  let matting;
  try {
    matting = await callHivisionEngine(setting.apiUrl, '/idphoto', {
      fileBuffer: sourceBuffer,
      fileContentType: detectImageMime(sourceBuffer),
      fields: {
        height: String(spec.height),
        width: String(spec.width),
        hd: 'true',
        dpi: '300',
        face_alignment: 'true',
        human_matting_model: 'modnet_photographic_portrait_matting',
        face_detect_model: 'mtcnn'
      }
    });
  } catch (error) {
    const detail = truncateText(error && error.message ? error.message : String(error), 200);
    return fail('GENERATION_FAILED', `证件照生成失败（抠图阶段）：${detail}`);
  }
  if (!matting || matting.status !== true || !matting.image_base64_hd) {
    return fail('GENERATION_FAILED', '证件照生成失败（抠图阶段）：引擎返回结果无效');
  }

  // 第二步：/add_background 为透明底 PNG 叠加指定底色，得到成品
  let composited;
  try {
    composited = await callHivisionEngine(setting.apiUrl, '/add_background', {
      fileBuffer: Buffer.from(matting.image_base64_hd, 'base64'),
      fileContentType: 'image/png',
      fields: {
        color: backgroundHex,
        kb: '200',
        render: '0',
        dpi: '300'
      }
    });
  } catch (error) {
    const detail = truncateText(error && error.message ? error.message : String(error), 200);
    return fail('GENERATION_FAILED', `证件照生成失败（底色合成阶段）：${detail}`);
  }
  if (!composited || composited.status !== true || !composited.image_base64) {
    return fail('GENERATION_FAILED', '证件照生成失败（底色合成阶段）：引擎返回结果无效');
  }

  const photoBuffer = Buffer.from(composited.image_base64, 'base64');

  const uploadResult = await cloud.uploadFile({
    cloudPath: `ai-studio/${orderId}/generated/idphoto-${Date.now()}.jpg`,
    fileContent: photoBuffer
  });
  const fileID = uploadResult.fileID;

  await db.collection('ai_studio_files').add({
    data: {
      orderId,
      _openid: order._openid,
      fileType: 'generated',
      fileID,
      fileName: 'idphoto.jpg',
      size: photoBuffer.length,
      mimeType: 'image/jpeg',
      stage: 'idphoto',
      status: 'uploaded',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });

  // 第三步：/generate_layout_photos 排版照（附赠产物，失败不阻断，成品已生成成功）
  const layoutFileID = await generateLayoutPhoto({
    apiUrl: setting.apiUrl,
    orderId,
    openid: order._openid,
    spec,
    photoBuffer
  });

  await writeAudit(orderId, actorOpenid, 'generate_ai_image', {
    stage: 'idphoto',
    spec: spec.name,
    backgroundColor: backgroundHex,
    engine: 'hivision',
    fileID
  });

  // 不改订单状态：管理员预览成品后走现有交付流程
  return {
    success: true,
    file: {
      fileID,
      fileType: 'generated',
      stage: 'idphoto'
    },
    layout: layoutFileID ? { fileID: layoutFileID } : null,
    order: {
      orderId,
      order_status: order.order_status
    }
  };
}

async function generateLayoutPhoto({ apiUrl, orderId, openid, spec, photoBuffer }) {
  try {
    const layout = await callHivisionEngine(apiUrl, '/generate_layout_photos', {
      fileBuffer: photoBuffer,
      fileContentType: 'image/jpeg',
      fields: {
        height: String(spec.height),
        width: String(spec.width),
        kb: '200',
        dpi: '300'
      }
    });
    if (!layout || layout.status !== true || !layout.image_base64) return null;

    const layoutBuffer = Buffer.from(layout.image_base64, 'base64');
    const uploadResult = await cloud.uploadFile({
      cloudPath: `ai-studio/${orderId}/generated/layout-${Date.now()}.jpg`,
      fileContent: layoutBuffer
    });
    await db.collection('ai_studio_files').add({
      data: {
        orderId,
        _openid: openid,
        fileType: 'generated',
        fileID: uploadResult.fileID,
        fileName: 'layout.jpg',
        size: layoutBuffer.length,
        mimeType: 'image/jpeg',
        stage: 'layout',
        status: 'uploaded',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    return uploadResult.fileID;
  } catch (error) {
    console.error('generateAIStudioImage layout photo failed (ignored):', error);
    return null;
  }
}

// 调用 HivisionIDPhotos 接口：按 URL 协议选择 http/https（自部署引擎允许 http），每步超时 90 秒
function callHivisionEngine(apiUrl, enginePath, { fileBuffer, fileContentType, fields }) {
  return new Promise((resolve, reject) => {
    const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    let parsedUrl;
    try {
      parsedUrl = new URL(base + enginePath);
    } catch (error) {
      reject(new Error('证件照引擎地址无效'));
      return;
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      reject(new Error('证件照引擎地址必须使用 http 或 https'));
      return;
    }

    const form = buildMultipartFormData({ fileBuffer, fileContentType, fields });
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const req = transport.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'POST',
      timeout: ID_PHOTO_TIMEOUT_MS,
      headers: {
        'Content-Type': form.contentType,
        'Content-Length': form.body.length
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`engine status ${res.statusCode}: ${raw.slice(0, 300)}`));
            return;
          }
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('证件照引擎请求超时'));
    });
    req.write(form.body);
    req.end();
  });
}

// 纯 Node 手写 multipart/form-data：boundary 随机 hex，文件字段固定为 input_image
function buildMultipartFormData({ fileBuffer, fileContentType, fields }) {
  const boundary = `----PhotoMuseBoundary${crypto.randomBytes(16).toString('hex')}`;
  const sections = [];
  Object.keys(fields || {}).forEach(name => {
    sections.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${fields[name]}\r\n`);
  });
  const isPng = fileContentType === 'image/png';
  sections.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="input_image"; filename="${isPng ? 'input.png' : 'input.jpg'}"\r\nContent-Type: ${fileContentType}\r\n\r\n`
  );
  const header = Buffer.from(sections.join(''), 'utf8');
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return {
    body: Buffer.concat([header, fileBuffer, footer]),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

function detectImageMime(buffer) {
  if (buffer && buffer.length > 3 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  return 'image/jpeg';
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

async function getIdPhotoEngineSetting() {
  const result = await db.collection('ai_studio_model_settings')
    .where({ scene: 'idphoto_engine', enabled: true })
    .limit(1)
    .get();
  return result.data && result.data[0];
}

async function getLatestCustomerPhoto(orderId) {
  const result = await db.collection('ai_studio_files')
    .where({ orderId, fileType: 'customer_photo', status: 'uploaded' })
    .orderBy('createdAt', 'desc')
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
