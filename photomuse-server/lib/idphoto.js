/* ============================================================
 * 浅焦映像 · 证件照引擎客户端（自部署 HivisionIDPhotos）
 *
 * 与旧云函数 `generateAIStudioImage` 的 idphoto 阶段逐字段对齐：
 *   POST {apiUrl}/idphoto                 人像抠图 + 按规格裁切 → 透明底高清 PNG
 *   POST {apiUrl}/add_background          叠加指定底色 → 成品
 *   POST {apiUrl}/generate_layout_photos  排版照（附赠产物，失败不阻断）
 *
 * 约定：文件字段固定为 `input_image`；每步超时 90 秒；自部署允许 http 内网地址。
 * 规格与底色与小程序 utils/ai-studio-config.js 同值（改一处必须同步另一处）。
 * ============================================================ */
'use strict';

const ENGINE_TIMEOUT_MS = 90000;

/* 证件照规格（px @300DPI），与小程序 ID_PHOTO_SPECS 的 widthPx/heightPx 同值 */
const ID_PHOTO_SPECS = {
  '一寸': { width: 295, height: 413 },
  '小一寸': { width: 260, height: 378 },
  '二寸': { width: 413, height: 579 },
  '小二寸': { width: 390, height: 567 },
  '五寸': { width: 1050, height: 1500 },
  '六寸': { width: 1200, height: 1800 }
};

/* 证件照底色（HEX，不带 #），与小程序 BACKGROUND_COLORS 同值 */
const BACKGROUND_COLORS = {
  '白底': 'FFFFFF',
  '蓝底': '438EDB',
  '红底': 'DE2910',
  '灰底': '535A60',
  '深蓝底': '1C4F9C'
};

const DEFAULT_SPEC_NAME = '一寸';
const DEFAULT_BACKGROUND_NAME = '白底';

/* 规格名容错：未命中一律回落到一寸（与旧实现一致，不报错阻断） */
function normalizeSpec(name) {
  const key = String(name == null ? '' : name).trim();
  const hit = ID_PHOTO_SPECS[key];
  return hit ? { name: key, width: hit.width, height: hit.height }
    : { name: DEFAULT_SPEC_NAME, ...ID_PHOTO_SPECS[DEFAULT_SPEC_NAME] };
}

/* 底色容错：支持传中文名（蓝底）或直接传 HEX（438EDB）；都未命中回落白底 */
function normalizeBackground(value) {
  const key = String(value == null ? '' : value).trim();
  if (BACKGROUND_COLORS[key]) return { name: key, hex: BACKGROUND_COLORS[key] };
  const upper = key.replace(/^#/, '').toUpperCase();
  const byHex = Object.keys(BACKGROUND_COLORS).find(k => BACKGROUND_COLORS[k] === upper);
  if (byHex) return { name: byHex, hex: upper };
  /* 兼容 STYLES 里的中文色名（白色/蓝色/深灰色…） */
  const alias = { '白色': '白底', '蓝色': '蓝底', '红色': '红底', '灰色': '灰底', '深灰色': '灰底', '深蓝色': '深蓝底' };
  const mapped = alias[key];
  if (mapped) return { name: mapped, hex: BACKGROUND_COLORS[mapped] };
  return { name: DEFAULT_BACKGROUND_NAME, hex: BACKGROUND_COLORS[DEFAULT_BACKGROUND_NAME] };
}

/* 按魔数判断客户照片类型（不信任文件名后缀） */
function detectImageMime(buf) {
  if (buf && buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  return 'image/jpeg';
}

/* 调用引擎：multipart/form-data，文件字段固定 input_image */
async function callEngine(apiUrl, endpoint, { fileBuffer, contentType, fields }) {
  const base = String(apiUrl || '').trim().replace(/\/+$/, '');
  let parsed;
  try {
    parsed = new URL(base + endpoint);
  } catch (e) {
    throw new Error('证件照引擎地址无效');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('证件照引擎地址必须使用 http 或 https');
  }

  const form = new FormData();
  Object.keys(fields || {}).forEach(name => form.append(name, String(fields[name])));
  const mime = contentType || 'image/jpeg';
  form.append('input_image', new Blob([fileBuffer], { type: mime }), mime === 'image/png' ? 'input.png' : 'input.jpg');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(parsed, { method: 'POST', body: form, signal: controller.signal });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('证件照引擎请求超时（90 秒）');
    throw new Error('证件照引擎连接失败：' + (e && e.message ? e.message : String(e)));
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  if (!res.ok) throw new Error(`engine status ${res.status}: ${raw.slice(0, 300)}`);
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('证件照引擎返回内容不是 JSON：' + raw.slice(0, 200));
  }
}

/* 第一步：抠图 + 按规格裁切 → 透明底高清 PNG */
async function matting(apiUrl, sourceBuffer, spec, options) {
  const opts = options || {};
  const r = await callEngine(apiUrl, '/idphoto', {
    fileBuffer: sourceBuffer,
    contentType: detectImageMime(sourceBuffer),
    fields: {
      height: String(spec.height),
      width: String(spec.width),
      hd: 'true',
      dpi: '300',
      face_alignment: opts.faceAlignment === false ? 'false' : 'true',
      human_matting_model: 'modnet_photographic_portrait_matting',
      face_detect_model: 'mtcnn'
    }
  });
  if (!r || r.status !== true || !r.image_base64_hd) throw new Error('抠图阶段引擎返回结果无效');
  return Buffer.from(r.image_base64_hd, 'base64');
}

/* 第二步：为透明底 PNG 叠加底色 → 成品 JPEG */
async function addBackground(apiUrl, mattingBuffer, backgroundHex) {
  const r = await callEngine(apiUrl, '/add_background', {
    fileBuffer: mattingBuffer,
    contentType: 'image/png',
    fields: {
      color: String(backgroundHex || '').replace(/^#/, '').toUpperCase(),
      kb: '200',
      render: '0',
      dpi: '300'
    }
  });
  if (!r || r.status !== true || !r.image_base64) throw new Error('底色合成阶段引擎返回结果无效');
  return Buffer.from(r.image_base64, 'base64');
}

/* 第三步：排版照（附赠产物；失败返回 null，绝不阻断主流程） */
async function layoutPhoto(apiUrl, photoBuffer, spec) {
  try {
    const r = await callEngine(apiUrl, '/generate_layout_photos', {
      fileBuffer: photoBuffer,
      contentType: 'image/jpeg',
      fields: {
        height: String(spec.height),
        width: String(spec.width),
        kb: '200',
        dpi: '300'
      }
    });
    if (!r || r.status !== true || !r.image_base64) return null;
    return Buffer.from(r.image_base64, 'base64');
  } catch (e) {
    console.error('[idphoto] 排版照生成失败（已忽略）:', e && e.message);
    return null;
  }
}

module.exports = {
  ENGINE_TIMEOUT_MS,
  ID_PHOTO_SPECS,
  BACKGROUND_COLORS,
  normalizeSpec,
  normalizeBackground,
  detectImageMime,
  matting,
  addBackground,
  layoutPhoto
};
