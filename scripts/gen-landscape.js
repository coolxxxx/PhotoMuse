/* ============================================================
 * 风景横幅生成（视差滚动带用）
 * 纯风景无人物：宽幅 1792x1024，暗调电影感，适合暗房主题叠加
 * 输出：output/landscape/<name>.jpg
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const GEN_API = process.env.PM_GEN_API || 'https://api.3213218.xyz/v1/images/generations';
const API_KEY = process.env.PM_GEN_KEY || 'fkall';
const IMG_MODEL = process.env.PM_GEN_MODEL || 'fkall-图像';
const SIZES = ['1792x1024', '1536x1024', '1024x1024'];
const OUT_DIR = path.join(__dirname, '..', 'output', 'landscape');

const BASE =
  '超宽幅电影感风光摄影作品，专业中画幅相机与广角镜头拍摄，纯净画面无任何人物、文字与水印，' +
  'natural light 自然光影层次丰富，low ISO 高清商业画质，color graded 调色统一，构图大气有纵深。';

const SCENES = [
  { name: 'island', prompt: '热带海岛俯瞰：碧蓝分层海水与白色沙滩的优美海岸曲线，椰林摇曳，远处小船留下的白色尾迹，正午清透阳光，航拍视角' },
  { name: 'snow', prompt: '雪山群峰：连绵雪峰在日出的金色光芒中，云海在脚下翻涌，山脊线条锐利，冷蓝阴影与暖金高光对比强烈，辽阔壮美' },
  { name: 'desert', prompt: '沙漠沙丘：连绵起伏的金色沙丘曲线，落日低角度侧光拉出长长阴影，天空纯净渐变，极简大气有韵律感' },
  { name: 'waterfall', prompt: '山涧瀑布：密林深处的多层瀑布倾泻，水雾在晨光中形成柔和光柱，岩石覆着青苔，长曝光流水如丝绸质感' }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function generate(prompt) {
  let lastErr = null;
  for (const size of SIZES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(GEN_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API_KEY },
          body: JSON.stringify({ model: IMG_MODEL, prompt, n: 1, size })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 120));
        const data = await res.json();
        const item = data && Array.isArray(data.data) ? data.data[0] : null;
        const url = item && (item.url || (item.b64_json ? 'data:image/png;base64,' + item.b64_json : null));
        if (!url) throw new Error('无图片');
        const buf = url.startsWith('data:')
          ? Buffer.from(url.split(',')[1], 'base64')
          : Buffer.from(await (await fetch(url)).arrayBuffer());
        if (buf.length < 20000) throw new Error('过小');
        return { buf, size };
      } catch (e) {
        lastErr = e;
        console.log(`    ${size} 重试${attempt + 1}: ${String(e.message).slice(0, 80)}`);
        await sleep(2500);
      }
    }
  }
  throw lastErr;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const only = process.argv[2];
  for (const scene of SCENES) {
    if (only && scene.name !== only) continue;
    const filePath = path.join(OUT_DIR, scene.name + '.jpg');
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 20000 && !process.argv.includes('--force')) {
      console.log(`${scene.name} 已存在跳过`);
      continue;
    }
    process.stdout.write(`${scene.name} 生成中…`);
    const { buf, size } = await generate(BASE + '画面内容：' + scene.prompt);
    fs.writeFileSync(filePath, buf);
    console.log(` 完成 ${(buf.length / 1024).toFixed(0)}KB (${size})`);
    await sleep(1500);
  }
  console.log('全部完成');
}

main().catch(e => { console.error('异常:', e.message); process.exit(1); });
