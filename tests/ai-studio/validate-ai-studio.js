const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

/* ============================================================================
 * AI Studio 静态校验（遗留云函数退役后版本）
 *
 * 结构：
 *   A. 小程序自身契约（utils/ai-studio-config.js 配置 + app.json 页面注册）——原样保留；
 *   B. 服务端安全性质断言——原「cloudfunctions/<fn>/index.js 源码断言」的重定向版，
 *      全部改为对 photomuse-server/server.js（+ lib/catalog.js 产品白名单）源码断言；
 *   C. 页面 WXML 文案/交互断言——原样保留。
 *
 * B 段每条性质都先 grep/读过 server.js 确认真实标识符后才写，绝不凭空编造；
 * 旧云函数标识符 → 新后端真实标识符的映射（含已知缺口）如下，缺口不做静默跳过：
 *   1. 授权校验：旧 `AUTHORIZATION_REQUIRED` + `adult_identity_authorization: 'confirmed'`
 *      → 新后端授权载荷是 `authz.isSelfOrAuthorized / authz.isAdult / authz.agreesProduction`
 *      三布尔（旧字面量已不存在），不满足即 `fail('AUTHORIZATION_REQUIRED', ...)`。
 *   2. 查询密码：旧驼峰 `queryPasswordHash` → 新后端列名 `query_password_hash`，
 *      入库 `sha256(pwd)`；脱敏视图 `orderView`/`maskOrder` 显式白名单字段，不含密码/哈希。
 *   3. 照片上限：旧 `PHOTO_LIMIT_EXCEEDED` → 新后端 `count >= 3` 即
 *      `fail('VALIDATION_ERROR', '最多上传 3 张')`（web registerPhoto + 小程序 uploadAIStudioPhoto）。
 *   4. 提交须有照片：旧 `PHOTO_REQUIRED` → 新后端 `fail('VALIDATION_ERROR', '请至少上传 1 张照片')`。
 *   5. 管理鉴权：旧 `AI_STUDIO_ADMIN_PASSWORD` / `AI_STUDIO_ADMIN_OPENIDS` / `FORBIDDEN`
 *      → 新后端小程序管理入口 `wxAdmin(payload)`（内部 verifyAdminPassword，失败 fail('FORBIDDEN')），
 *      web 管理端 `/api/admin` 统一挂 `adminAuth` → `verifyAdmin(X-Admin-Token)`。
 *   6. 阶梯计价：`baseThemePrice` / `extraThemePrice`（v1 契约键名，getPricing + createOrder）。
 *   7. 显式退役桩：`exportAIStudioPrintFile` / `adminUploadAIStudioGridPreview` 在新后端是
 *      `wxNotImplemented(...)` 桩（只返回 NOT_IMPLEMENTED、无任何特权操作），断言要求其保持
 *      显式退役、不得静默变成功能入口。
 *   8. 证件照引擎（B-8）：`photomuse-server/lib/idphoto.js` 承载自部署 HivisionIDPhotos 客户端
 *      （/idphoto → /add_background → /generate_layout_photos，文件字段 input_image），
 *      `generateAIStudioImage` 的 `stage: 'idphoto'` 走该链路；引擎地址存 config_kv
 *      （scene=idphoto_engine，可由 PM_IDPHOTO_ENGINE_URL 兜底）。
 *      同时守护两处历史 bug 不复发：下单必须落盘客户选的 `spec`（规格）与 `backgroundColor`（底色）；
 *      详情接口的 `spec` 必须取自 spec 列，而不是误用 background_color。
 * ========================================================================== */

const requiredPages = [
  'pages/aiStudio/index',
  'pages/aiStudio/detail/detail',
  'pages/aiStudio/adminLogin/adminLogin',
  'pages/aiStudio/admin/admin'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

/** 取源码中 start（含）到 end（不含）之间的片段；找不到 start 直接断言失败 */
function between(src, start, end, label) {
  const i = src.indexOf(start);
  assert(i >= 0, `${label}: server.js 缺少预期片段「${start}」，请确认标识符后更新本校验`);
  const j = src.indexOf(end, i + start.length);
  return src.slice(i, j < 0 ? src.length : j);
}

/** 把 server.js 里 wxActions.<name> = 的每个定义切成 [name, 源码块]（块到下一处定义/路由为止） */
function wxActionBlocks(src) {
  const starts = [];
  for (const m of src.matchAll(/(?<![\w.])wxActions\.(\w+)\s*=/g)) starts.push({ name: m[1], at: m.index });
  const routeCut = src.indexOf("\napp.post('/api/open/wx/");
  const blocks = new Map();
  starts.forEach((s, idx) => {
    let end = idx + 1 < starts.length ? starts[idx + 1].at : src.length;
    if (routeCut > s.at && routeCut < end) end = routeCut;
    if (!blocks.has(s.name)) blocks.set(s.name, src.slice(s.at, end));
  });
  return blocks;
}

function main() {
  /* ---------------- A. 小程序自身契约（原样保留） ---------------- */
  const config = require(path.join(ROOT, 'utils/ai-studio-config.js'));
  assert.strictEqual(config.PRODUCTS.length, 3, '证件照制作应开放 3 个套餐（含 AI 写真套图）');
  assert.strictEqual(config.STYLES.length, 4, '证件照制作一期应只开放 4 个证件照/简历照风格');
  assert.strictEqual(config.PRODUCTS[0].price, 3.9, '引流证件照体验版价格应为 3.9');
  assert(Array.isArray(config.PORTRAIT_THEMES) && config.PORTRAIT_THEMES.length === 11, 'AI 写真套图应提供 11 个可选主题');
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

  /* ---------------- B. 服务端安全性质（重定向到 photomuse-server/server.js） ---------------- */
  const serverSrc = read('photomuse-server/server.js');
  const catalogSrc = read('photomuse-server/lib/catalog.js');
  const wxBlocks = wxActionBlocks(serverSrc);

  const createOrderBlock = between(serverSrc, 'actions.createOrder = ', '\nfunction requireOrder', 'createOrder');
  const registerPhotoBlock = between(serverSrc, 'actions.registerPhoto = ', '\nactions.submitOrder', 'registerPhoto');
  const submitOrderBlock = between(serverSrc, 'actions.submitOrder = ', '\nactions.getOrder', 'submitOrder');
  const queryOrderBlock = between(serverSrc, 'actions.queryOrder = ', '\nactions.selectCells', 'queryOrder');
  const selectCellsBlock = between(serverSrc, 'actions.selectCells = ', '\nfunction normalizeMerchItems', 'selectCells');
  const orderViewBlock = between(serverSrc, 'function orderView(', '\nconst maskOrder', 'orderView');
  const wxUploadBlock = wxBlocks.get('uploadAIStudioPhoto') || '';
  const wxSubmitBlock = wxBlocks.get('submitAIStudioOrder') || '';
  const adminAuthBlock = between(serverSrc, 'function adminAuth(', "\napp.use('/api/admin'", 'adminAuth');

  // B-1 下单必须校验授权
  assert(createOrderBlock.includes('AUTHORIZATION_REQUIRED'), '下单必须校验授权：createOrder 缺少 AUTHORIZATION_REQUIRED 拒绝路径');
  assert(
    createOrderBlock.includes('authz.isSelfOrAuthorized') && createOrderBlock.includes('authz.isAdult') && createOrderBlock.includes('agreesProduction'),
    '下单必须校验授权：createOrder 应校验 isSelfOrAuthorized/isAdult/agreesProduction 三项授权'
  );

  // B-2 订单不得存明文查询密码，且不得回传给客户端
  assert(
    createOrderBlock.includes('query_password_hash') && createOrderBlock.includes('sha256(pwd)'),
    '订单不得存明文查询密码：入库必须写 query_password_hash = sha256(pwd)'
  );
  assert(queryOrderBlock.includes('query_password_hash') && queryOrderBlock.includes('sha256(pwd)'), '凭证查询应按查询密码哈希比对');
  assert(queryOrderBlock.includes('maskOrder('), '凭证查询必须经脱敏视图返回订单');
  assert(
    !orderViewBlock.includes('query_password_hash') && !orderViewBlock.includes('queryPassword'),
    '脱敏视图 orderView 不得把查询密码/哈希回传给客户端'
  );

  // B-3 上传有张数上限
  assert(registerPhotoBlock.includes('count >= 3') && registerPhotoBlock.includes('最多上传 3 张'), '上传须有张数上限：web registerPhoto 限制最多 3 张');
  assert(wxUploadBlock.includes('count >= 3') && wxUploadBlock.includes('最多上传 3 张'), '上传须有张数上限：小程序 uploadAIStudioPhoto 限制最多 3 张');

  // B-4 提交订单必须校验已有照片
  assert(submitOrderBlock.includes('请至少上传 1 张照片'), '提交订单必须校验已有照片：web submitOrder 缺少无照片拒绝路径');
  assert(wxSubmitBlock.includes('请至少上传 1 张照片'), '提交订单必须校验已有照片：小程序 submitAIStudioOrder 缺少无照片拒绝路径');

  // B-5 管理接口必须鉴权
  const RETIRED_ADMIN_STUBS = ['exportAIStudioPrintFile', 'adminUploadAIStudioGridPreview'];
  for (const name of RETIRED_ADMIN_STUBS) {
    assert((wxBlocks.get(name) || '').includes('wxNotImplemented'), `显式退役桩 ${name} 必须经 wxNotImplemented 返回 NOT_IMPLEMENTED（不得静默成为特权入口）`);
  }
  for (const [name, body] of wxBlocks) {
    if (RETIRED_ADMIN_STUBS.includes(name)) continue;
    if (!name.startsWith('admin') && name !== 'generateAIStudioImage') continue;
    assert(
      body.includes('wxAdmin(payload)') || body.includes('verifyAdminPassword('),
      `管理接口必须鉴权：wxActions.${name} 未调用 wxAdmin/verifyAdminPassword`
    );
    assert(body.includes("'FORBIDDEN'"), `管理接口必须鉴权：wxActions.${name} 无权限时应 fail('FORBIDDEN')`);
  }
  assert(serverSrc.includes("app.use('/api/admin', adminAuth)"), 'web 管理端必须统一挂 adminAuth 鉴权中间件');
  assert(adminAuthBlock.includes('verifyAdmin('), 'adminAuth 必须调用 verifyAdmin 校验 X-Admin-Token');
  assert(
    wxBlocks.has('getAIStudioRuntimeConfig') && wxBlocks.get('getAIStudioRuntimeConfig').includes('publicModelSettings()'),
    'runtime config 必须经 publicModelSettings() 回传'
  );
  assert(
    /function publicModelSettings[\s\S]{0,400}delete out\.apiKey/.test(serverSrc),
    'runtime config 不得向用户回吐 apiKey（密钥不出服务端）'
  );

  // B-8 证件照引擎（HivisionIDPhotos）：必须是真实现，不是退役桩
  const idphotoSrc = read('photomuse-server/lib/idphoto.js');
  assert(idphotoSrc.includes("'/idphoto'"), '证件照引擎必须调用 /idphoto 抠图并按规格裁切');
  assert(idphotoSrc.includes("'/add_background'"), '证件照引擎必须调用 /add_background 叠加底色');
  assert(idphotoSrc.includes("'/generate_layout_photos'"), '证件照引擎必须调用 /generate_layout_photos 生成排版照');
  assert(idphotoSrc.includes("'input_image'"), '证件照引擎文件字段必须为 input_image');
  ['FFFFFF', '438EDB', 'DE2910', '535A60', '1C4F9C'].forEach(hex => {
    assert(idphotoSrc.includes(hex), `证件照底色必须含 ${hex}（与小程序 BACKGROUND_COLORS 同值）`);
  });
  ['一寸', '小一寸', '二寸', '小二寸', '五寸', '六寸'].forEach(name => {
    assert(idphotoSrc.includes(name), `证件照规格必须含「${name}」（与小程序 ID_PHOTO_SPECS 同值）`);
  });
  const generateBlock = wxBlocks.get('generateAIStudioImage') || '';
  assert(generateBlock.includes("stage === 'idphoto'"), 'generateAIStudioImage 必须支持 stage=idphoto');
  assert(generateBlock.includes('idPhotoEngineConfig()'), 'generateAIStudioImage 必须经 idPhotoEngineConfig 取引擎地址');
  assert(generateBlock.includes('CONFIG_MISSING'), '证件照引擎未配置时必须回 CONFIG_MISSING，不得静默失败');
  /* 历史 bug 守护：规格/底色必须在建单时落盘，详情接口不得拿 background_color 冒充 spec */
  assert(createOrderBlock.includes('ID_PHOTO_SPECS'), 'createOrder 必须按白名单落盘客户选的证件照规格 spec');
  assert(createOrderBlock.includes('normalizeBackground('), 'createOrder 必须落盘客户选的底色 backgroundColor');
  assert(serverSrc.includes("spec: o.spec || ''"), "详情接口 spec 必须取自 spec 列（历史 bug：曾误用 background_color）");

  // B-6 服务端阶梯计价（v1 契约键名）
  assert(
    createOrderBlock.includes('pricing.baseThemePrice') && createOrderBlock.includes('pricing.extraThemePrice'),
    '服务端阶梯计价：首主题 baseThemePrice，之后每主题加 extraThemePrice'
  );
  assert(serverSrc.includes('baseThemePrice: pos(') && serverSrc.includes('extraThemePrice: pos('), 'getPricing 应输出 v1 契约键名 baseThemePrice/extraThemePrice');

  // B-7 承接自旧云函数断言、在新后端有真实对应的其余性质
  assert(createOrderBlock.includes('payload.contactPhone'), 'orders should keep a contact phone for customer verification');
  assert(createOrderBlock.includes('ORDER_PRODUCTS.find') && catalogSrc.includes("productId: 'portrait_suite_69'"), '下单白名单应包含 69.9 AI 写真套图（白名单在服务端 lib/catalog.js）');
  assert(createOrderBlock.includes('payload.themes') && createOrderBlock.includes('themeId'), '写真套图订单应记录所选写真主题');
  assert(selectCellsBlock.includes('selected_cells'), '用户选片应写入选中的分镜格子');
  assert(catalogSrc.includes('std_blue'), '证件照底色应内置蓝底规格（STYLES 含 std_blue）');
  const adminReviewBlock = wxBlocks.get('adminReviewAIStudioOrder') || '';
  assert(adminReviewBlock.includes("'need_retake'") && adminReviewBlock.includes("'waiting_photos'"), 'need_retake 应把订单退回 waiting_photos 补拍');
  assert((wxBlocks.get('generateAIStudioImage') || '').includes("'delivery'"), '成片应登记为 delivery 文件');
  assert((wxBlocks.get('callAIStudioCustomerService') || '').includes('local_fallback'), 'customer service must have local fallback');

  /* ---------------- C. 页面 WXML 文案/交互断言（原样保留） ---------------- */
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
