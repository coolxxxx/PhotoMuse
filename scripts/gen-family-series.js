/* ============================================================
 * 光影集 PhotoMuse · 影楼级家庭系列样张生成器
 * 同一三口之家（固定人物锚点保证跨图一致性）× 四套影楼经典风格
 *   father  绅士商务套（深灰背景/伦勃朗光/西装）
 *   mother  唯美妆造套（暖调/蝴蝶光/礼服）
 *   child   童趣高调套（亮背景/柔和光/童装）
 *   family  亲子合照套（同色系亲子装/影棚互动）
 * 方法论来源：photodesign-skill（器材+参数+光照角度）、
 *             rembrandt-portrait-lighting（光比/明暗 modeling）
 * 用法：node scripts/gen-family-series.js [--set father] [--index 1] [--all]
 * 输出：output/family-series/<set>-<n>.jpg + manifest.json
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const GEN_API = process.env.PM_GEN_API || 'https://api.3213218.xyz/v1/images/generations';
const API_KEY = process.env.PM_GEN_KEY || 'fkall';
const IMG_MODEL = process.env.PM_GEN_MODEL || 'fkall-图像';
const SIZE = '1024x1792';
const OUT_DIR = path.join(__dirname, '..', 'output', 'family-series');

/* ---------- 人物一致性锚点（每个 prompt 原样复用） ---------- */
const DAD = '35岁亚洲男性，浓眉，方正脸型，下颌线硬朗，利落黑色短发微微背头，身形挺拔肩宽';
const MOM = '32岁亚洲女性，鹅蛋脸，杏眼，肤色白皙细腻，深棕色大波浪长卷发，妆容精致，气质温婉优雅';
const KID = '5岁亚洲小女孩，圆脸，大眼睛长睫毛，皮肤白嫩，齐刘海配两个小丸子头，天真灿烂的笑容';

/* ---------- 影楼质感基座（每张 prompt 都带） ---------- */
const STUDIO_BASE =
  '高端精修人像照片的最终成品：画面中只有被拍摄的人物本身和一面干净的纯色渐变背景墙，没有其他任何物体、家具或人物。' +
  '人物面部受光均匀立体（一侧主光一侧柔过渡，伦勃朗式明暗），发丝有柔和的轮廓光，眼神光明亮，' +
  'Shot on medium format camera with 85mm portrait lens，浅景深背景自然柔化，' +
  'low ISO 商业数码画质，professional color grading and skin retouching 精修：肤色均匀保留真实纹理，magazine cover quality。';

/* ---------- 四套系列 ---------- */
const SERIES = [
  {
    setId: 'father',
    setName: '绅士商务 · 爸爸单人套',
    shots: [
      {
        caption: '深灰绅士 · 伦勃朗光',
        prompt: `${STUDIO_BASE}。半身正式肖像：${DAD}，穿剪裁合体的深炭色三件套西装配酒红色领带，坐在复古皮椅上，身体微侧四分之三角度，目视镜头沉稳微笑。Rembrandt lighting 伦勃朗布光：主光从画面左侧 45° 高位俯照形成伦勃朗式明暗，4:1 key-to-fill ratio 光比，暗部细节保留，发丝轮廓光 hair light 勾出肩线，深灰色 seamless gradient background 由亮到暗自然过渡。黑白灰高级色调，背景与西装深浅呼应，成功男士杂志封面质感。`
      },
      {
        caption: '黑白经典 · 侧光特写',
        prompt: `${STUDIO_BASE}。胸像特写：${DAD}，穿白色衬衫挽起袖口，未系领带，单手轻扣袖扣低头浅笑，眼神向下思考感。Split side lighting 侧逆光硬朗布光：主光从画面右侧 90° 侧照，明暗交界线清晰刻画面部轮廓与下颌线，眼神光 catchlight 保留，纯深色背景背景光微弱分离肩线。黑白 monochrome 处理，高对比但层次丰富，经典男士香水广告质感。`
      },
      {
        caption: '商务立姿 · 全身 power shot',
        prompt: `${STUDIO_BASE}。全身立姿：${DAD}，深藏青色修身西装单手插袋，另一手持腕表轻抬看时间，双腿微分重心沉稳，自信远望。Butterfly lighting 蝶形光配 15° 高位主光，.fullName soft fill 补光柔和，浅灰无缝背景 pure light gray backdrop，地面接触阴影自然。整体高调干净，商务人像站立 power pose，财富杂志人物专访质感。`
      }
    ]
  },
  {
    setId: 'mother',
    setName: '唯美妆造 · 妈妈单人套',
    shots: [
      {
        caption: '香槟礼服 · 蝶形柔光',
        prompt: `${STUDIO_BASE}。半身优雅肖像：${MOM}，穿香槟色缎面一字肩礼服，颈部佩戴细珍珠项链，头发半盘留出柔美碎发，下巴微低目光温柔直视镜头，嘴角含笑。Butterfly lighting 蝶形光：主光从正面高位 15° 俯照，鼻下产生标志性的对称蝶形阴影，双眼神采点亮，4:1 光比，发丝轮廓光 rim light 从后方 135° 勾出金色发丝光晕。浅米色无缝背景，暖调高级，婚礼杂志封面质感。`
      },
      {
        caption: '旗袍国风 · 窗边光影',
        prompt: `${STUDIO_BASE}。影楼国风场景：${MOM}，穿改良暗红色丝绒旗袍，盘发配珍珠发簪，侧坐于影棚内搭的中式木窗格旁，一手轻抚窗棂回眸，眼神含蓄浅笑。Window light 大面积窗光效果从画面左侧 60° 透入，明暗过渡如油画，4:1 光比，暗部酒红与暖棕交融。深咖色背景配竹影投墙，中式审美，国风人像大片质感。`
      },
      {
        caption: '白纱梦幻 · 逆光发丝',
        prompt: `${STUDIO_BASE}。梦幻逆光肖像：${MOM}，穿轻盈白色纱裙，长发披肩自然微扬，闭眼仰头享受光线的恬静表情，双手轻拢发丝。Strong backlight 180° 白色逆光穿透发丝形成 halo 光晕，正面柔和补光均匀照亮面部，1.5:1 低光比高调布光，纯白高调背景 white high-key backdrop 轻微过曝质感。整体纯净通透梦幻，婚纱写真馆镇店样片质感。`
      }
    ]
  },
  {
    setId: 'child',
    setName: '童趣高调 · 小孩单人套',
    shots: [
      {
        caption: '高调笑脸 · 明亮经典',
        prompt: `${STUDIO_BASE}。经典儿童影棚肖像：${KID}，穿奶黄色针织毛衣配白色翻领衬衫，坐在影棚彩色小木凳上，双手捧脸开心的大笑，眼睛弯成月牙。High-key lighting 高调布光：左右两侧 45° 对称柔光打亮，正面白发丝光，2:1 低光比几乎无影，纯白色无缝背景 pure white backdrop。画面通透明亮，色彩温柔，高端儿童摄影机构经典样片质感。`
      },
      {
        caption: '气球互动 · 动态抓拍',
        prompt: `${STUDIO_BASE}。动态互动：${KID}，穿浅蓝色背带裤配白色T恤，手握一把彩色气球束踮脚前倾，气球微微飘起带动身体，表情惊喜兴奋，头发和衣角有动感。柔和顶光 soft top light 配四周均匀补光，浅粉蓝渐变背景 pastel gradient backdrop。抓拍瞬间的生动感但光效是专业影棚级，色彩明快，儿童品牌广告大片质感。`
      },
      {
        caption: '恬静阅读 · 情绪小大人',
        prompt: `${STUDIO_BASE}。情绪感儿童肖像：${KID}，穿米白色毛绒开衫，盘腿坐在影棚复古小沙发上抱着一本翻开的故事书，抬头望向画面外若有所思，睫毛低垂。Rembrandt soft lighting 柔和伦勃朗光从画面右侧 45° 照入，面部立体但阴影柔，3:1 光比，发丝光勾边。暖灰色无缝背景，沉稳的暖棕色调，电影感儿童情绪肖像，获奖儿童摄影作品质感。`
      }
    ]
  },
  {
    setId: 'family',
    setName: '亲子合照 · 全家福套',
    shots: [
      {
        caption: '经典全家福 · 三代传承感',
        prompt: `${STUDIO_BASE}。经典影楼全家福构图：${DAD}穿白衬衫配深灰马甲，${MOM}穿米白色针织连衣裙，${KID}穿白色小裙子，三人站位为爸爸妈妈并肩坐着女儿被抱在中间，额头相贴排成一排微笑看镜头。正面高位蝶形柔光均匀打亮，2:1 低光比，浅驼色无缝背景 warm beige backdrop，发丝光柔美。色调统一温暖，构图端正饱满，高端家庭摄影经典款质感。`
      },
      {
        caption: '举高高 · 欢笑互动',
        prompt: `${STUDIO_BASE}。动态亲子互动：${DAD}穿浅灰卫衣将${KID}穿白色小裙子高高举起过头顶，女儿张开双臂大笑，妈妈${MOM}穿同色系米白毛衣在旁挽着爸爸手臂仰头凝笑，三人视线交汇于孩子。侧面 45° 主光配正面补光，3:1 光比，浅灰蓝无缝背景。生动自然的欢乐瞬间但布光专业，亲子海报级质感。`
      },
      {
        caption: '地排相依 · 温馨俯拍',
        prompt: `${STUDIO_BASE}。影棚地排合影：标准的四口之家幸福画面——一位短发男性父亲和一位长发女性母亲（夫妻二人，一男一女）带着他们的女儿，绝对只有这三个人。三人穿同色系奶油白与浅驼色亲子装，并排坐在无缝背景纸前的木地板上，${KID}坐在中间被爸爸妈妈环在怀里，三人头靠头低头看同一本绘本，只看到饱满的头顶漩和依偎的肩线。顶部柔和俯光 soft top light，四周均匀无硬影，暖白背景。亲密无间的家庭氛围，极简高级，北欧家庭摄影美学质感。`
      }
    ]
  }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function generateOne(prompt) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(GEN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + API_KEY },
        body: JSON.stringify({ model: IMG_MODEL, prompt, n: 1, size: SIZE })
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
      return buf;
    } catch (e) {
      lastErr = e;
      console.log(`      重试#${attempt + 1}：${String(e.message).slice(0, 120)}`);
      await sleep(3000);
    }
  }
  throw lastErr || new Error('生成失败');
}

async function main() {
  const args = process.argv.slice(2);
  const setIdx = args.indexOf('--set');
  const setArg = setIdx >= 0 ? (args[setIdx + 1] || '').trim() : '';
  const indexIdx = args.indexOf('--index');
  const indexArg = indexIdx >= 0 ? parseInt(args[indexIdx + 1], 10) || 0 : 0;
  const runAll = args.includes('--all');
  const sets = SERIES.filter(s => !setArg || s.setId === setArg);
  if (!sets.length) { console.error('未知套系: ' + setArg); process.exit(1); }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];

  for (const set of sets) {
    console.log(`\n== ${set.setName}（${set.setId}）==`);
    const shots = set.shots
      .map((s, i) => ({ ...s, no: i + 1 }))
      .filter(s => !indexArg || s.no === indexArg);
    for (const shot of shots) {
      const file = `${set.setId}-${shot.no}.jpg`;
      const filePath = path.join(OUT_DIR, file);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 20000 && !args.includes('--force')) {
        console.log(`  [${shot.no}] 已存在，跳过：${file}`);
      } else {
        process.stdout.write(`  [${shot.no}] ${shot.caption} 生成中…`);
        const buf = await generateOne(shot.prompt);
        fs.writeFileSync(filePath, buf);
        console.log(` 完成 ${(buf.length / 1024).toFixed(0)}KB`);
        await sleep(2000);
      }
      const sortOrder = 50 + SERIES.findIndex(s => s.setId === set.setId) * 10 + shot.no;
      const rec = {
        file,
        cloudPath: `ai-studio/samples/${file}`,
        themeId: 'family',
        themeName: set.setName,
        caption: shot.caption,
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
