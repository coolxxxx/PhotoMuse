/* ============================================================
 * 浅焦映像 Web · 动态影廊（AI 图生视频）
 * 数据源：/PM/vid/manifest.json（脚本生成：文件+caption）
 * 行为：滚动进入视口才开始加载与播放（循环静音）；离开视口暂停
 * 降级：无视频时显示静态样张图（/PM/img/）
 * ============================================================ */
(function () {
  'use strict';

  var VID_BASE = '/PM/vid/';
  var IMG_BASE = '/PM/img/';

  function buildItem(entry) {
    var item = document.createElement('div');
    item.className = 'motion-item';
    var vid = document.createElement('video');
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.preload = 'none';
    vid.setAttribute('muted', '');
    vid.setAttribute('playsinline', '');
    vid.setAttribute('loop', '');
    vid.dataset.src = VID_BASE + entry.file;
    var img = document.createElement('img');
    img.src = IMG_BASE + entry.poster;
    img.alt = entry.caption || '';
    img.loading = 'lazy';
    var badge = document.createElement('span');
    badge.className = 'motion-badge';
    badge.textContent = 'LIVE';
    var cap = document.createElement('div');
    cap.className = 'motion-caption';
    cap.textContent = entry.caption || '';
    item.appendChild(vid);
    item.appendChild(img);
    item.appendChild(badge);
    item.appendChild(cap);
    return item;
  }

  function observeItems(items) {
    /* 兼容方案：scroll+rect 手动检测（部分内嵌环境 IntersectionObserver
       对动态插入元素不触发回调），节流 300ms */
    var timer = null;
    function check() {
      timer = null;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      items.forEach(function (item) {
        if (item.dataset.checked) return;
        var rect = item.getBoundingClientRect();
        if (rect.top < vh * 0.92 && rect.bottom > 0) {
          item.dataset.checked = '1';
          startItem(item);
          var vid = item.querySelector('video');
          if (vid) vid.play().catch(function () {});
        }
      });
      if (!timer && items.every(function (i) { return i.dataset.checked; })) {
        window.removeEventListener('scroll', onScroll);
      }
    }
    function onScroll() {
      if (timer) return;
      timer = setTimeout(check, 300);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    check();
    setTimeout(check, 800);
  }

  function startItem(item) {
    var vid = item.querySelector('video');
    if (!vid || item.classList.contains('video-failed')) return;
    if (vid.preload !== 'none' && vid.querySelector('source')) return; // 已初始化
    var src = document.createElement('source');
    src.src = vid.dataset.src;
    src.type = 'video/mp4';
    vid.appendChild(src);
    vid.preload = 'auto';
    vid.addEventListener('loadeddata', function () {
      vid.classList.add('ready');
      item.classList.add('playing');
    });
    vid.addEventListener('error', function () {
      item.classList.add('video-failed'); // 静态图兜底（img 一直在下层）
      item.classList.remove('playing');
    });
    vid.load();
  }

  function init() {
    var grid = document.getElementById('motion-grid');
    if (!grid) return;
    fetch(VID_BASE + 'manifest.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (entries) {
        grid.innerHTML = '';
        if (!Array.isArray(entries) || !entries.length) { grid.closest('#motion-gallery').style.display = 'none'; return; }
        var items = entries.map(buildItem);
        items.forEach(function (item) { grid.appendChild(item); });
        observeItems(items);
      })
      .catch(function () { grid.closest('#motion-gallery').style.display = 'none'; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
