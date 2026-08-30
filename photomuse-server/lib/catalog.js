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

module.exports = { ORDER_PRODUCTS, PORTRAIT_THEMES, STYLES, DEFAULT_PRICING, STATUS_LABELS };
