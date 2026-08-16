const PRODUCTS = [
  {
    productId: 'id_photo_9_9',
    name: '3.9 证件照体验版',
    price: 3.9,
    deliveryCount: 1,
    productionLine: 'auto',
    description: '1 个规格，1 张高清电子版，适合考试报名、身份照、社保资料。'
  },
  {
    productId: 'resume_photo_29_9',
    name: '29.9 简历形象照',
    price: 29.9,
    deliveryCount: 3,
    productionLine: 'semi_auto',
    description: '1 个商务风格，适合简历、职业平台和工牌头像。'
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

const STATUS_LABELS = {
  waiting_photos: '待上传照片',
  photo_review: '照片审核中',
  waiting_authorization: '待授权确认',
  queued: '已排单',
  generating: '出图中',
  qc: '质检中',
  delivered: '已交付',
  revision: '返修中',
  closed: '已完结',
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
  STATUS_LABELS,
  PHOTO_CHECK_LABELS,
  AUTHORIZATION_TEXT,
  PRODUCT_EXAMPLES
};
