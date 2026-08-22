const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

const requiredPages = [
  'pages/aiStudio/index',
  'pages/aiStudio/detail/detail',
  'pages/aiStudio/adminLogin/adminLogin',
  'pages/aiStudio/admin/admin'
];

const requiredFunctions = [
  'createAIStudioOrder',
  'uploadAIStudioPhoto',
  'submitAIStudioOrder',
  'listMyAIStudioOrders',
  'getAIStudioOrderDetail',
  'queryAIStudioOrder',
  'adminListAIStudioOrders',
  'adminReviewAIStudioOrder',
  'adminDeliverAIStudioOrder',
  'getAIStudioRuntimeConfig',
  'adminUpsertAIStudioRuntimeConfig',
  'callAIStudioCustomerService',
  'dispatchAIStudioJob',
  // 多主题套系 / 周边与样张扩展（与其他并行改动共用本校验清单）
  'listAIStudioSamples',
  'adminUpsertAIStudioSamples',
  'listAIStudioMerchandise',
  'selectAIStudioMerch',
  'adminUpdateMerchProduction',
  'exportAIStudioPrintFile',
  'analyzeAIStudioPhoto',
  'getAIStudioBusinessConfig',
  'adminUpsertAIStudioBusinessConfig'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function main() {
  const config = require(path.join(ROOT, 'utils/ai-studio-config.js'));
  assert.strictEqual(config.PRODUCTS.length, 3, '证件照制作应开放 3 个套餐（含 AI 写真套图）');
  assert.strictEqual(config.STYLES.length, 4, '证件照制作一期应只开放 4 个证件照/简历照风格');
  assert.strictEqual(config.PRODUCTS[0].price, 3.9, '引流证件照体验版价格应为 3.9');
  assert(Array.isArray(config.PORTRAIT_THEMES) && config.PORTRAIT_THEMES.length === 5, 'AI 写真套图应提供 5 个可选主题');
  assert(config.STATUS_LABELS.grid_preview, '状态字典应包含网格预览待选片状态');
  assert(config.STATUS_LABELS.cell_selected, '状态字典应包含已选片制作中状态');
  assert(config.PRODUCT_EXAMPLES.id_photo_9_9, '证件照体验版应配置效果范例');
  assert(config.PRODUCT_EXAMPLES.resume_photo_29_9, '简历形象照应配置效果范例');
  assert(config.PRODUCT_EXAMPLES.id_photo_9_9.beforeImage, '证件照体验版应配置普通自拍示意图');
  assert(config.PRODUCT_EXAMPLES.id_photo_9_9.afterImage, '证件照体验版应配置标准证件照示意图');
  assert(config.PRODUCT_EXAMPLES.resume_photo_29_9.beforeImage, '简历形象照应配置生活照示意图');
  assert(config.PRODUCT_EXAMPLES.resume_photo_29_9.afterImage, '简历形象照应配置职业形象照示意图');
  assert(config.AUTHORIZATION_TEXT.length >= 5, '授权确认文本应覆盖本人/成年/制作用途/展示限制/违规用途');
  assert(config.PORTRAIT_PRICING && config.PORTRAIT_PRICING.maxThemes >= 1, '写真套图应提供多主题阶梯定价配置 PORTRAIT_PRICING');
  assert(config.STATUS_LABELS.merch_pending, '状态字典应包含周边待制作状态');
  assert(config.STATUS_LABELS.in_production, '状态字典应包含周边制作中状态');
  assert(config.STATUS_LABELS.completed, '状态字典应包含已完结状态');

  const appJson = JSON.parse(read('app.json'));
  requiredPages.forEach(page => {
    assert(appJson.pages.includes(page), `${page} must be registered in app.json`);
  });

  requiredFunctions.forEach(functionName => {
    assert(exists(`cloudfunctions/${functionName}/index.js`), `${functionName} index.js missing`);
    assert(exists(`cloudfunctions/${functionName}/package.json`), `${functionName} package.json missing`);
  });

  const createOrder = read('cloudfunctions/createAIStudioOrder/index.js');
  assert(createOrder.includes('AUTHORIZATION_REQUIRED'), 'createAIStudioOrder must enforce authorization');
  assert(createOrder.includes("adult_identity_authorization: 'confirmed'"), 'orders must record adult authorization');
  assert(createOrder.includes('contactPhone'), 'orders should keep a contact phone for customer verification');
  assert(createOrder.includes('queryPasswordHash'), 'orders should store query password as hash only');
  assert(createOrder.includes('portrait_suite_69'), '下单白名单应包含 69.9 AI 写真套图');
  assert(createOrder.includes('theme_id'), '写真套图订单应记录所选写真主题');
  assert(createOrder.includes('themes'), 'createAIStudioOrder 应支持多主题 themes 入参');
  assert(createOrder.includes('baseThemePrice'), 'createAIStudioOrder 应按 baseThemePrice 服务端阶梯计价');

  const adminGridPreview = read('cloudfunctions/adminUploadAIStudioGridPreview/index.js');
  assert(exists('cloudfunctions/adminUploadAIStudioGridPreview/package.json'), 'adminUploadAIStudioGridPreview package.json missing');
  assert(adminGridPreview.includes("fileType: 'grid_preview'"), '管理员上传预览网格应登记 grid_preview 文件');
  assert(adminGridPreview.includes('AI_STUDIO_ADMIN_PASSWORD'), '上传预览网格必须校验管理员口令');

  const selectCells = read('cloudfunctions/selectAIStudioPortraitCells/index.js');
  assert(exists('cloudfunctions/selectAIStudioPortraitCells/package.json'), 'selectAIStudioPortraitCells package.json missing');
  assert(selectCells.includes('selected_cells'), '用户选片应写入选中的分镜格子');
  assert(selectCells.includes('queryPasswordHash'), '免登录选片应校验查询密码哈希');
  assert(selectCells.includes('themeId'), '用户选片应支持按主题（themeId）选片');

  const queryOrder = read('cloudfunctions/queryAIStudioOrder/index.js');
  assert(queryOrder.includes('queryPasswordHash'), 'credential query should verify password hash');
  assert(queryOrder.includes('sanitizeOrder'), 'credential query must not expose password hash');

  const uploadPhoto = read('cloudfunctions/uploadAIStudioPhoto/index.js');
  assert(uploadPhoto.includes("status: 'uploaded'"), 'upload should only count active uploaded photos');
  assert(uploadPhoto.includes('PHOTO_LIMIT_EXCEEDED'), 'upload should enforce 3 photo limit');

  const submitOrder = read('cloudfunctions/submitAIStudioOrder/index.js');
  assert(submitOrder.includes('PHOTO_REQUIRED'), 'submit should reject orders without photos');
  assert(submitOrder.includes("order_status: 'photo_review'"), 'submit should enter photo_review');

  const adminList = read('cloudfunctions/adminListAIStudioOrders/index.js');
  const adminReview = read('cloudfunctions/adminReviewAIStudioOrder/index.js');
  const adminDeliver = read('cloudfunctions/adminDeliverAIStudioOrder/index.js');
  const adminRuntimeConfig = read('cloudfunctions/adminUpsertAIStudioRuntimeConfig/index.js');
  [adminList, adminReview, adminDeliver, adminRuntimeConfig].forEach(source => {
    assert(source.includes('AI_STUDIO_ADMIN_OPENIDS'), 'admin functions must require openid whitelist');
    assert(source.includes('AI_STUDIO_ADMIN_PASSWORD'), 'admin functions must require admin password');
    assert(source.includes('FORBIDDEN'), 'admin functions must reject non-admin users');
  });
  assert(adminReview.includes("status: 'retake_requested'"), 'need_retake should release old uploaded photos');
  assert(adminDeliver.includes("fileType: 'delivery'"), 'admin delivery should register delivery files');

  const runtimeConfig = read('cloudfunctions/getAIStudioRuntimeConfig/index.js');
  assert(runtimeConfig.includes('customer_service'), 'runtime config should expose customer service scene');
  assert(runtimeConfig.includes('image_generation'), 'runtime config should expose image generation scene');
  assert(runtimeConfig.includes('stripPrivateFields'), 'runtime config must strip private fields');
  assert(runtimeConfig.includes('delete copy.content'), 'runtime config must not expose full prompt content to users');

  const customerService = read('cloudfunctions/callAIStudioCustomerService/index.js');
  assert(customerService.includes('AI_STUDIO_TEXT_API_URL'), 'customer service should read provider URL from env');
  assert(customerService.includes('AI_STUDIO_TEXT_API_KEY'), 'customer service should read provider key from env');
  assert(customerService.includes('localReply'), 'customer service must have local fallback');

  const dispatchJob = read('cloudfunctions/dispatchAIStudioJob/index.js');
  assert(dispatchJob.includes('ai_studio_jobs'), 'dispatch should create ai_studio_jobs records');
  assert(dispatchJob.includes('imageGenerationScene'), 'dispatch should route by image generation scene');
  assert(dispatchJob.includes('AI_STUDIO_ADMIN_PASSWORD'), 'admin dispatch path should require admin password');

  const generateImage = read('cloudfunctions/generateAIStudioImage/index.js');
  assert(generateImage.includes('idphoto_engine'), 'generateAIStudioImage 应支持证件照引擎独立配置（idphoto_engine）');
  assert(generateImage.includes('add_background'), '证件照生成应调用 HivisionIDPhotos 加底色接口 add_background');
  assert(generateImage.includes('generate_layout_photos'), '证件照生成应调用 HivisionIDPhotos 排版照接口 generate_layout_photos');
  assert(generateImage.includes('438EDB'), '证件照底色应内置蓝底 438EDB');

  const indexPage = read('pages/aiStudio/index.wxml');
  assert(indexPage.includes('上传正脸照'), 'user page should include photo upload section');
  assert(indexPage.includes('‹ 返回'), 'user page should include back navigation');
  assert(indexPage.includes('手机号'), 'user page should collect contact phone for order verification');
  assert(indexPage.includes('查询密码'), 'user page should collect query password for order verification');
  assert(indexPage.includes('查询订单'), 'user page should include credential order lookup');
  assert(indexPage.includes('效果范例'), 'user page should include conversion examples');
  assert(indexPage.includes('example-image'), 'examples should render real image assets');
  assert(indexPage.includes('拍照引导'), 'user page should include photo guidance');
  assert(indexPage.includes('授权确认'), 'user page should include authorization section');
  assert(indexPage.includes('提交证件照订单'), 'user page should include submit action');

  const detailPage = read('pages/aiStudio/detail/detail.wxml');
  const detailScript = read('pages/aiStudio/detail/detail.js');
  assert(detailPage.includes('补拍上传'), 'detail page should support retake upload');
  assert(detailPage.includes('交付图'), 'detail page should show delivery files');
  assert(detailScript.includes('queryAIStudioOrder'), 'detail page should support credential lookup mode');

  const adminPage = read('pages/aiStudio/admin/admin.wxml');
  assert(adminPage.includes('通过'), 'admin page should include pass action');
  assert(adminPage.includes('重拍'), 'admin page should include retake action');
  assert(adminPage.includes('上传交付'), 'admin page should include delivery action');
  assert(adminPage.includes('退出'), 'admin page should include logout action');

  const adminLoginPage = read('pages/aiStudio/adminLogin/adminLogin.wxml');
  const adminLoginScript = read('pages/aiStudio/adminLogin/adminLogin.js');
  assert(adminLoginPage.includes('管理登录'), 'admin login page should be standalone from teacher area');
  assert(adminLoginPage.includes('返回'), 'admin login page should include back navigation');
  assert(adminLoginPage.includes('管理口令'), 'admin login page should ask for admin password');
  assert(adminLoginScript.includes('adminListAIStudioOrders'), 'admin login should verify cloud admin permission');
  assert(adminLoginScript.includes('aiStudioAdminPassword'), 'admin password should stay in runtime memory');

  assert(adminPage.includes('订单管理'), 'admin page should use neutral management title');

  console.log('AI Studio MVP validation passed');
}

main();
