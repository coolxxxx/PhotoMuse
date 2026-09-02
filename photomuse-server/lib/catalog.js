/* ============================================================
 * 浅焦映像 · 业务常量（与小程序 utils/ai-studio-config.js 同构）
 * ============================================================ */
'use strict';

const ORDER_PRODUCTS = [
  {
    productId: 'id_photo_9_9',
    productType: 'standard',
    name: '证件照体验版',
    price: 3.9,
    description: '1 个规格，1 张高清电子版，适合考试报名、身份照、社保资料。',
    deliveryCount: 1,
    productionLine: 'auto'
  },
  {
    productId: 'resume_photo_29_9',
    productType: 'standard',
    name: '简历形象照',
    price: 29.9,
    description: '1 个商务风格，适合简历、职业平台和工牌头像。',
    deliveryCount: 3,
    productionLine: 'semi-auto'
  },
  {
    productId: 'portrait_suite_69',
    productType: 'portrait',
    name: '人像写真套系',
    price: 69.9,
    description: '多风格人像写真，5 张精修成片，人工拍摄指导与精修交付。',
    deliveryCount: 5,
    productionLine: 'manual'
  }
];

const PORTRAIT_THEMES = [
  { themeId: 'guofeng', name: '古风写真', desc: '汉服加身，园林叠影，一键穿越的水墨意境大片。', sceneHint: '汉服、园林长廊、竹林溪水，水墨留白背景，拍出温婉端庄的古风质感' },
  { themeId: 'sports', name: '运动活力', desc: '球场街头双场景切换，定格你最飒的动感瞬间。', sceneHint: '球场、街头、城市跑道，动感构图配高对比光影，元气氛围直接拉满' },
  { themeId: 'casual', name: '休闲日常', desc: '咖啡居家街拍三连，把松弛感日常拍成高光时刻。', sceneHint: '咖啡店、居家窗边、街头随拍，自然光加浅景深，轻松拿捏氛围感' },
  { themeId: 'travel', name: '旅拍风光', desc: '海边古镇山野任你选，一张照片装下整段旅程。', sceneHint: '海边日落、古镇石巷、山野草原，大场景构图配旅行穿搭，出片即封面' },
  { themeId: 'family', name: '亲子合照', desc: '从温馨互动到全家福，把陪伴拍成值得收藏的样子。', sceneHint: '温馨互动、拥抱对视、全家福站位，柔和暖调光线，幸福感溢出屏幕' }
];

const STYLES = [
  { styleId: 'std_white', name: '标准白底证件照', backgroundColor: '白色' },
  { styleId: 'std_blue', name: '蓝底报名照', backgroundColor: '蓝色' },
  { styleId: 'std_gray', name: '灰底商务证件照', backgroundColor: '深灰色' },
  { styleId: 'resume_shirt', name: '白衬衫简历照', backgroundColor: '浅灰色' },
  { styleId: 'casual_nat', name: '自然光人像写真', backgroundColor: '原场景' }
];

const DEFAULT_PRICING = { basePrice: 69.9, perTheme: 39.9, maxThemes: 3, freeThemes: 1 };

const STATUS_LABELS = {
  waiting_photos: '待上传照片', photo_review: '照片审核中', queued: '已排单',
  grid_preview: '网格预览待选片', cell_selected: '已选片，制作中', generating: '出图中',
  qc: '质检中', delivered: '已交付', revision: '返修中', closed: '已完结',
  merch_pending: '周边待制作', in_production: '周边制作中', completed: '已完结',
  cancelled: '已取消', waiting_authorization: '待授权确认'
};

const DEFAULT_MERCH = [
  { merchId: 'wall_8', name: '挂墙主视觉·8寸实木框', category: 'wall', desc: '进口实木框搭配高清微喷，进门第一眼就是写真馆质感', price: 49, imageRatio: '4:5', printSpec: { widthMM: 203, heightMM: 254, dpi: 300, bleedMM: 3 }, sortOrder: 1 },
  { merchId: 'wall_12', name: '挂墙主视觉·12寸大画幅', category: 'wall', desc: '12 寸大画幅细节数倍放大，撑起整面墙的高光主视觉', price: 79, imageRatio: '3:4', printSpec: { widthMM: 305, heightMM: 406, dpi: 300, bleedMM: 3 }, sortOrder: 2 },
  { merchId: 'desk_5', name: '水晶摆台·5寸', category: 'desk', desc: '高透水晶面板摆台，随手一放就是工位治愈角', price: 29, imageRatio: '5:7', printSpec: { widthMM: 127, heightMM: 178, dpi: 300, bleedMM: 3 }, sortOrder: 3 },
  { merchId: 'calendar', name: '定制挂历·13页', category: 'calendar', desc: '13 页月历编排，一年十二个月天天有你的高光', price: 39, imageRatio: '1:1.41', printSpec: { widthMM: 210, heightMM: 297, dpi: 300, bleedMM: 3 }, sortOrder: 4 },
  { merchId: 'wallet', name: '钱包照套装·6张', category: 'wallet', desc: '6 张随身卡位尺寸，把最喜欢的瞬间放进口袋', price: 9.9, imageRatio: '4:3', printSpec: { widthMM: 89, heightMM: 64, dpi: 300, bleedMM: 3 }, sortOrder: 5 },
  { merchId: 'pendant', name: '亚克力挂件·圆形5cm×2个', category: 'pendant', desc: '圆形亚克力挂件一对，挂包挂钥匙都好看', price: 19, imageRatio: '1:1', printSpec: { widthMM: 50, heightMM: 50, dpi: 300, bleedMM: 3 }, sortOrder: 6 },
  { merchId: 'album', name: '精装相册·10P 方形', category: 'album', desc: '方形精装 10P 翻页即影集，自留送礼两相宜', price: 69, imageRatio: '1:1', printSpec: { widthMM: 250, heightMM: 250, dpi: 300, bleedMM: 3 }, sortOrder: 7 }
];

module.exports = { ORDER_PRODUCTS, PORTRAIT_THEMES, STYLES, DEFAULT_PRICING, STATUS_LABELS, DEFAULT_MERCH };
