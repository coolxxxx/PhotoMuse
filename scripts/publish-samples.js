/* ============================================================
 * 光影集 PhotoMuse · 样张发布器
 * 将 output/samples/ 下生成的样张发布到云端：
 *   1. tcb storage upload 上传 ai-studio/samples/<file>
 *   2. tcb db nosql execute 写入 ai_studio_samples 集合
 * 幂等：先清同 themeId 旧记录再插入，避免重复
 * 用法：node scripts/publish-samples.js [--dry-run]
 * 前置：tcb 已登录，环境 cloud1-9gv5zn35c8ca8869-00c771e2
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ENV_ID = 'cloud1-9gv5zn35c8ca8869-00c771e2';
const BUCKET = '636c-cloud1-9gv5zn35c8ca8869-00c771e2-1378249990';
const SAMPLES_DIR = path.join(__dirname, '..', 'output', 'samples');
const DRY_RUN = process.argv.includes('--dry-run');

const tcb = (args) => {
  const out = execFileSync('tcb', [...args, '-e', ENV_ID, '--json'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    timeout: 120000,
    shell: process.platform === 'win32'
  });
  return out;
};

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').replace(/^[\s\S]*?- Loading data\.\.\.\s*/, '');

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, 'manifest.json'), 'utf8'));
  const ready = manifest.filter(m => {
    const p = path.join(SAMPLES_DIR, m.file);
    return fs.existsSync(p) && fs.statSync(p).size > 20000;
  });
  console.log(`manifest ${manifest.length} 条，本地就绪 ${ready.length} 条`);

  if (!ready.length) { console.log('无待发布文件'); return; }

  if (DRY_RUN) {
    ready.forEach(m => console.log(`[dry] ${m.cloudPath} → ${m.themeId} "${m.caption}" sort=${m.sortOrder}`));
    return;
  }

  // 1. 逐个上传文件（CLI 多文件逗号语法不稳，单文件已验证可靠）
  let uploaded = 0;
  for (const m of ready) {
    stripAnsi(tcb(['storage', 'upload', path.join('output', 'samples', m.file), m.cloudPath]));
    uploaded += 1;
    console.log(`  已上传 ${uploaded}/${ready.length}：${m.cloudPath}`);
  }

  // 2/3. 生成 DELETE + INSERT 命令文件，由 shell 以 "$(cat file)" 方式执行
  // （Windows 下 Node 直接传 JSON 参数会被 cmd 转义破坏，Git Bash 手动执行已验证可靠）
  const themeIds = [...new Set(ready.map(m => m.themeId))];
  const delFilter = JSON.stringify({ themeId: { $in: themeIds } });
  const docs = ready.map(m => ({
    themeId: m.themeId,
    fileID: `cloud://${ENV_ID}.${BUCKET}/${m.cloudPath}`,
    caption: m.caption,
    sortOrder: m.sortOrder,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  const cmds = [
    { TableName: 'ai_studio_samples', CommandType: 'DELETE', Command: JSON.stringify({ delete: 'ai_studio_samples', deletes: [{ q: JSON.parse(delFilter), limit: 0 }] }) },
    { TableName: 'ai_studio_samples', CommandType: 'INSERT', Command: JSON.stringify({ insert: 'ai_studio_samples', documents: docs }) }
  ];
  const cmdFile = path.join(SAMPLES_DIR, 'db-commands.json');
  fs.writeFileSync(cmdFile, JSON.stringify(cmds) + '\n');
  console.log(`DB 命令已写入：${cmdFile}`);
  console.log(`执行：tcb db nosql execute -e ${ENV_ID} --command "$(cat ${cmdFile.replace(/\\/g, '/')})"`);

  console.log('\n发布完成。验证：');
  console.log(`  tcb fn invoke listAIStudioSamples -e ${ENV_ID}`);
}

try { main(); } catch (e) { console.error('发布失败:', e.message); process.exit(1); }
