const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

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

exports.main = async () => {
  try {
    const result = await db.collection('ai_studio_merchandise')
      .where({ enabled: true })
      .orderBy('sortOrder', 'asc')
      .limit(50)
      .get();

    const rows = (result.data || []).map(toPublicMerch);
    if (rows.length < 1) {
      return { success: true, data: DEFAULT_MERCH };
    }
    rows.sort((a, b) => a.sortOrder - b.sortOrder);
    return { success: true, data: rows };
  } catch (error) {
    console.error('listAIStudioMerchandise failed:', error);
    return { success: true, data: DEFAULT_MERCH };
  }
};

function toPublicMerch(doc) {
  const spec = doc.printSpec || {};
  return {
    merchId: cleanText(doc.merchId || doc._id, 64),
    name: cleanText(doc.name, 60),
    category: cleanText(doc.category, 32),
    desc: cleanText(doc.desc, 120),
    price: normalizePrice(doc.price),
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

function normalizePrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
