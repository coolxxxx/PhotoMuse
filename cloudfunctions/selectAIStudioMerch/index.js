const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const MAX_ITEMS = 20;
const ALLOWED_STATUSES = ['cell_selected', 'delivered', 'merch_pending'];

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
    const orderId = cleanText(event.orderId, 80);
    if (!orderId) return fail('VALIDATION_ERROR', '订单号无效');

    const items = normalizeItems(event.items);
    if (!items) return fail('VALIDATION_ERROR', '周边选择参数无效（1-20 项，每项数量 1-9）');

    const order = await findOrder(event, orderId, OPENID);
    if (!order) return fail('NOT_FOUND', '订单不存在或查询信息不匹配');

    if (order.product_type !== 'portrait') {
      return fail('VALIDATION_ERROR', '该订单不是写真套图订单');
    }
    if (!ALLOWED_STATUSES.includes(order.order_status)) {
      return fail('INVALID_STATUS', '当前状态不能选择周边');
    }

    const catalog = await loadMerchCatalog();
    const stamp = Date.now().toString(36);
    const merchItems = [];
    let merchTotal = 0;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const merch = catalog[item.merchId];
      if (!merch) return fail('VALIDATION_ERROR', '周边商品无效');

      const fileResult = await db.collection('ai_studio_files')
        .where({ orderId, fileID: item.fileID, fileType: _.in(['delivery', 'generated']) })
        .limit(1)
        .get();
      if (!fileResult.data || fileResult.data.length < 1) {
        return fail('VALIDATION_ERROR', '周边成片文件不属于该订单');
      }

      const lineTotal = round1(merch.price * item.qty);
      merchTotal += lineTotal;
      merchItems.push({
        merchItemId: `MI-${stamp}-${index + 1}-${Math.random().toString(36).slice(2, 6)}`,
        merchId: merch.merchId,
        fileID: item.fileID,
        name: merch.name,
        price: merch.price,
        qty: item.qty,
        lineTotal
      });
    }

    merchTotal = round1(merchTotal);

    await db.collection('ai_studio_orders').where({ orderId }).update({
      data: {
        merch_items: merchItems,
        merch_total: merchTotal,
        order_status: 'merch_pending',
        merch_selected_at: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });

    await writeAudit(orderId, OPENID || 'credential', 'select_merch', {
      count: merchItems.length,
      merchTotal
    });

    return {
      success: true,
      order: {
        orderId,
        order_status: 'merch_pending',
        merch_total: merchTotal
      }
    };
  } catch (error) {
    console.error('selectAIStudioMerch failed:', error);
    return fail('INTERNAL_ERROR', '周边选择失败，请稍后重试');
  }
};

async function findOrder(event, orderId, openid) {
  if (openid) {
    const ownedResult = await db.collection('ai_studio_orders')
      .where({ orderId, _openid: openid })
      .limit(1)
      .get();
    const owned = ownedResult.data && ownedResult.data[0];
    if (owned) return owned;
  }

  const webToken = cleanText(event.webToken, 128);
  if (webToken) {
    const tokenResult = await db.collection('ai_studio_orders')
      .where({ orderId, web_token_hash: hashWebToken(webToken) })
      .limit(1)
      .get();
    const tokenOrder = tokenResult.data && tokenResult.data[0];
    if (tokenOrder) return tokenOrder;
  }

  const contactPhone = normalizePhone(event.contactPhone);
  const queryPassword = cleanText(event.queryPassword, 32);
  if (contactPhone && queryPassword.length >= 6) {
    const result = await db.collection('ai_studio_orders')
      .where({
        orderId,
        contactPhone,
        queryPasswordHash: hashQueryPassword(queryPassword)
      })
      .limit(1)
      .get();
    return result.data && result.data[0];
  }

  return null;
}

async function loadMerchCatalog() {
  const catalog = {};
  try {
    const result = await db.collection('ai_studio_merchandise')
      .where({ enabled: true })
      .orderBy('sortOrder', 'asc')
      .limit(50)
      .get();
    const rows = result.data || [];
    for (const row of rows) {
      const merchId = cleanText(row.merchId || row._id, 64);
      if (merchId) catalog[merchId] = toMerchSnapshot(row);
    }
    if (rows.length < 1) {
      for (const merch of DEFAULT_MERCH) catalog[merch.merchId] = merch;
    }
  } catch (error) {
    console.error('loadMerchCatalog failed:', error);
    for (const merch of DEFAULT_MERCH) catalog[merch.merchId] = merch;
  }
  return catalog;
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

function normalizeItems(value) {
  if (!Array.isArray(value)) return null;
  if (value.length < 1 || value.length > MAX_ITEMS) return null;
  const items = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null;
    const merchId = cleanText(entry.merchId, 64);
    const fileID = cleanText(entry.fileID, 300);
    const qty = Number(entry.qty);
    if (!merchId) return null;
    if (!fileID || !fileID.startsWith('cloud://')) return null;
    if (!Number.isInteger(qty) || qty < 1 || qty > 9) return null;
    items.push({ merchId, fileID, qty });
  }
  return items;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function hashWebToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hashQueryPassword(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function normalizePhone(value) {
  const phone = cleanText(value, 20).replace(/\s+/g, '');
  return /^1\d{10}$/.test(phone) ? phone : '';
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
