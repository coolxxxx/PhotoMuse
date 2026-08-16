const cloud = require('wx-server-sdk');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const MM_PER_INCH = 25.4;
const JPEG_QUALITY = 95;

const DEFAULT_MERCH = [
  {
    merchId: 'wall_8',
    name: '挂墙主视觉·8寸实木框',
    category: 'wall',
    desc: '进口实木框搭配高清微喷，进门第一眼就是写真馆质感',
    price: 49,
    imageRatio: '4:5',
    printSpec: { widthMM: 203, heightMM: 254, dpi: 300, bleedMM: 3 },
    sortOrder: 1
  },
  {
    merchId: 'wall_12',
    name: '挂墙主视觉·12寸大画幅',
    category: 'wall',
    desc: '12 寸大画幅细节数倍放大，撑起整面墙的高光主视觉',
    price: 79,
    imageRatio: '5:6',
    printSpec: { widthMM: 254, heightMM: 305, dpi: 300, bleedMM: 3 },
    sortOrder: 2
  },
  {
    merchId: 'desk_5',
    name: '水晶摆台·5寸',
    category: 'desk',
    desc: '高透水晶面板摆台，随手一放就是工位治愈角',
    price: 29,
    imageRatio: '5:7',
    printSpec: { widthMM: 127, heightMM: 178, dpi: 300, bleedMM: 3 },
    sortOrder: 3
  },
  {
    merchId: 'calendar',
    name: '定制挂历·13页',
    category: 'calendar',
    desc: '13 页月历编排，一年十二个月天天有你的高光',
    price: 39,
    imageRatio: '1:1.41',
    printSpec: { widthMM: 210, heightMM: 297, dpi: 300, bleedMM: 3 },
    sortOrder: 4
  },
  {
    merchId: 'wallet',
    name: '钱包照套装·6张',
    category: 'wallet',
    desc: '6 张随身卡位尺寸，把最喜欢的瞬间放进口袋',
    price: 9.9,
    imageRatio: '4:3',
    printSpec: { widthMM: 89, heightMM: 64, dpi: 300, bleedMM: 3 },
    sortOrder: 5
  },
  {
    merchId: 'pendant',
    name: '亚克力挂件·圆形5cm×2个',
    category: 'pendant',
    desc: '圆形亚克力挂件一对，挂包挂钥匙都好看',
    price: 19,
    imageRatio: '1:1',
    printSpec: { widthMM: 50, heightMM: 50, dpi: 300, bleedMM: 3 },
    sortOrder: 6
  },
  {
    merchId: 'album',
    name: '精装相册·10P 方形',
    category: 'album',
    desc: '方形精装 10P 翻页即影集，自留送礼两相宜',
    price: 69,
    imageRatio: '1:1',
    printSpec: { widthMM: 254, heightMM: 254, dpi: 300, bleedMM: 3 },
    sortOrder: 7
  }
];

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权导出印刷制作稿');
    }

    const orderId = cleanText(event.orderId, 80);
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    let fileID = cleanText(event.fileID, 300);
    let merchId = cleanText(event.merchId, 64);
    const merchItemId = cleanText(event.merchItemId, 80);

    const order = await getOrder(orderId);
    if (!order) return fail('NOT_FOUND', '订单不存在');

    if ((!fileID || !merchId) && merchItemId) {
      const matched = (Array.isArray(order.merch_items) ? order.merch_items : [])
        .find(item => item && item.merchItemId === merchItemId);
      if (matched) {
        if (!fileID) fileID = cleanText(matched.fileID, 300);
        if (!merchId) merchId = cleanText(matched.merchId, 64);
      }
    }

    if (!fileID || !fileID.startsWith('cloud://')) {
      return fail('VALIDATION_ERROR', '成片文件参数无效');
    }
    if (!merchId) return fail('VALIDATION_ERROR', '周边商品参数无效');

    const merch = await findMerch(merchId);
    if (!merch || !merch.printSpec || !merch.printSpec.widthMM || !merch.printSpec.heightMM) {
      return fail('NOT_FOUND', '周边商品不存在');
    }

    const spec = merch.printSpec;
    const dpi = spec.dpi || 300;
    const bleedMM = spec.bleedMM || 0;
    const targetW = Math.round(((spec.widthMM + 2 * bleedMM) / MM_PER_INCH) * dpi);
    const targetH = Math.round(((spec.heightMM + 2 * bleedMM) / MM_PER_INCH) * dpi);
    if (targetW < 1 || targetH < 1) {
      return fail('VALIDATION_ERROR', '印刷尺寸参数无效');
    }

    let fileBuffer;
    try {
      const downloadResult = await cloud.downloadFile({ fileID });
      fileBuffer = downloadResult && downloadResult.fileContent;
    } catch (error) {
      console.error('downloadFile failed:', error);
    }
    if (!fileBuffer || !fileBuffer.length) {
      return fail('DOWNLOAD_FAIL', '成片文件下载失败');
    }

    let decoded;
    try {
      decoded = decodeImage(fileBuffer);
    } catch (error) {
      console.error('decodeImage failed:', error);
      decoded = null;
    }
    if (!decoded || !decoded.width || !decoded.height || !decoded.data) {
      return fail('DECODE_FAIL', '图片解码失败（仅支持 jpg/png）');
    }

    const resized = bilinearResample(decoded, targetW, targetH);
    const encoded = jpeg.encode(
      { data: resized, width: targetW, height: targetH },
      JPEG_QUALITY
    );
    const printBuffer = encoded.data;
    const stamp = Date.now();

    const printUpload = await cloud.uploadFile({
      cloudPath: `ai-studio/${orderId}/print/${merchId}-${stamp}.jpg`,
      fileContent: printBuffer
    });
    const printFileID = printUpload.fileID;

    await db.collection('ai_studio_files').add({
      data: {
        orderId,
        _openid: order._openid,
        fileType: 'print',
        fileID: printFileID,
        fileName: `${merchId}-${stamp}.jpg`,
        size: printBuffer.length,
        mimeType: 'image/jpeg',
        status: 'uploaded',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    const ticket = {
      orderId,
      merchId,
      merchName: merch.name,
      printSpec: spec,
      targetPixels: { w: targetW, h: targetH },
      sourceFileID: fileID,
      colorSpace: 'sRGB IEC61966-2.1',
      note: '全流程 sRGB；打印请使用 sRGB 配置文件并先做首件打样比对；已含出血，裁切线由印厂按 bleedMM 预留',
      exportedAt: new Date().toISOString()
    };
    const ticketBuffer = Buffer.from(JSON.stringify(ticket, null, 2), 'utf-8');

    const ticketUpload = await cloud.uploadFile({
      cloudPath: `ai-studio/${orderId}/print/ticket-${merchId}-${stamp}.json`,
      fileContent: ticketBuffer
    });
    const ticketFileID = ticketUpload.fileID;

    await db.collection('ai_studio_files').add({
      data: {
        orderId,
        _openid: order._openid,
        fileType: 'print_ticket',
        fileID: ticketFileID,
        fileName: `ticket-${merchId}-${stamp}.json`,
        size: ticketBuffer.length,
        mimeType: 'application/json',
        status: 'uploaded',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await writeAudit(orderId, OPENID, 'export_print_file', {
      merchId,
      sourceFileID: fileID,
      printFileID,
      ticketFileID,
      targetPixels: { w: targetW, h: targetH }
    });

    return {
      success: true,
      print: {
        fileID: printFileID,
        ticketFileID,
        targetPixels: { w: targetW, h: targetH }
      }
    };
  } catch (error) {
    console.error('exportAIStudioPrintFile failed:', error);
    return fail('INTERNAL_ERROR', '导出印刷制作稿失败');
  }
};

function decodeImage(buffer) {
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const image = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
    const data = image.data instanceof Uint8Array ? image.data : new Uint8Array(image.data);
    return { width: image.width, height: image.height, data };
  }
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    const png = PNG.sync.read(buffer);
    const data = png.data instanceof Uint8Array ? png.data : new Uint8Array(png.data);
    return { width: png.width, height: png.height, data };
  }
  throw new Error('unsupported image format');
}

function bilinearResample(source, targetW, targetH) {
  const srcW = source.width;
  const srcH = source.height;
  const src = source.data;
  const out = new Uint8Array(targetW * targetH * 4);

  for (let y = 0; y < targetH; y += 1) {
    const srcY = ((y + 0.5) * srcH) / targetH - 0.5;
    const y0 = Math.max(0, Math.floor(srcY));
    const y1 = Math.min(srcH - 1, y0 + 1);
    const fy = Math.max(0, Math.min(1, srcY - y0));

    for (let x = 0; x < targetW; x += 1) {
      const srcX = ((x + 0.5) * srcW) / targetW - 0.5;
      const x0 = Math.max(0, Math.floor(srcX));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const fx = Math.max(0, Math.min(1, srcX - x0));

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;
      const o = (y * targetW + x) * 4;

      for (let c = 0; c < 4; c += 1) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * fx;
        const bottom = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * fx;
        out[o + c] = Math.max(0, Math.min(255, Math.round(top + (bottom - top) * fy)));
      }
    }
  }

  return out;
}

async function getOrder(orderId) {
  const result = await db.collection('ai_studio_orders').where({ orderId }).limit(1).get();
  return result.data && result.data[0];
}

async function findMerch(merchId) {
  try {
    const result = await db.collection('ai_studio_merchandise')
      .where({ merchId, enabled: true })
      .limit(1)
      .get();
    const doc = result.data && result.data[0];
    if (doc) return toMerchSnapshot(doc);

    try {
      const byId = await db.collection('ai_studio_merchandise').doc(merchId).get();
      const docById = byId && byId.data;
      if (docById && docById.enabled !== false) return toMerchSnapshot(docById);
    } catch (error) {
      // 以 merchId 为 _id 的文档不存在，继续走内置兜底
    }
  } catch (error) {
    console.error('findMerch failed:', error);
  }
  return DEFAULT_MERCH.find(item => item.merchId === merchId) || null;
}

function toMerchSnapshot(doc) {
  const spec = doc.printSpec || {};
  return {
    merchId: cleanText(doc.merchId || doc._id, 64),
    name: cleanText(doc.name, 60),
    category: cleanText(doc.category, 32),
    desc: cleanText(doc.desc, 120),
    price: normalizeNumber(doc.price),
    imageRatio: cleanText(doc.imageRatio, 16),
    printSpec: {
      widthMM: normalizeNumber(spec.widthMM),
      heightMM: normalizeNumber(spec.heightMM),
      dpi: normalizeNumber(spec.dpi) || 300,
      bleedMM: normalizeNumber(spec.bleedMM) || 3
    },
    sortOrder: normalizeNumber(doc.sortOrder)
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

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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
