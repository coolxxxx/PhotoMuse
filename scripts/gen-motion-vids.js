/* ============================================================
 * 浅焦映像 · 批量图生视频 v2
 * 双通道：
 *   happyhorse-1.1-i2v @ token-plan 网关（默认，token plan 免费额度）
 *     input: { prompt, media: [{url}] }
 *   wan2.2-i2v-flash @ 工作空间网关（备用）
 *     input: { prompt, img_url }
 * 密钥走环境变量 DASHSCOPE_API_KEY，不入库
 * 输出：output/vids/<name>.mp4（幂等：已存在且 >200KB 则跳过）
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.DASHSCOPE_API_KEY || '';
if (!API_KEY) { console.error('缺少 DASHSCOPE_API_KEY 环境变量'); process.exit(1); }

const MODEL = process.env.PM_VID_MODEL || 'happyhorse-1.1-i2v';
const IS_WAN = MODEL.startsWith('wan');
const BASE = IS_WAN
  ? 'https://ws-fg1tg5g2aoydr5iv.cn-beijing.maas.aliyuncs.com'
  : 'https://token-plan.cn-beijing.maas.aliyuncs.com';
const SUBMIT_URL = BASE + '/api/v1/services/aigc/video-generation/video-synthesis';
const POLL_URL = BASE + '/api/v1/tasks/';
const VID_DIR = path.join(__dirname, '..', 'output', 'vids');
const PUBLIC_BASE = 'https://www.czpsm.art/PM/';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 动效提示词（克制版：避免"随风飘动"类易夸张的词，强调"轻微自然"） */
const JOBS = [
  { file: 'father-1.jpg', prompt: '男士沉稳地微笑，眼神明亮有神，面部表情自然柔和变化，西装面料光泽细微流动，镜头缓慢推近' },
  { file: 'father-2.jpg', prompt: '男士低头浅笑，眼神缓缓抬起望向镜头，表情自然，黑白画面中光影柔和流动，镜头缓慢推近' },
  { file: 'father-3.jpg', prompt: '男士自信远望，身体重心自然微移，腕表反光细微变化，镜头缓慢环绕' },
  { file: 'mother-1.jpg', prompt: '女士温柔微笑，表情自然柔和变化，缎面礼服光泽轻微流动，项链微光，镜头缓慢推近' },
  { file: 'mother-2.jpg', prompt: '女士回眸浅笑，表情温婉自然，旗袍丝绒光泽轻微流动，窗边光线柔和变化，镜头缓慢环绕' },
  { file: 'mother-3.jpg', prompt: '女士闭眼恬静微笑，表情自然，白色纱裙轻微飘扬，逆光光晕柔和变化，画面梦幻通透' },
  { file: 'child-1.jpg', prompt: '小女孩捧脸开心大笑，眼睛弯成月牙，表情自然生动，高调画面明亮通透，镜头缓慢推近' },
  { file: 'child-2.jpg', prompt: '小女孩惊喜地笑，表情自然，手中彩色气球轻微浮动，彩带微飘，画面活泼，镜头轻微环绕' },
  { file: 'child-3.jpg', prompt: '小女孩抱着故事书抬头微笑，表情自然恬静，毛衣绒毛柔和，画面温暖安静，镜头缓慢推近' },
  { file: 'family-1.jpg', prompt: '一家人相视微笑，爸爸妈妈与小女孩眼神自然交流，表情温馨自然，镜头缓慢推近' },
  { file: 'family-2.jpg', prompt: '爸爸把小女孩轻轻举高，女儿张开手臂大笑，妈妈仰头凝笑，三人视线交汇，画面欢乐生动，镜头轻微环绕' },
  { file: 'family-3.jpg', prompt: '一家三口头靠头看绘本轻声笑语，表情自然温馨，木地板上光影柔和变化，画面静谧，镜头缓慢拉近' }
];

const headers = {
  'X-DashScope-Async': 'enable',
  Authorization: 'Bearer ' + API_KEY,
  'Content-Type': 'application/json'
};

function buildBody(job) {
  const img = PUBLIC_BASE + 'img/' + job.file;
  const input = IS_WAN
    ? { prompt: job.prompt, img_url: img }
    : { prompt: job.prompt, media: [{ url: img }] };
  return { model: MODEL, input, parameters: { resolution: '480P' } };
}

async function submit(job) {
  const res = await fetch(SUBMIT_URL, { method: 'POST', headers, body: JSON.stringify(buildBody(job)) });
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
      console.log(` task=${taskId.slice(0, 8)}…`);
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
