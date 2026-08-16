// 多主题阶梯定价默认值（服务端 ai_studio_business_config 集合可覆盖）
const PORTRAIT_PRICING = {
  baseThemePrice: 69.9,
  extraThemePrice: 39.9,
  maxThemes: 3,
  photosPerTheme: 5
};

const PRODUCTS = [
  {
    productId: 'id_photo_9_9',
    name: '3.9 证件照体验版',
    price: 3.9,
    deliveryCount: 1,
    productionLine: 'auto',
    productType: 'standard',
    description: '1 个规格，1 张高清电子版，适合考试报名、身份照、社保资料。'
  },
  {
    productId: 'resume_photo_29_9',
    name: '29.9 简历形象照',
    price: 29.9,
    deliveryCount: 3,
    productionLine: 'semi_auto',
    productType: 'standard',
    description: '1 个商务风格，适合简历、职业平台和工牌头像。'
  },
  {
    productId: 'portrait_suite_69',
    name: '69.9 AI 写真套图',
    price: 69.9,
    deliveryCount: 5,
    productionLine: 'manual_ai',
    productType: 'portrait',
    description: '1-3 个主题随心配，每主题 5 张成片，阶梯计价。'
  }
];

const STYLES = [
  {
    styleId: 'ID-01',
    category: 'id_photo',
    name: '标准白底证件照',
    defaultProduct: '3.9证件照体验版',
    productionLine: 'auto',
    deliveryCount: 1,
    basePrice: 3.9,
    notes: '适合报名和证件用途'
  },
  {
    styleId: 'ID-02',
    category: 'id_photo',
    name: '蓝底报名照',
    defaultProduct: '3.9证件照体验版',
    productionLine: 'auto',
    deliveryCount: 1,
    basePrice: 3.9,
    notes: '适合考试报名和资格证'
  },
  {
    styleId: 'ID-03',
    category: 'id_photo',
    name: '灰底商务证件照',
    defaultProduct: '29.9简历形象照',
    productionLine: 'auto',
    deliveryCount: 3,
    basePrice: 29.9,
    notes: '适合工牌和职业资料'
  },
  {
    styleId: 'BZ-01',
    category: 'business',
    name: '白衬衫简历照',
    defaultProduct: '29.9简历形象照',
    productionLine: 'semi_auto',
    deliveryCount: 3,
    basePrice: 29.9,
    notes: '求职简历和职业平台'
  }
];

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

const STATUS_LABELS = {
  waiting_photos: '待上传照片',
  photo_review: '照片审核中',
  waiting_authorization: '待授权确认',
  queued: '已排单',
  grid_preview: '网格预览待选片',
  cell_selected: '已选片，制作中',
  generating: '出图中',
  qc: '质检中',
  delivered: '已交付',
  revision: '返修中',
  closed: '已完结',
  merch_pending: '周边待制作',
  in_production: '周边制作中',
  completed: '已完结',
  cancelled: '已取消'
};

const PHOTO_CHECK_LABELS = {
  unchecked: '未审核',
  passed: '照片合格',
  need_retake: '需要重拍',
  rejected: '不适合制作'
};

const AUTHORIZATION_TEXT = [
  '我确认提交的照片为本人照片，或已获得照片中人物的明确授权。',
  '我确认照片中人物已满 18 周岁。',
  '我授权商家将这些照片用于本次证件照成片制作。',
  '商家不得在未获得我单独授权的情况下公开展示我的原图或成片。',
  '我不会要求商家生成违法、低俗、欺骗冒充、侵犯他人权益的内容。'
];

const PRODUCT_EXAMPLES = {
  id_photo_9_9: {
    title: '证件照体验版适合什么？',
    subtitle: '适合报名、考试、社保、资料提交等刚需场景。',
    beforeImage: '/assets/images/id-photo-before.svg',
    afterImage: '/assets/images/id-photo-after.svg',
    beforeLabel: '普通自拍',
    afterLabel: '标准证件照',
    features: [
      '正脸裁切，头肩比例更规范',
      '白底/蓝底等常用底色',
      '轻度修整，不做夸张美颜'
    ],
    tips: [
      '光线充足，脸部无遮挡',
      '看镜头，表情自然',
      '不要多人合照，不戴帽子墨镜口罩'
    ]
  },
  resume_photo_29_9: {
    title: '简历形象照能提升什么？',
    subtitle: '适合简历、职业平台、工牌头像和个人介绍页。',
    beforeImage: '/assets/images/resume-photo-before.svg',
    afterImage: '/assets/images/resume-photo-after.svg',
    beforeLabel: '生活照',
    afterLabel: '职业形象照',
    features: [
      '商务灰底或白衬衫风格',
      '头肩构图更像正式头像',
      '人工审核后再交付，减少翻车'
    ],
    tips: [
      '尽量上传清晰正脸或半身照',
      '发型自然，脸部无遮挡',
      '可备注职业用途和想要的气质'
    ]
  }
};

module.exports = {
  PRODUCTS,
  STYLES,
  PORTRAIT_THEMES,
  PORTRAIT_PRICING,
  STATUS_LABELS,
  PHOTO_CHECK_LABELS,
  AUTHORIZATION_TEXT,
  PRODUCT_EXAMPLES
};
