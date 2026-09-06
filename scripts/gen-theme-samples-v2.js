/* ============================================================
 * 浅焦映像 · 主题样张生成器 v2（影楼配方）
 * 4 个老主题（古风/运动/休闲/旅拍）× 每主题固定人设 × 3 场景
 * 方法论：photodesign-skill（器材参数语言）+ rembrandt（光比）
 * 关键经验：场景词全剥离（不提影棚/灯具），只写画面+光效结果
 * 输出：output/theme-samples/<themeId>-<n>.jpg + manifest.json
 * 用法：node scripts/gen-theme-samples-v2.js [--theme guofeng]
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const GEN_API = process.env.PM_GEN_API || 'https://api.3213218.xyz/v1/images/generations';
const API_KEY = process.env.PM_GEN_KEY || 'fkall';
const IMG_MODEL = process.env.PM_GEN_MODEL || 'fkall-图像';
const SIZE = '1024x1792';
const OUT_DIR = path.join(__dirname, '..', 'output', 'theme-samples');

/* 影楼质感基座（家庭系列实测有效措辞） */
const BASE =
  '高端精修人像照片的最终成品：画面中只有被拍摄的人物本身和所处环境，没有其他任何无关人物或物体。' +
  '人物面部受光均匀立体（一侧主光一侧柔和过渡，伦勃朗式明暗层次），发丝有柔和的轮廓光，眼神光明亮，' +
  'Shot on medium format camera with 85mm portrait lens，浅景深背景自然柔化，' +
  'low ISO 商业数码画质，professional color grading and skin retouching 精修：肤色均匀保留真实纹理，magazine cover quality。';

/* 每主题固定人设（跨图一致性锚点）+ 3 个场景 */
const THEMES = [
  {
    themeId: 'guofeng',
    name: '古风写真',
    person: '清丽温婉的年轻亚洲女性，鹅蛋脸杏眼肤白，乌黑长发绾成低髻配素银步摇',
    shots: [
      { caption: '园林回眸 · 水墨意境', prompt: '素雅月白汉服立于苏州园林长廊，手执纨扇回眸浅笑，远处粉墙黛瓦与假山虚化成水墨留白' },
      { caption: '竹林抚琴 · 侧逆光', prompt: '淡青色襦裙坐于竹林溪水边抚琴，侧逆光穿透竹叶在肩头洒下光斑，薄雾缭绕意境悠远' },
      { caption: '庭院灯下 · 暖夜调', prompt: '绯红色汉服披帛立于中式庭院灯笼下，暖光映面与冷夜色对比，眼神低垂含笑，古典画意' }
    ]
  },
  {
    themeId: 'sports',
    name: '运动活力',
    person: '阳光挺拔的年轻亚洲男性，短寸头轮廓分明，下颌线清晰，健康小麦肤色',
    shots: [
      { caption: '球场硬光 · 低位仰拍', prompt: '无袖球衣持球立于室外球场，傍晚硬朗侧光雕塑肌肉线条，低机位仰拍背景球场虚化' },
      { caption: '街头滑板 · 黄金时刻', prompt: '宽松卫衣怀抱滑板倚靠涂鸦墙，黄金时刻侧光打亮轮廓，胶片质感色调松弛有型' },
      { caption: '夜跑霓虹 · 动感光斑', prompt: '速干运动装夜跑瞬间，背景城市霓虹虚化成光斑，轮廓光勾出汗水高光，活力动感' }
    ]
  },
  {
    themeId: 'casual',
    name: '休闲日常',
    person: '甜美松弛的年轻亚洲女性，微卷锁骨发，笑眼弯弯梨涡浅浅',
    shots: [
      { caption: '咖啡窗边 · 午后柔光', prompt: '米色针织衫坐于咖啡店窗边捧杯微笑，午后柔光洒落发丝，暖调浅景深日系清新' },
      { caption: '居家沙发 · 治愈时刻', prompt: '奶白色家居服窝在沙发抱枕间看书浅笑，窗边柔光配绿植点缀，温暖治愈氛围' },
      { caption: '街角回眸 · 胶片感', prompt: '牛仔外套漫步街角回眸浅笑，背景店铺虚化成光斑，胶片色调轻松随性' }
    ]
  },
  {
    themeId: 'travel',
    name: '旅拍风光',
    person: '气质大方的年轻亚洲女性，黑长直发，五官明净淡妆',
    shots: [
      { caption: '海边日落 · 逆光剪影', prompt: '白色长裙立于海边礁石，裙摆长发随风轻扬，金色日落逆光勾勒轮廓，广角海天一线' },
      { caption: '古镇石巷 · 红灯笼', prompt: '棉麻长裙走在青石板古镇小巷，红灯笼与老墙背景，柔和散射光纵深感构图' },
      { caption: '山野草原 · 辽阔晨光', prompt: '卡其色风衣立于草原高处远眺，云海翻涌晨光侧照，广角大气构图自由辽阔' }
    ]
  },
  {
    themeId: 'professional',
    name: '职业形象照',
    person: '干练精致的年轻亚洲女性，齐肩直发妆容利落，肩线挺括',
    shots: [
      { caption: '深灰西装 · 封面布光', prompt: '深灰色修身西装立于中灰渐变背景前，双臂自然交叠，杂志封面级正面布光，眼神坚定自信' },
      { caption: '白衬衫 · 侧光半身', prompt: '白衬衫配西裤侧身而立，单手轻扶衣领，侧光勾勒面部轮廓，背景极简干净' },
      { caption: '办公室景 · 玻璃光影', prompt: '藏蓝西装套装坐在现代办公室玻璃幕墙前，城市天际线虚化，自然侧光知性从容' }
    ]
  },
  {
    themeId: 'retro',
    name: '港风复古',
    person: '浓颜明艳的年轻亚洲女性，复古波浪卷发红唇，气质张扬明媚',
    shots: [
      { caption: '霓虹夜色 · 胶片颗粒', prompt: '红色丝绒衬衫立于夜晚霓虹招牌下，暖黄灯光打亮侧脸，胶片颗粒质感复古摩登' },
      { caption: '百叶窗 · 暖黄光影', prompt: '白色吊带配高腰牛仔裤倚坐窗边百叶窗旁，条状光影洒在面部与肩头，慵懒明艳' },
      { caption: '老式话筒 · 画报感', prompt: '碎花连衣裙站在老式话筒与唱片机旁，回眸一笑，复古画报构图暖调浓郁' }
    ]
  },
  {
    themeId: 'sino',
    name: '新中式',
    person: '清雅知性的年轻亚洲女性，黑长发低马尾，妆容淡雅气质如兰',
    shots: [
      { caption: '茶席执壶 · 温润木色', prompt: '改良盘扣上衣坐于原木茶席前执壶斟茶，茶烟袅袅，温润木色与留白构图东方雅致' },
      { caption: '绢本屏风 · 剪影意境', prompt: '香云纱长裙立于绢本屏风前，屏风花枝剪影与人物相映，侧光柔和意境幽远' },
      { caption: '圆窗框景 · 国潮撞色', prompt: '靛蓝新中式外套立于中式圆窗框景前，窗外交竹虚化，国潮色彩搭配端庄大气' }
    ]
  },
  {
    themeId: 'french',
    name: '法式油画',
    person: '优雅浓郁的年轻亚洲女性，深棕色大波浪卷发，五官立体妆容精致',
    shots: [
      { caption: '宫廷窗帘 · 油画色温', prompt: '香槟色缎面礼服立于复古宫廷窗帘旁，烛台与暖光呼应，油画色温古典布光' },
      { caption: '蕾丝团扇 · 老宅光影', prompt: '黑色蕾丝长裙坐于法式老宅丝绒扶手椅，手持蕾丝团扇，窗光柔和质感浓郁' },
      { caption: '花拱门 · 柔焦梦境', prompt: '裸色纱裙立于玫瑰花拱门下，花瓣飘落，柔焦光晕梦幻浪漫如古典油画' }
    ]
  },
  {
    themeId: 'film',
    name: '胶片电影',
    person: '故事感十足的年轻亚洲女性，黑色中长发自然披散，气质安静',
    shots: [
      { caption: '雨后站台 · 叙事留白', prompt: '浅色风衣立于雨后公交站台，手握车票远望，湿漉地面反光，电影叙事构图留白' },
      { caption: '便利店 · 夜色荧光', prompt: '卫衣站在深夜便利店门口，店内荧光灯照亮侧脸，手中热饮冒热气，都市孤独感' },
      { caption: '天台晚风 · 黄金时刻', prompt: '白衬衫坐在天台边缘回望镜头，晚风吹起发丝，夕阳黄金时刻暖光，青春故事感' }
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
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + (await res.text()).slice(0, 150));
      const data = await res.json();
      const item = data && Array.isArray(data.data) ? data.data[0] : null;
      const url = item && (item.url || (item.b64_json ? 'data:image/png;base64,' + item.b64_json : null));
      if (!url) throw new Error('响应无图片');
      const buf = url.startsWith('data:')
        ? Buffer.from(url.split(',')[1], 'base64')
        : Buffer.from(await (await fetch(url)).arrayBuffer());
      if (buf.length < 20000) throw new Error('图片过小');
      return buf;
    } catch (e) {
      lastErr = e;
      console.log(`      重试#${attempt + 1}: ${String(e.message).slice(0, 100)}`);
      await sleep(3000);
    }
  }
  throw lastErr;
}

async function main() {
  const args = process.argv.slice(2);
  const themeIdx = args.indexOf('--theme');
  const only = themeIdx >= 0 ? args[themeIdx + 1] : '';
  const themes = THEMES.filter(t => !only || t.themeId === only);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];

  for (const theme of themes) {
    console.log(`\n== ${theme.name}（${theme.themeId}）==`);
    for (let i = 0; i < theme.shots.length; i++) {
      const shot = theme.shots[i];
      const file = `${theme.themeId}-${i + 1}.jpg`;
      const filePath = path.join(OUT_DIR, file);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 20000 && !args.includes('--force')) {
        console.log(`  [${i + 1}] 已存在，跳过`);
      } else {
        process.stdout.write(`  [${i + 1}] ${shot.caption} 生成中…`);
        const buf = await generateOne(`${BASE}。画面内容：${theme.person}，${shot.prompt}。构图完整，人物神态自然生动。`);
        fs.writeFileSync(filePath, buf);
        console.log(` 完成 ${(buf.length / 1024).toFixed(0)}KB`);
        await sleep(2000);
      }
      const rec = {
        file,
        cloudPath: `img/samples/${file}`,
        themeId: theme.themeId,
        themeName: theme.name,
        caption: shot.caption,
        sortOrder: THEMES.findIndex(t => t.themeId === theme.themeId) * 10 + i + 1
      };
      const at = manifest.findIndex(m => m.file === file);
      if (at >= 0) manifest[at] = rec; else manifest.push(rec);
    }
  }
  manifest.sort((a, b) => a.sortOrder - b.sortOrder);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nmanifest ${manifest.length} 条: ${manifestPath}`);
}

main().catch(e => { console.error('执行异常:', e.message); process.exit(1); });
