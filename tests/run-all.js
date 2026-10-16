#!/usr/bin/env node
/**
 * 统一测试链：逐段跑完所有套件，**不因某段失败而跳过后续**，最后按汇总决定退出码。
 *
 * 之前 npm test 用 && 串联，集成段一失败就短路，后端用例（tests/server.test.mjs）
 * 根本不会被执行——测试链出现盲区。这里改成顺序执行 + 汇总，保证每段都有结果。
 *
 * 用法：npm test（等价 node tests/run-all.js）
 * 只跑某段仍用原有脚本：npm run test:static / test:server
 * （原「集成用例 · 遗留云函数」段随 cloudfunctions/ 退役删除；
 *   「集成用例 · 证件照引擎」用假引擎真跑 HivisionIDPhotos 三步链路）
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const STAGES = [
  ['静态校验 · 小程序契约', ['tests/ai-studio/validate-ai-studio.js']],
  ['静态校验 · 前后端契约', ['tests/static/check-contracts.js']],
  ['静态校验 · 视觉完整性', ['tests/static/check-visual-integrity.js']],
  ['集成用例 · 独立后端', ['--test', 'tests/server.test.mjs']],
  ['集成用例 · 证件照引擎', ['--test', 'tests/idphoto.test.mjs']],
  ['集成用例 · 大模型节点', ['--test', 'tests/model-node.test.mjs']]
];

const results = [];
for (const [name, args] of STAGES) {
  console.log('\n===== ' + name + ' =====');
  /* stdio: inherit：避免在受限沙箱里 spawn 管道 stdio 被拒（EPERM） */
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  const ok = r.status === 0;
  results.push({ name, ok, code: r.status });
}

console.log('\n===== 测试链汇总 =====');
for (const r of results) {
  console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.ok ? '' : '（exit ' + r.code + '）'));
}
const failed = results.filter(r => !r.ok).length;
console.log(failed ? `\n${failed} 段失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
