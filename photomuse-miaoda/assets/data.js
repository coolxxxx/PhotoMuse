/* ============================================================
 * 浅焦映像 v3 · 数据与工具模块
 * ============================================================ */

// 套餐数据
const PRODUCTS = [
  {
    productId: 'id-standard',
    name: '标准证件照',
    price: 29.9,
    description: '专业精修证件照，含 1 张精修成片 + 多种尺寸排版',
    deliveryCount: 1,
    productionLine: 'auto',
    productType: 'standard'
  },
  {
    productId: 'id-pro',
    name: '形象照精修',
    price: 59.9,
    description: '职业形象照人工精修，商务 / 简历 / LinkedIn 通用',
    deliveryCount: 3,
    productionLine: 'semi_auto',
    productType: 'standard'
  },
  {
    productId: 'portrait-basic',
    name: 'AI 写真 · 单主题',
    price: 69.9,
    description: '上传一张正脸照，AI 生成专属写真主题大片',
    deliveryCount: 5,
    productionLine: 'manual_ai',
    productType: 'portrait'
  },
  {
    productId: 'portrait-multi',
    name: 'AI 写真 · 多主题合集',
    price: 129.9,
    description: '最多 3 个主题一次拍，每主题 5 张成片，性价比之选',
    deliveryCount: 15,
    productionLine: 'manual_ai',
    productType: 'portrait'
  }
];

// 照片风格（标准套餐）
const STYLES = [
  { styleId: 'classic', name: '经典蓝底', notes: '最常用证件照底色，通用正式场合' },
  { styleId: 'white', name: '简约白底', notes: '护照 / 签证 / 简历通用，干净利落' },
  { styleId: 'red', name: '喜庆红底', notes: '结婚照 / 社保卡 / 部分国家签证' },
  { styleId: 'gray', name: '高级灰底', notes: '职业形象照首选，质感立现' }
];

// 写真主题
const PORTRAIT_THEMES = [
  {
    themeId: 'guofeng',
    name: '古风写真',
    desc: '汉服加身，园林叠影，一键穿越的水墨意境大片。',
    sceneHint: '汉服、园林长廊、竹林溪水，水墨留白背景，拍出温婉端庄的古风质感',
    samples: [
      { caption: '汉服 · 竹影', img: 'assets/img/mother-2.jpg' }
    ]
  },
  {
    themeId: 'sports',
    name: '运动活力',
    desc: '球场街头双场景切换，定格你最飒的动感瞬间。',
    sceneHint: '球场、街头、城市跑道，动感构图配高对比光影，元气氛围直接拉满',
    samples: [
      { caption: '球场 · 动感', img: 'assets/img/father-1.jpg' }
    ]
  },
  {
    themeId: 'casual',
    name: '休闲日常',
    desc: '咖啡居家街拍三连，把松弛感日常拍成高光时刻。',
    sceneHint: '咖啡店、居家窗边、街头随拍，自然光加浅景深，轻松拿捏氛围感',
    samples: [
      { caption: '咖啡 · 日常', img: 'assets/img/family-1.jpg' }
    ]
  },
  {
    themeId: 'travel',
    name: '旅拍风光',
    desc: '海边古镇山野任你选，一张照片装下整段旅程。',
    sceneHint: '海边日落、古镇石巷、山野草原，大场景构图配旅行穿搭，出片即封面',
    samples: [
      { caption: '旅拍 · 海岸', img: 'assets/img/mother-2.jpg' }
    ]
  },
  {
    themeId: 'family',
    name: '亲子合照',
    desc: '从温馨互动到全家福，把陪伴拍成值得收藏的样子。',
    sceneHint: '温馨互动、拥抱对视、全家福站位，柔和暖调光线，幸福感溢出屏幕',
    samples: [
      { caption: '全家福 · 暖调', img: 'assets/img/family-1.jpg' }
    ]
  }
];

// 定价
const PRICING = {
  baseThemePrice: 69.9,
  extraThemePrice: 39.9,
  maxThemes: 3,
  photosPerTheme: 5
};

// 场景模拟品类
const SHOWCASE_CATEGORIES = [
  { id: 'wall', name: '挂墙相框', price: '¥128 起' },
  { id: 'desk', name: '水晶摆台', price: '¥68 起' },
  { id: 'calendar', name: '定制挂历', price: '¥88 起' },
  { id: 'wallet', name: '钱包照片', price: '¥19.9 起' },
  { id: 'keychain', name: '亚克力挂件', price: '¥29.9 起' },
  { id: 'album', name: '写真相册', price: '¥198 起' }
];

// 工具函数
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const priceText = (n) => {
  const v = Number(n);
  return (isFinite(v) && v > 0) ? '¥' + String(Math.round(v * 100) / 100) : '';
};

const fmtPrice = (n) => {
  const v = Math.round(Number(n) * 10) / 10;
  if (!isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

const fmtSize = (n) => {
  const v = Number(n);
  if (!isFinite(v) || v <= 0) return '';
  return v < 1024 * 1024
    ? Math.max(1, Math.round(v / 1024)) + 'KB'
    : (v / 1024 / 1024).toFixed(1) + 'MB';
};

const generateOrderId = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'PM' + ts + rand;
};

// 模拟订单（订单查询用）
const MOCK_ORDER = {
  orderId: 'PM2Q7K8X9F',
  status: 'producing',
  statusText: '制作中',
  productName: 'AI 写真 · 多主题合集',
  contactPhone: '138****8888',
  createdAt: '2026-08-28 14:32',
  totalAmount: 129.9,
  themes: ['guofeng', 'casual'],
  photos: [
    { name: 'photo1.jpg', size: 2.4 * 1024 * 1024 }
  ],
  samples: {
    guofeng: [
      { id: 1, url: 'assets/img/mother-2.jpg', caption: '汉服 · 竹影', selected: true },
      { id: 2, url: 'assets/img/mother-2.jpg', caption: '古风 · 长廊', selected: false },
      { id: 3, url: 'assets/img/mother-2.jpg', caption: '水墨 · 留白', selected: true },
      { id: 4, url: 'assets/img/mother-2.jpg', caption: '园林 · 雅致', selected: false },
      { id: 5, url: 'assets/img/mother-2.jpg', caption: '庭院 · 深幽', selected: false }
    ],
    casual: [
      { id: 6, url: 'assets/img/family-1.jpg', caption: '咖啡 · 午后', selected: true },
      { id: 7, url: 'assets/img/family-1.jpg', caption: '窗边 · 柔光', selected: false },
      { id: 8, url: 'assets/img/family-1.jpg', caption: '街头 · 随拍', selected: false },
      { id: 9, url: 'assets/img/family-1.jpg', caption: '居家 · 松弛', selected: true },
      { id: 10, url: 'assets/img/family-1.jpg', caption: '巷弄 · 慢生活', selected: false }
    ]
  }
};

// 首页特色
const FEATURES = [
  {
    no: '01',
    title: '暗房级精修',
    desc: '每一张成片都经过暗房级人工精修，光影、肤色、质感三重校准，达到影楼出片标准。'
  },
  {
    no: '02',
    title: '一张入镜，百变成片',
    desc: '只需上传一张清晰正脸照，AI 即可生成多场景、多风格的专业写真，不用出门的影楼。'
  },
  {
    no: '03',
    title: '相纸质感交付',
    desc: '成品支持多种实体周边输出——挂墙相框、水晶摆台、写真相册，每一件都是值得珍藏的相纸记忆。'
  }
];

// 暴露到全局
Object.assign(window, {
  PRODUCTS, STYLES, PORTRAIT_THEMES, PRICING, SHOWCASE_CATEGORIES,
  esc, priceText, fmtPrice, fmtSize, generateOrderId, MOCK_ORDER, FEATURES
});
