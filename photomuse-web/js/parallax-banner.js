/* ============================================================
 * 浅焦映像 Web · 视差滚动带（Parallax Banner）
 * 用途：风景大图随滚动产生纵深位移，突出"去不了的地方也能拍"
 * 实现：scroll + rAF，元素进入视口才计算（省性能）
 *       通过 CSS 变量 --px 输出位移量，样式层控制强度
 * 遵循 prefers-reduced-motion（直接不启用）
 * 数据源：/PM/img/landscape/manifest.json
 * ============================================================ */
(function () {
  'use strict';

  var IMG_BASE = '/PM/img/landscape/';
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEFAULT_SLIDES = [
    { file: 'island.jpg', eyebrow: 'MALDIVES · 马尔代夫', title: '海岛', sub: '玻璃海与白沙曲线，航拍视角' },
    { file: 'snow.jpg', eyebrow: 'TIBET · 西藏', title: '雪山', sub: '日照金山，云海在脚下翻涌' },
    { file: 'desert.jpg', eyebrow: 'DUNHUANG · 敦煌', title: '沙漠', sub: '沙丘曲线与落日驼影' },
    { file: 'waterfall.jpg', eyebrow: 'GUILIN · 桂林', title: '瀑布', sub: '密林深处，水雾与光柱' }
  ];

  function buildSlide(slide, index) {
    var sec = document.createElement('section');
    sec.className = 'parallax-band';
    sec.dataset.index = String(index);

    var media = document.createElement('div');
    media.className = 'parallax-media';
    var img = document.createElement('img');
    img.src = IMG_BASE + slide.file;
    img.alt = slide.title || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    media.appendChild(img);

    var overlay = document.createElement('div');
    overlay.className = 'parallax-overlay';

    var copy = document.createElement('div');
    copy.className = 'parallax-copy';
    copy.innerHTML =
      '<p class="parallax-eyebrow">' + slide.eyebrow + '</p>' +
      '<h2 class="parallax-title">' + slide.title + '</h2>' +
      '<p class="parallax-sub">' + slide.sub + '</p>' +
      '<a class="parallax-cta" href="#product-list">把这里拍成我的背景 →</a>';

    sec.appendChild(media);
    sec.appendChild(overlay);
    sec.appendChild(copy);
    sec._media = media;
    sec._copy = copy;
    return sec;
  }

  var bands = [];

  function update() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    bands.forEach(function (band) {
      var rect = band.getBoundingClientRect();
      if (rect.bottom < -vh || rect.top > vh * 2) return; /* 视口外跳过 */
      /* 进度：-1（即将进入）→ 0（居中）→ 1（离开） */
      var progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      progress = Math.max(-1, Math.min(1, progress));
      band._media.style.setProperty('--px', (progress * 22).toFixed(2) + '%');
      band._copy.style.setProperty('--px-copy', (progress * -40).toFixed(1) + 'px');
      band._copy.style.setProperty('--px-fade', String(1 - Math.min(1, Math.abs(progress) * 1.5)));
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      update();
    });
  }

  function init() {
    var mount = document.getElementById('parallax-bands');
    if (!mount) return;
    fetch(IMG_BASE + 'manifest.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (slides) { render(mount, Array.isArray(slides) && slides.length ? slides : DEFAULT_SLIDES); })
      .catch(function () { render(mount, DEFAULT_SLIDES); });
  }

  function render(mount, slides) {
    mount.innerHTML = '';
    bands = slides.map(function (s, i) {
      var band = buildSlide(s, i);
      mount.appendChild(band);
      return band;
    });
    /* reduced-motion：保留静态风景展示（内容不丢），仅禁用位移动效 */
    if (prefersReduced) {
      bands.forEach(function (band) {
        band._media.style.setProperty('--px', '0%');
        band._copy.style.setProperty('--px-copy', '0px');
        band._copy.style.setProperty('--px-fade', '1');
      });
      return;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
