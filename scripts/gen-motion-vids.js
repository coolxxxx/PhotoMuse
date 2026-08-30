/* ============================================================
 * 浅焦映像 · 批量图生视频（阿里云百炼 wan2.2-i2v-flash）
 * 输入：output/family-series/*.jpg + 5 主题样张 output/samples/*.jpg
 * 输出：output/vids/<name>.mp4（幂等：已存在且 >200KB 则跳过）
 * 用法：DASHSCOPE_API_KEY=sk-xxx node scripts/gen-motion-vids.js
 * 密钥不入库：脚本只读环境变量
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.DASHSCOPE_API_KEY || '';
if (!API_KEY) { console.error('缺少 DASHSCOPE_API_KEY 环境变量'); process.exit(1); }

const SUBMIT_URL = 'https://ws-fg1tg5g2aoydr5iv.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis';
const POLL_URL = 'https://dashscope.aliyuncs.com/api/v1/tasks/';
const MODEL = 'wan2.2-i2v-flash';
const VID_DIR = path.join(__dirname, '..', 'output', 'vids');
const PUBLIC_BASE = 'https://www.czpsm.art/PM/';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 每张样张的动效提示词（按套系/画面定制，克制自然为上，避免夸张变形） */
const JOBS = [
  { file: 'father-1.jpg', prompt: '男士沉稳地微笑，眼神明亮，嘴唇轻启说笑，发丝轻微飘动，西装面料光泽细微流动，镜头缓慢推近，画面生动自然' },
  { file: 'father-2.jpg', prompt: '男士低头浅笑，眼神缓缓抬起望向镜头，白衬衫纤维质感清晰，黑白画面中光影柔和流动，镜头缓慢推近' },
  { file: 'father-3.jpg', prompt: '男士自信远望，衣摆随风轻微摆动，手腕腕表反光流转，镜头缓慢环绕，商务质感画面生动' },
  { file: 'mother-1.jpg', prompt: '女士温柔微笑，大波浪卷发轻轻飘动，缎面礼服光泽流动，珍珠项链微光闪烁，镜头缓慢推近，画面优雅生动' },
  { file: 'mother-2.jpg', prompt: '女士回眸微笑，旗袍丝绒质感光泽流动，窗边光线柔和变化，发丝轻飘，镜头缓慢环绕，国风韵味灵动' },
  { file: 'mother-3.jpg', prompt: '女士闭眼恬静微笑，白色纱裙轻轻飘扬，长发随微风缓缓飘动，逆光光晕柔和变化，画面梦幻通透' },
  { file: 'child-1.jpg', prompt: '小女孩捧脸开心大笑，眼睛弯成月牙，小辫子轻轻晃动，毛衣纹理清晰，高调画面明亮通透，镜头缓慢推近' },
  { file: 'child-2.jpg', prompt: '小女孩惊喜地笑，手中彩色气球轻轻浮动，彩带飘扬，背带裤衣角微动，画面活泼生动，镜头轻微环绕' },
  { file: 'child-3.jpg', prompt: '小女孩抱着故事书抬头微笑，发丝光晕轻闪，毛衣绒毛柔和，沙发环境安静温暖，镜头缓慢推近，情绪画面' },
  { file: 'family-1.jpg', prompt: '一家人相视微笑，爸爸妈妈与小女孩眼神交流，发丝随风轻轻飘动，女孩裙摆轻摆，镜头缓慢推近，温馨自然' },
  { file: 'family-2.jpg', prompt: '爸爸把小女孩轻轻举高，女儿张开手臂大笑，妈妈仰头凝笑，三人视线交汇，画面欢乐生动，镜头轻微环绕' },
  { file: 'family-3.jpg', prompt: '一家三口头靠头看绘本轻声笑语，发丝轻微飘动，木地板上光影柔和变化，画面温馨静谧，镜头缓慢拉近' }
];

const headers = {
  'X-DashScope-Async': 'enable',
  Authorization: 'Bearer ' + API_KEY,
  'Content-Type': 'application/json'
};

async function submit(job) {
  const res = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      input: { prompt: job.prompt, img_url: PUBLIC_BASE + 'img/' + job.file },
      parameters: { resolution: '480P' }
    })
  });
  const j = await res.json();
  if (!j.output || !j.output.task_id) { throw new Error('提交失败: ' + JSON.stringify(j).slice(0, 200)); }
  return j.output.task_id;
}

async function poll(taskId) {
  for (let i = 0; i < 40; i++) {
    await sleep(15000);
    const res = await fetch(POLL_URL + taskId, { headers: { Authorization: 'Bearer ' + API_KEY } });
    const j = await res.json();
    const st = j.output && j.output.task_status;
    if (st === 'SUCCEEDED') return j.output.video_url;
    if (st === 'FAILED' || st === 'UNKNOWN') { throw new Error('任务失败: ' + JSON.stringify(j.output || j).slice(0, 200)); }
  }
  throw new Error('轮询超时');
}

async function main() {
  fs.mkdirSync(VID_DIR, { recursive: true });
  const only = process.argv[2];
  let ok = 0, skip = 0, fail = 0;

  for (const job of JOBS) {
    const name = job.file.replace('.jpg', '');
    if (only && !name.includes(only)) continue;
    const outPath = path.join(VID_DIR, name + '.mp4');
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 200000) {
      console.log(`跳过（已存在）: ${name}`);
      skip++;
      continue;
    }
    try {
      process.stdout.write(`${name} 提交…`);
      const taskId = await submit(job);
      console.log(` task=${taskId}`);
      const url = await poll(taskId);
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      fs.writeFileSync(outPath, buf);
      console.log(`  ✓ ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
      ok++;
      await sleep(3000);
    } catch (e) {
      console.log(`  ✗ ${e.message}`);
      fail++;
    }
  }
  console.log(`\n完成：成功 ${ok}，跳过 ${skip}，失败 ${fail}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
