/**
 * 视觉完整性核查（重构后高风险区，进 npm test 链）：
 * 1. 每页 wxml 使用但无任何样式定义的 class（页面 wxss + app.wxss 全集比对；动态 {{}} 插值剥离后按静态部分检查，
 *    纯动态 class（st-xxx/is-done 等）单独校验其在 wxss 中有定义）
 * 2. wxss 中 var(--*) 引用了未定义令牌（app.wxss + 本页定义合并判断）
 * 3. wxss 中残留的十六进制品牌色字面量——showcase 两文件的"实物色系"按设计豁免（场景拟真色，非品牌令牌）
 * 4. 网站：html/order-view.js class 使用 vs style.css 定义覆盖；style.css var() 未定义
 * 5. wxml 中 bind* 事件在对应 js 中无同名方法（防重构断链）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
let problems = 0;
const issue = (type, msg) => { problems += 1; console.log(`  ✗ [${type}] ${msg}`); };

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

// ---------- 小程序页面 ----------
const PAGES = [
  { dir: 'pages/aiStudio', base: 'index' },
  { dir: 'pages/aiStudio/detail', base: 'detail' },
  { dir: 'pages/aiStudio/adminLogin', base: 'adminLogin' },
  { dir: 'pages/aiStudio/admin', base: 'admin' },
  { dir: 'pages/aiStudio/showcase', base: 'showcase' }
];

const appWxss = read('app.wxss');

function parseCss(src) {
  const classes = new Set();
  const vars = new Set();
  for (const m of src.matchAll(/\.([a-zA-Z][\w-]*)/g)) classes.add(m[1]);
  for (const m of src.matchAll(/(--[\w-]+)\s*:/g)) vars.add(m[1]);
  return { classes, vars };
}

console.log('[小程序 5 页]');
for (const page of PAGES) {
  const wxmlPath = `${page.dir}/${page.base}.wxml`;
  const wxssPath = `${page.dir}/${page.base}.wxss`;
  const jsPath = `${page.dir}/${page.base}.js`;
  const wxml = read(wxmlPath);
  const wxss = read(wxssPath);
  const js = read(jsPath);

  // 1. class 覆盖：剥离 {{...}} 后取静态 class；插值内三元里的候选名单独收集
  //    （比较字面量白名单：订单状态枚举/商品 id 等在 {{}} 里作为 == 比较值出现的字符串不是 class）
  const VALUE_LITERALS = new Set([
    'waiting_photos', 'photo_review', 'waiting_authorization', 'queued', 'generating', 'qc',
    'delivered', 'revision', 'closed', 'cancelled', 'grid_preview', 'cell_selected',
    'merch_pending', 'in_production', 'completed',
    'wall_8', 'wall_12', 'desk_5', 'calendar', 'wallet', 'pendant', 'album'
  ]);
  const usedStatic = new Set();
  const usedDynamic = new Set();
  for (const m of wxml.matchAll(/class="([^"]*)"/g)) {
    const attr = m[1];
    const staticPart = attr.replace(/\{\{[\s\S]*?\}\}/g, ' ');
    staticPart.split(/\s+/).forEach(c => { if (c && !c.endsWith('-')) usedStatic.add(c); });
    for (const t of attr.matchAll(/\{\{[\s\S]*?\}\}/g)) {
      for (const q of t[0].matchAll(/'([a-zA-Z][\w-]*)'/g)) {
        if (!VALUE_LITERALS.has(q[1])) usedDynamic.add(q[1]);
      }
    }
  }
  const { classes: pageClasses, vars: pageVars } = parseCss(wxss);
  const { classes: appClasses, vars: appVars } = parseCss(appWxss);
  const defined = new Set([...pageClasses, ...appClasses]);

  const missStatic = [...usedStatic].filter(u => !defined.has(u));
  if (missStatic.length) issue('class失配', `${wxmlPath}: ${missStatic.join(', ')}`);
  const missDynamic = [...usedDynamic].filter(u => !defined.has(u));
  if (missDynamic.length) issue('动态class失配', `${wxmlPath}: ${missDynamic.join(', ')}（wxss 无定义）`);

  // 2. 令牌引用
  const allVars = new Set([...pageVars, ...appVars]);
  for (const m of wxss.matchAll(/var\((--[\w-]+)/g)) {
    if (!allVars.has(m[1])) issue('令牌未定义', `${wxssPath}: var(${m[1]})`);
  }

  // 3. 十六进制残留（showcase 实物色系按设计豁免：整文件跳过，文件头注释已声明）
  const hexExempt = page.base === 'showcase';
  if (!hexExempt) {
    wxss.split('\n').forEach((line, i) => {
      if (/#[0-9a-fA-F]{3,8}\b/.test(line) && !line.trim().startsWith('/*') && !line.trim().startsWith('*')) {
        issue('hex残留', `${wxssPath}:${i + 1}: ${line.trim().slice(0, 80)}`);
      }
    });
  }

  // 4. 事件断链（兼容 async 方法定义）
  const jsMethods = new Set();
  for (const m of js.matchAll(/^\s{2}(?:async\s+)?([a-zA-Z]\w+)\s*[(:]/gm)) jsMethods.add(m[1]);
  for (const m of js.matchAll(/^\s{2}(?:async\s+)?([a-zA-Z]\w+)\s*:\s*(?:async\s*)?[（(]/gm)) jsMethods.add(m[1]);
  for (const m of wxml.matchAll(/(?:bindtap|bindinput|bindchange|bindconfirm|bindblur|bindlongpress|catchtap)="(\w+)"/g)) {
    if (!jsMethods.has(m[1])) issue('事件断链', `${wxmlPath}: bind*="${m[1]}" 在 js 中不存在`);
  }
}

// ---------- 网站 ----------
console.log('[网站 4 页]');
const css = read('photomuse-web/css/style.css');
const { classes: webClasses, vars: webVars } = parseCss(css);
// html 内联 <style> 的 class 一并纳入定义集（showcase.html 场景样式在文件内联）
const inlineClasses = new Set();
for (const html of ['index.html', 'order.html', 'query.html', 'showcase.html']) {
  for (const st of read('photomuse-web/' + html).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const c of st[1].matchAll(/\.([a-zA-Z][\w-]*)/g)) inlineClasses.add(c[1]);
  }
}
const webDefined = new Set([...webClasses, ...inlineClasses]);
for (const html of ['index.html', 'order.html', 'query.html', 'showcase.html']) {
  const src = read('photomuse-web/' + html);
  const used = new Set();
  for (const m of src.matchAll(/class="([^"]*)"/g)) {
    const attr = m[1].replace(/\$\{[\s\S]*?\}/g, ' ').replace(/\{\{[\s\S]*?\}\}/g, ' ');
    attr.split(/\s+/).forEach(c => { if (c) used.add(c); });
  }
  const missing = [...used].filter(u => !webDefined.has(u));
  // showcase.html 的 .sc-* 场景样式为文件内联 <style>，豁免（与小程序 showcase 同为实物色系）
  const isShowcase = html === 'showcase.html';
  const effective = isShowcase ? missing.filter(u => !u.startsWith('sc-')) : missing;
  if (effective.length) issue('class失配', `${html}: ${effective.slice(0, 10).join(', ')}${effective.length > 10 ? ' …' : ''}`);
}
const orderView = read('photomuse-web/js/order-view.js');
for (const m of orderView.matchAll(/class="([^"']*)"/g)) {
  m[1].replace(/\$\{[\s\S]*?\}/g, ' ').split(/\s+/).forEach(c => {
    if (c && !webDefined.has(c)) issue('class失配', `order-view.js: "${c}"`);
  });
}
for (const m of css.matchAll(/var\((--[\w-]+)/g)) {
  if (!webVars.has(m[1])) issue('令牌未定义', `style.css: var(${m[1]})`);
}
// 品牌 hex 残留：只查非 showcase 的 css/内联（showcase 场景色为设计豁免）
for (const html of ['index.html', 'order.html', 'query.html']) {
  read('photomuse-web/' + html).split('\n').forEach((line, i) => {
    if (/#[0-9a-fA-F]{3,8}\b/.test(line) && !line.trim().startsWith('/*') && !line.includes('配置') && !line.includes('占位')) {
      issue('hex残留', `${html}:${i + 1}: ${line.trim().slice(0, 70)}`);
    }
  });
}

console.log('');
if (problems === 0) {
  console.log('视觉完整性核查全部通过');
} else {
  console.log(`发现 ${problems} 处问题`);
  process.exit(1);
}
