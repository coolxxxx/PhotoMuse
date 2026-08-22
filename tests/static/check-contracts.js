/**
 * 静态契约交叉核对：
 * 1. 前端（小程序 pages + 网站 photomuse-web）调用的云函数名必须有对应 cloudfunctions/ 目录
 * 2. photomuse-web 调用的网关 action 必须在 photomuseOpenApi 的 SUPPORTED_ACTIONS 中
 * 3. app.json 注册的页面文件四件套必须齐全
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
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

// --- 1. 云函数目录 vs 前端调用 ---
console.log('[1] 前端调用 vs 云函数目录');
const fnDirs = new Set(
  fs.readdirSync(path.join(ROOT, 'cloudfunctions')).filter(d =>
    fs.statSync(path.join(ROOT, 'cloudfunctions', d)).isDirectory()
  )
);
const called = new Map();
function recordCall(name, file) {
  if (!called.has(name)) called.set(name, []);
  called.get(name).push(path.relative(ROOT, file));
}
for (const file of [...walk(path.join(ROOT, 'pages'), ['.js']), ...walk(path.join(ROOT, 'photomuse-web'), ['.js'])]) {
  const src = fs.readFileSync(file, 'utf8');
  // 小程序页面：自定义封装 callFunction('名字', ...) 与原生 wx.cloud.callFunction({name})
  for (const m of src.matchAll(/(?:^|\W)callFunction\(\s*['"]([\w]+)['"]/g)) recordCall(m[1], file);
  for (const m of src.matchAll(/callFunction\(\{\s*name:\s*['"]([\w]+)['"]/g)) recordCall(m[1], file);
}
let fnOk = true;
for (const [name, callers] of called) {
  if (!fnDirs.has(name)) {
    fnOk = false;
    fail(`云函数目录缺失: ${name}（被 ${callers.join(', ')} 调用）`);
  }
}
if (fnOk) ok(`前端共调用 ${called.size} 个云函数，目录全部存在`);

// --- 2. 网关 action vs 网关实现 ---
console.log('[2] 网站调用的网关 action vs photomuseOpenApi 实现');
const gatewaySrc = fs.readFileSync(path.join(ROOT, 'cloudfunctions/photomuseOpenApi/index.js'), 'utf8');
const supportedMatch = gatewaySrc.match(/SUPPORTED_ACTIONS\s*=\s*\[([\s\S]*?)\]/);
const supported = new Set(
  supportedMatch ? supportedMatch[1].match(/['"]([\w]+)['"]/g).map(s => s.slice(1, -1)) : []
);
const usedActions = new Set();
for (const file of walk(path.join(ROOT, 'photomuse-web'), ['.js', '.html'])) {
  const src = fs.readFileSync(file, 'utf8');
  // api.js 封装：callApi('action', ...) 或 PM_API.call('action', ...) 或 callFunction 信封内 action 常量
  for (const m of src.matchAll(/callApi\(\s*['"]([\w]+)['"]/g)) usedActions.add(m[1]);
  for (const m of src.matchAll(/PM_API\.call\(\s*['"]([\w]+)['"]/g)) usedActions.add(m[1]);
  for (const m of src.matchAll(/\baction:\s*['"]([\w]+)['"]/g)) usedActions.add(m[1]);
}
let actOk = true;
for (const a of usedActions) {
  if (!supported.has(a)) {
    actOk = false;
    fail(`网关不支持的 action: ${a}`);
  }
}
if (actOk) ok(`网站使用 ${usedActions.size} 个 action，网关 SUPPORTED_ACTIONS（${supported.size} 个）全部覆盖`);
if (supportedMatch === null) fail('未能从网关源码解析 SUPPORTED_ACTIONS，请人工检查');

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

// --- 4. cloudbaserc 函数配置 vs 目录 ---
console.log('[4] cloudbaserc 配置 vs 云函数目录');
const rc = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloudbaserc.json'), 'utf8'));
const configured = new Set(rc.functions.map(f => f.name));
let rcOk = true;
for (const dir of fnDirs) {
  if (!configured.has(dir)) {
    rcOk = false;
    fail(`cloudbaserc 未配置: ${dir}`);
  }
}
for (const f of rc.functions) {
  if (!fnDirs.has(f.name)) {
    rcOk = false;
    fail(`cloudbaserc 配置了不存在的目录: ${f.name}`);
  }
}
if (rcOk) ok(`cloudbaserc ${configured.size} 个函数与 ${fnDirs.size} 个目录一一对应`);

console.log('');
if (failures > 0) {
  console.error(`契约核对失败：${failures} 处问题`);
  process.exit(1);
}
console.log('契约核对全部通过');
