/* ============================================================
 * 浅焦映像 · 宣传样张生成器
 * 用开放生图 API 为 5 个写真主题各生成 3 张宣传样张
 * 产出：output/samples/<themeId>-<n>.jpg + manifest.json
 * 用法：node scripts/gen-samples.js [--theme guofeng] [--count 3]
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const GEN_API = process.env.PM_GEN_API || 'https://api.3213218.xyz/v1/images/generations';
const API_KEY = process.env.PM_GEN_KEY || 'fkall';
const IMG_MODEL = process.env.PM_GEN_MODEL || 'fkall-图像';
const SIZES = ['1024x1792', '1024x1024']; // 首选竖版，失败回退方版

const OUT_DIR = path.join(__dirname, '..', 'output', 'samples');

// 主题 → 人物设定 + 3 个场景（caption 用于小程序/网站样张卡）
const THEMES = [
  {
    themeId: 'guofeng',
    name: '古风写真',
    person: '清秀端庄的年轻亚洲女性，气质温婉，盘发',
    shots: [
      {
        caption: '园林长廊 · 水墨意境',
        prompt: '古风人像摄影：清秀端庄的年轻亚洲女性身着素雅汉服，立于苏州园林长廊，回眸浅笑，远处叠石假山与留白粉墙，水墨画意境，柔和自然光，浅景深，专业写真级构图，全身像'
      },
      {
        caption: '竹林溪水 · 油纸伞',
        prompt: '古风人像摄影：清秀端庄的年轻亚洲女性身着淡青色汉服，手执油纸伞立于翠竹林间小溪旁，薄雾缭绕，侧逆光勾勒轮廓，电影感色调，三分之二构图'
      },
      {
        caption: '庭院月下 · 抚琴',
        prompt: '古风人像摄影：清秀端庄的年轻亚洲女性身着月白色汉服，庭院中抚琴，烛光与月光交织，暖冷对比光影，古典氛围，特写与中景结合'
      }
    ]
  },
  {
    themeId: 'sports',
    name: '运动活力',
    person: '健康阳光的年轻亚洲男性，短发，身姿挺拔',
    shots: [
      {
        caption: '球场瞬间 · 高对比光影',
        prompt: '运动人像摄影：健康阳光的年轻亚洲男性穿篮球背心，球场边持球而立，汗水微光，高对比硬光，动感低机位仰拍，城市球场背景虚化'
      },
      {
        caption: '街头少年 · 滑板随拍',
        prompt: '街头运动摄影：健康阳光的年轻亚洲男性穿宽松运动卫衣，怀抱滑板倚在涂鸦墙边，傍晚黄金时刻侧光，胶片颗粒感，街头潮流风'
      },
      {
        caption: '夜跑城市 · 霓虹光影',
        prompt: '运动夜景人像：健康阳光的年轻亚洲男性穿速干运动服在城市跑道夜跑瞬间，背景霓虹灯虚化成光斑，慢门拖影边缘，活力四射'
      }
    ]
  },
  {
    themeId: 'casual',
    name: '休闲日常',
    person: '笑容甜美的年轻亚洲女性，微卷长发',
    shots: [
      {
        caption: '咖啡店窗边 · 自然光',
        prompt: '生活方式人像摄影：笑容甜美的年轻亚洲女性穿米色针织衫坐在咖啡店窗边，捧杯微笑，午后自然光洒落，暖调浅景深，日系清新感'
      },
      {
        caption: '居家时光 · 松弛感',
        prompt: '居家生活摄影：笑容甜美的年轻亚洲女性穿浅色家居服窝在沙发看书，毛毯与绿植点缀，窗边柔光，温暖松弛的氛围，室内环境人像'
      },
      {
        caption: '街头随拍 · 氛围感',
        prompt: '街头随拍人像：笑容甜美的年轻亚洲女性穿简约牛仔外套漫步街道回眸，背景商铺虚化，抓拍自然瞬间，胶片色调，轻松氛围感'
      }
    ]
  },
  {
    themeId: 'travel',
    name: '旅拍风光',
    person: '气质大方的年轻亚洲女性，长直发',
    shots: [
      {
        caption: '海边日落 · 大场景',
        prompt: '旅拍人像摄影：气质大方的年轻亚洲女性穿白色长裙站在海边礁石上，裙摆与长发随风飘扬，金色日落逆光剪影质感，广角大场景海天一线'
      },
      {
        caption: '古镇石巷 · 慢时光',
        prompt: '旅拍人像摄影：气质大方的年轻亚洲女性穿棉麻长裙走在青石板古镇小巷，红灯笼与老墙背景，柔和散射光，纵深感构图，宁静慢时光'
      },
      {
        caption: '山野草原 · 风的自由',
        prompt: '旅拍人像摄影：气质大方的年轻亚洲女性穿户外风衣立于山野草原高处远眺，云海翻涌，广角大气构图，清晨侧光，自由辽阔感'
      }
    ]
  },
  {
    themeId: 'family',
    name: '亲子合照',
    person: '温馨的年轻亚洲三口之家，爸爸妈妈与5岁女孩',
    shots: [
      {
        caption: '草坪互动 · 欢笑瞬间',
        prompt: '亲子家庭摄影：温馨的年轻亚洲三口之家在公园草坪上嬉戏互动，爸爸妈妈把5岁女儿高高举起，三人开怀大笑，午后暖阳，抓拍真实瞬间'
      },
      {
        caption: '窗边相拥 · 暖调时光',
        prompt: '家庭室内摄影：温馨的年轻亚洲三口之家在洒满阳光的窗边相拥而坐，妈妈抱着5岁女儿，爸爸侧身贴近，奶油色暖调，幸福感满溢'
      },
      {
        caption: '全家福 · 经典站位',
        prompt: '全家福摄影：温馨的年轻亚洲三口之家穿浅色系亲子装，经典全家福站位，素雅背景，专业影棚布光，端庄微笑，收藏级质感'
      }
    ]
  }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function generateOne(shot, index) {
  let lastErr = null;
  for (const size of SIZES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const body = JSON.stringify({ model: IMG_MODEL, prompt: shot.prompt, n: 1, size });
        const res = await fetch(GEN_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API_KEY },
          body
        });
        if (!res.ok) { throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200)); }
        const data = await res.json();
        const item = data && Array.isArray(data.data) ? data.data[0] : null;
        const url = item && (item.url || (item.b64_json ? 'data:image/png;base64,' + item.b64_json : null));
        if (!url) { throw new Error('响应无图片: ' + JSON.stringify(data).slice(0, 200)); }
        const buf = url.startsWith('data:')
          ? Buffer.from(url.split(',')[1], 'base64')
          : Buffer.from(await (await fetch(url)).arrayBuffer());
        if (buf.length < 20000) { throw new Error('图片过小 ' + buf.length + 'B'); }
        return { buf, size };
      } catch (e) {
        lastErr = e;
        console.log(`      重试（size=${size} #${attempt + 1}）：${String(e.message).slice(0, 120)}`);
        await sleep(3000);
      }
    }
  }
  throw lastErr || new Error('生成失败');
}

async function main() {
  const args = process.argv.slice(2);
  const themeArg = (args[args.indexOf('--theme') + 1] || '').trim();
  const countArg = parseInt(args[args.indexOf('--count') + 1], 10) || 3;
  const themes = THEMES.filter(t => !themeArg || t.themeId === themeArg);
  if (!themes.length) { console.error('未知主题: ' + themeArg); process.exit(1); }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];

  for (const theme of themes) {
    console.log(`\n== ${theme.name}（${theme.themeId}）==`);
    const shots = theme.shots.slice(0, countArg);
    for (let i = 0; i < shots.length; i++) {
      const file = `${theme.themeId}-${i + 1}.jpg`;
      const filePath = path.join(OUT_DIR, file);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 20000) {
        console.log(`  [${i + 1}/${shots.length}] 已存在，跳过：${file}`);
      } else {
        process.stdout.write(`  [${i + 1}/${shots.length}] 生成中…`);
        const { buf, size } = await generateOne(shots[i], i);
        fs.writeFileSync(filePath, buf);
        console.log(` 完成 ${(buf.length / 1024).toFixed(0)}KB（${size}）`);
        await sleep(2000);
      }
      // manifest 记录（幂等：按 file 去重更新）
      const sortOrder = THEMES.findIndex(t => t.themeId === theme.themeId) * 10 + i + 1;
      const rec = {
        file,
        cloudPath: `ai-studio/samples/${file}`,
        themeId: theme.themeId,
        themeName: theme.name,
        caption: shots[i].caption,
        sortOrder
      };
      const at = manifest.findIndex(m => m.file === file);
      if (at >= 0) { manifest[at] = rec; } else { manifest.push(rec); }
    }
  }

  manifest.sort((a, b) => a.sortOrder - b.sortOrder);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nmanifest 已更新（${manifest.length} 条）：${manifestPath}`);
}

main().catch(err => { console.error('执行异常:', err); process.exit(1); });
