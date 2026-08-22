#!/usr/bin/env node
/**
 * 光影集 PhotoMuse 一键部署编排
 *
 * 用法：
 *   npm run deploy            # 全量：部署 31 个云函数 + 自动建 11 个集合 + 部署后自检
 *   npm run deploy -- --only=createAIStudioOrder,photomuseOpenApi   # 只部署指定函数
 *   npm run deploy -- --skip-invoke                                        # 跳过建集合
 *   npm run deploy -- --skip-check                                         # 跳过部署后自检
 *   npm run deploy:dry        # 干跑：只打印计划，不执行
 *
 * 前置（一次性）：
 *   1) npm install -g @cloudbase/cli   （或让脚本用 npx 自动拉起，首次较慢）
 *   2) tcb login                       （浏览器扫码授权）
 *   3) cloudbaserc.json 里的 envId 已指向你的环境
 *
 * 说明：
 *   - 函数配置（超时/内存/环境变量）全部读取 cloudbaserc.json，与仓库同源；
 *     改超时/加环境变量后重跑一次部署即可生效，无需控制台手动改。
 *   - 生成密钥类环境变量（管理口令、开放 API Key）请先在 cloudbaserc.json 填好或部署后在控制台改，
 *     脚本会在结束时检查空口令并提醒。
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const rc = JSON.parse(fs.readFileSync(path.join(ROOT, 'cloudbaserc.json'), 'utf8'));
const ENV_ID = rc.envId;
const FUNCTIONS = rc.functions;

/**
 * 本地密钥覆盖：.deploy-secrets.json（已 gitignore，不入公开仓库）
 * 形如 { "AI_STUDIO_OPEN_API_KEYS": "...", "AI_STUDIO_ADMIN_PASSWORD": "..." }
 * 部署时会用其中的值替换 cloudbaserc.json 里同名环境变量的空占位。
 */
const SECRETS_PATH = path.join(ROOT, '.deploy-secrets.json');
let SECRETS = {};
if (fs.existsSync(SECRETS_PATH)) {
  try {
    SECRETS = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8'));
  } catch (e) {
    console.error(`✗ .deploy-secrets.json 不是合法 JSON：${e.message}`);
    process.exit(1);
  }
}
const effectiveFunctions = FUNCTIONS.map(f => {
  const envVariables = {};
  for (const [k, v] of Object.entries(f.envVariables || {})) {
    envVariables[k] = (typeof v === 'string' && !v.trim() && SECRETS[k]) ? SECRETS[k] : v;
  }
  return { ...f, envVariables };
});
const FUNCTIONS_LIST = effectiveFunctions;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || process.env.npm_lifecycle_event === 'deploy:dry';
const SKIP_INVOKE = args.includes('--skip-invoke');
const SKIP_CHECK = args.includes('--skip-check');
const onlyArg = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '');
const ONLY = onlyArg ? new Set(onlyArg.split(',').map(s => s.trim()).filter(Boolean)) : null;

const INIT_FN = 'initAIStudioCollections';

if (!ENV_ID) {
  console.error('✗ cloudbaserc.json 缺少 envId，请先填写你的云开发环境 ID');
  process.exit(1);
}

// ---------- 工具 ----------
const c = { green: s => `\x1b[32m${s}\x1b[0m`, red: s => `\x1b[31m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m`, bold: s => `\x1b[1m${s}\x1b[0m` };

function run(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts
  });
}

/** 探测可用的 CloudBase CLI：全局 tcb → npx 拉起 */
function detectCli() {
  for (const candidate of ['tcb', 'cloudbase']) {
    const probe = run('where', [candidate], { shell: true });
    if (probe.status === 0) return candidate;
  }
  // Windows where 失败时再直接试运行
  for (const candidate of ['tcb', 'cloudbase']) {
    const probe = run(candidate, ['-v']);
    if (probe.status === 0) return candidate;
  }
  return null;
}

let CLI = detectCli();
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
if (!CLI) {
  console.log(c.yellow('! 未检测到全局 @cloudbase/cli，将使用 npx 自动拉起（首次较慢）'));
  CLI = null;
}

function cli(args, opts = {}) {
  if (CLI) return run(CLI, args, opts);
  return run(NPX, ['-y', '@cloudbase/cli', ...args], opts);
}

function loginCheck() {
  console.log(c.bold('\n[1/4] 检查登录状态'));
  // 注意：CLI 3.x 不支持 -j 参数；用裸 env list，以退出码+输出判断
  const res = cli(['env', 'list'], { stdio: 'pipe' });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  const loggedOut = res.status !== 0 || /please use cloudbase login|请使用|No valid identity|未登录/i.test(out);
  if (loggedOut) {
    console.error(c.red('  ✗ 未登录或凭证失效。请先执行：'));
    console.error(`     ${CLI || 'npx -y @cloudbase/cli'} login`);
    console.error(c.dim('     浏览器扫码授权后重跑 npm run deploy'));
    process.exit(1);
  }
  console.log(c.green('  ✓ 登录有效'));
}

// ---------- 步骤 ----------
function plan() {
  const targets = FUNCTIONS_LIST.filter(f => !ONLY || ONLY.has(f.name));
  if (ONLY) {
    const missing = [...ONLY].filter(n => !FUNCTIONS_LIST.some(f => f.name === n));
    if (missing.length) {
      console.error(c.red(`✗ --only 中的函数不在 cloudbaserc.json：${missing.join(', ')}`));
      process.exit(1);
    }
  }
  return targets;
}

function deployFunctions(targets) {
  console.log(c.bold(`\n[2/4] 部署云函数（${targets.length}/${FUNCTIONS_LIST.length} 个，配置读取 cloudbaserc.json）`));
  console.log(c.dim(`      环境：${ENV_ID}`));
  const results = [];
  let done = 0;
  for (const fn of targets) {
    done += 1;
    const prefix = `  [${String(done).padStart(String(targets.length).length, ' ')}/${targets.length}] ${fn.name}`;
    if (DRY_RUN) {
      console.log(`${prefix} ${c.dim('dry-run 跳过')} timeout=${fn.timeout}s mem=${fn.memory}MB env=${Object.keys(fn.envVariables || {}).join(',') || '-'}`);
      results.push({ name: fn.name, ok: true });
      continue;
    }
    process.stdout.write(`${prefix} …`);
    // fn deploy 参数：-e 环境；--force 覆盖远端；超时/内存/运行时/envVariables 由 cloudbaserc 注入
    const res = cli(['fn', 'deploy', fn.name, '-e', ENV_ID, '--force'], { stdio: 'pipe' });
    const out = `${res.stdout || ''}${res.stderr || ''}`;
    if (res.status === 0 && !/error|错误/i.test(out)) {
      console.log(`\r${prefix} ${c.green('✓')}`);
      results.push({ name: fn.name, ok: true });
    } else {
      console.log(`\r${prefix} ${c.red('✗')}`);
      console.log(c.dim(out.split('\n').slice(-6).join('\n').trim()));
      results.push({ name: fn.name, ok: false });
    }
  }
  return results;
}

function invokeInit() {
  console.log(c.bold(`\n[3/4] 初始化数据库集合（调用 ${INIT_FN}，幂等可重复执行）`));
  if (DRY_RUN) { console.log('  dry-run 跳过'); return; }
  const res = cli(['fn', 'invoke', INIT_FN, '-e', ENV_ID], { stdio: 'pipe' });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  if (res.status !== 0) {
    console.error(c.red('  ✗ 集合初始化调用失败：'));
    console.error(c.dim(out.split('\n').slice(-8).join('\n')));
    console.error(c.yellow('  可稍后在控制台手动调用一次 initAIStudioCollections，或到数据库页手动建 11 个 ai_studio_* 集合'));
    return;
  }
  // 解析返回里的 created/existed 计数（CLI 输出格式不一，尽力提取）
  const m = out.match(/\{[\s\S]*"success"[\s\S]*\}/);
  if (m) {
    try {
      const parsed = JSON.parse(m[0]);
      console.log(c.green(`  ✓ 集合就绪：新建 ${parsed.createdCount} 个，已存在 ${parsed.existedCount} 个，共 ${parsed.total} 个`));
      if (parsed.failed && parsed.failed.length) {
        console.log(c.yellow(`  ! 失败 ${parsed.failed.length} 个：${parsed.failed.map(f => f.name).join(', ')}`));
      }
      return;
    } catch (e) { /* 走兜底输出 */ }
  }
  console.log(c.green('  ✓ 初始化调用完成（输出：'), c.dim(out.trim().split('\n').pop()), c.green('）'));
}

function postCheck(results) {
  console.log(c.bold('\n[4/4] 部署后自检'));
  const ok = results.filter(r => r.ok).length;
  const bad = results.filter(r => !r.ok);
  console.log(`  云函数：${c.green(ok + ' 成功')}${bad.length ? c.red('，' + bad.length + ' 失败：' + bad.map(b => b.name).join(', ')) : c.green('（全部）')}`);

  // 空口令提醒（读 cloudbaserc 的占位值）
  const emptyPwd = FUNCTIONS_LIST.filter(f => 'AI_STUDIO_ADMIN_PASSWORD' in (f.envVariables || {}) && !String(f.envVariables.AI_STUDIO_ADMIN_PASSWORD).trim());
  if (emptyPwd.length) {
    console.log(c.yellow(`  ⚠ 管理口令为空：${emptyPwd.length} 个管理函数的 AI_STUDIO_ADMIN_PASSWORD 是空串（=管理接口全封死）。`));
    console.log(c.yellow('    请在 cloudbaserc.json 填好口令后重跑部署，或到控制台逐函数修改环境变量。'));
  }
  const emptyKey = FUNCTIONS_LIST.filter(f => 'AI_STUDIO_OPEN_API_KEYS' in (f.envVariables || {}) && !String(f.envVariables.AI_STUDIO_OPEN_API_KEYS).trim());
  if (emptyKey.length) {
    console.log(c.yellow('  ⚠ 开放 API Key 为空：photomuseOpenApi 将拒绝所有外部调用（仅小程序不受影响）。网站版需要配置后可用。'));
  }

  console.log(c.green('\n========== 部署完成 =========='));
  console.log('  下一步：');
  console.log('  1) 微信开发者工具打开本目录，真机走一遍 docs/上线检查清单.md 第二节');
  console.log('  2) 管理后台配置生图/视觉模型（模型设置面板）');
  console.log('  3) 网站版部署见 docs/部署指南.md 第四节');
}

// ---------- 主流程 ----------
const RC_PATH = path.join(ROOT, 'cloudbaserc.json');

/**
 * 把 .deploy-secrets.json 的密钥临时写入 cloudbaserc.json。
 * 原因：tcb fn deploy 直接读取磁盘上的 cloudbaserc.json，脚本内存里的合并不生效。
 * 约定：部署前写入合并版，finally 恢复占位原文——仓库文件始终零密钥。
 * 返回原文内容用于恢复；无密钥需要合并时返回 null。
 */
function writeSecretsMergedConfig() {
  // 判定依据是"原始配置里存在待填充的空占位"，而不是合并后的列表（合并后自然无空值）
  const needsMerge = rc.functions.some(f =>
    Object.entries(f.envVariables || {}).some(([k, v]) => typeof v === 'string' && !v.trim() && SECRETS[k])
  );
  if (!needsMerge) return null;
  const original = fs.readFileSync(RC_PATH, 'utf8');
  const merged = JSON.parse(JSON.stringify(rc));
  merged.functions = effectiveFunctions;
  fs.writeFileSync(RC_PATH, JSON.stringify(merged, null, 2) + '\n');
  return original;
}

function main() {
  console.log(c.bold('光影集 PhotoMuse · 一键部署'));
  console.log(c.dim(`模式：${DRY_RUN ? 'DRY-RUN（只打印计划）' : '全量部署'}${ONLY ? `，仅 ${ONLY.size} 个函数` : ''}`));
  const targets = plan();
  let originalConfig = null;
  try {
    if (!DRY_RUN) {
      loginCheck();
      originalConfig = writeSecretsMergedConfig();
      if (originalConfig !== null) console.log(c.dim('  （已临时注入 .deploy-secrets.json 密钥到 cloudbaserc.json，部署结束后自动还原）'));
    }
    const results = deployFunctions(targets);
    if (!SKIP_INVOKE && !ONLY) invokeInit(); else if (!SKIP_INVOKE && ONLY && ONLY.has(INIT_FN)) invokeInit();
    if (!SKIP_CHECK) postCheck(results);
    const failed = results.filter(r => !r.ok).length;
    process.exitCode = DRY_RUN ? 0 : (failed ? 1 : 0);
  } finally {
    if (originalConfig !== null) {
      fs.writeFileSync(RC_PATH, originalConfig);
      console.log(c.dim('  （cloudbaserc.json 已还原为占位版，仓库零密钥）'));
    }
  }
}

main();
