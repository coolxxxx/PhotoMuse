/**
 * 静态契约交叉核对（遗留云函数退役后版本）：
 * 1. 小程序源码（pages/utils/components 等）里 callFunction('名字', ...) 用到的函数名，
 *    必须在 photomuse-server/server.js 的 wxActions 对象里有同名键
 *    （POST {API_BASE}/open/wx/<name> 按 wxActions[action] 分发）；
 *    反向：wxActions 里定义的键必须被小程序用到（防死接口），确有原因不用的走显式白名单。
 * 2. photomuse-web 里 callApi('action', ...) 用到的 action，必须在 server.js 的 actions
 *    对象里有同名键（POST /api/open 按 actions[action] 分发）。
 * 3. app.json 注册的页面文件四件套必须齐全（与云函数无关，保持原样）。
 *
 * 原第 4 段「cloudbaserc 函数配置 vs 云函数目录」已随 cloudfunctions/ 与 cloudbaserc.json
 * 一并退役删除。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SERVER_SRC = fs.readFileSync(path.join(ROOT, 'photomuse-server/server.js'), 'utf8');
let failures = 0;

function fail(msg) {
  failures += 1;
  console.error('  ✗ ' + msg);
}

function ok(msg) {
  console.log('  ✓ ' + msg);
}

function walk(dir, exts, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) {
      // vendor 目录是第三方 SDK 压缩产物，其内部字符串不属于本项目的调用契约（按路径段判断，避免尾随分隔符问题）
      const segs = p.split(path.sep);
      if (!segs.includes('node_modules') && !segs.includes('vendor')) walk(p, exts, out);
    } else if (exts.some(e => f.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

/** 从 server.js 源码提取 `<obj>.<key> =` 形式定义的键名集合（wxActions / actions 分发表） */
function assignedKeys(src, objName) {
  const keys = new Set();
  const re = new RegExp('(?<![\\w.])' + objName + '\\.(\\w+)\\s*=', 'g');
  for (const m of src.matchAll(re)) keys.add(m[1]);
  return keys;
}

// --- 1. 小程序 callFunction 调用 vs server.js wxActions 分发表 ---
console.log('[1] 小程序 callFunction 调用 vs photomuse-server wxActions');
const wxKeys = assignedKeys(SERVER_SRC, 'wxActions');
if (wxKeys.size === 0) fail('未能从 photomuse-server/server.js 解析 wxActions.<name> = 键定义，请人工检查');

/**
 * 显式白名单：wxActions 里有定义、但小程序当前没有任何 callFunction 调用的键。
 * 只允许在此登记并注明原因；白名单条目也必须真实存在于 wxActions（防白名单腐化）。
 */
const WX_KEYS_NOT_CALLED_ALLOWLIST = {
  // 小程序 adminLogin 页改为用 adminListAIStudioOrders 验权后进入管理页，不直接调用 adminLogin；
  // 该键保留为「管理口令换 token」的兼容/备用入口，故允许不被前端调用。
  adminLogin: '小程序管理登录页用 adminListAIStudioOrders 验权；adminLogin 键保留为口令换 token 兼容入口',
  // 小程序客服入口当前只展示引导文案（index.wxml「联系客服」提示），未发起对话调用；
  // 该键保留待客服对话接入，故允许不被前端调用。
  callAIStudioCustomerService: '小程序客服入口当前只展示引导文案，未发起对话调用；键保留待接入'
};

const called = new Map();
function recordCall(name, file) {
  if (!called.has(name)) called.set(name, []);
  called.get(name).push(path.relative(ROOT, file));
}
const mpRoots = ['pages', 'utils', 'components'].map(d => path.join(ROOT, d)).filter(d => fs.existsSync(d));
const mpFiles = mpRoots.flatMap(d => walk(d, ['.js']));
for (const file of mpFiles) {
  const src = fs.readFileSync(file, 'utf8');
  // 页面内自定义封装 callFunction('名字', ...) 与对象式 callFunction({ name: '名字', ... })
  for (const m of src.matchAll(/(?:^|\W)callFunction\(\s*['"]([\w]+)['"]/g)) recordCall(m[1], file);
  for (const m of src.matchAll(/callFunction\(\{\s*name:\s*['"]([\w]+)['"]/g)) recordCall(m[1], file);
}
if (called.size === 0) fail('未在小程序源码中扫描到任何 callFunction 调用，扫描规则可能已失效');

let fnOk = true;
for (const [name, callers] of called) {
  if (!wxKeys.has(name)) {
    fnOk = false;
    fail(`小程序调用的函数在 wxActions 里缺失: ${name}（被 ${callers.join(', ')} 调用）——POST /open/wx/${name} 会返回「不支持的 action」`);
  }
}
if (fnOk) ok(`小程序共调用 ${called.size} 个函数，wxActions（${wxKeys.size} 个键）全部覆盖`);

let reverseOk = true;
for (const key of wxKeys) {
  if (called.has(key)) continue;
  if (Object.prototype.hasOwnProperty.call(WX_KEYS_NOT_CALLED_ALLOWLIST, key)) continue;
  reverseOk = false;
  fail(`wxActions.${key} 定义了但小程序没有任何调用（死接口）；若确有保留理由，请加进 WX_KEYS_NOT_CALLED_ALLOWLIST 并注释说明`);
}
for (const key of Object.keys(WX_KEYS_NOT_CALLED_ALLOWLIST)) {
  if (!wxKeys.has(key)) {
    reverseOk = false;
    fail(`WX_KEYS_NOT_CALLED_ALLOWLIST 登记了 wxActions 里不存在的键: ${key}（白名单已腐化，请移除）`);
  }
}
if (reverseOk) ok(`wxActions 反向核对通过（${called.size} 个被调用 + ${Object.keys(WX_KEYS_NOT_CALLED_ALLOWLIST).length} 个白名单键）`);

// --- 2. photomuse-web callApi 调用 vs server.js actions 分发表 ---
console.log('[2] 网站 callApi 调用 vs photomuse-server actions');
const actionKeys = assignedKeys(SERVER_SRC, 'actions');
if (actionKeys.size === 0) fail('未能从 photomuse-server/server.js 解析 actions.<name> = 键定义，请人工检查');

const usedActions = new Map();
for (const file of walk(path.join(ROOT, 'photomuse-web'), ['.js', '.html'])) {
  const src = fs.readFileSync(file, 'utf8');
  // api.js 封装：PM.callApi('action', ...) / callApi('action', ...) / PM_API.call('action', ...)
  for (const m of src.matchAll(/(?:PM_API\.call|PM\.callApi|callApi)\(\s*['"]([\w]+)['"]/g)) {
    if (!usedActions.has(m[1])) usedActions.set(m[1], []);
    usedActions.get(m[1]).push(path.relative(ROOT, file));
  }
}
if (usedActions.size === 0) fail('未在 photomuse-web 中扫描到任何 callApi 调用，扫描规则可能已失效');

let actOk = true;
for (const [a, callers] of usedActions) {
  if (!actionKeys.has(a)) {
    actOk = false;
    fail(`网站调用的 action 在 actions 里缺失: ${a}（被 ${callers.join(', ')} 调用）——POST /api/open 会返回「不支持的 action」`);
  }
}
if (actOk) ok(`网站共调用 ${usedActions.size} 个 action，actions（${actionKeys.size} 个键）全部覆盖`);

// --- 3. app.json 页面注册 vs 页面文件 ---
console.log('[3] app.json 页面注册 vs 页面四件套');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
let pageOk = true;
for (const page of appJson.pages) {
  for (const ext of ['.js', '.wxml', '.json']) {
    const p = path.join(ROOT, page + ext);
    if (!fs.existsSync(p)) {
      pageOk = false;
      fail(`页面文件缺失: ${page}${ext}`);
    }
  }
}
if (pageOk) ok(`注册 ${appJson.pages.length} 个页面，文件齐全`);

console.log('');
if (failures > 0) {
  console.error(`契约核对失败：${failures} 处问题`);
  process.exit(1);
}
console.log('契约核对全部通过');
