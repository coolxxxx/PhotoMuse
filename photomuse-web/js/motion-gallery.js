/* ============================================================
 * 浅焦映像 Web · 动态影廊（AI 图生视频）
 * 数据源：/PM/vid/manifest.json（脚本生成：文件+caption）
 * 行为：默认只显示静态样张；进视口后限流后台预载（不 play）
 *       桌面 hover / 触屏点按才播放；全局最多 1 路在播
 * 降级：无视频/失败时显示静态样张图（/PM/img/）
 * ============================================================ */
(function () {
  'use strict';

  var VID_BASE = '/PM/vid/';
  var IMG_BASE = '/PM/img/';
  var PRELOAD_MAX = 1; /* 同时后台缓冲条数：1 条优先保证滚动流畅 */
  /* 统一动效开关：用户在本站的选择优先于系统偏好（见 js/motion-pref.js） */
  var prefersReduced = (typeof window.PM_MOTION_ON === 'boolean') ? !window.PM_MOTION_ON : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var items = [];
  var preloadQueue = [];
  var preloading = 0;
  var activeVideo = null;
  var activeItem = null;
  var scrollTimer = null;

  function buildItem(entry) {
    var item = document.createElement('div');
    item.className = 'motion-item';
    item.dataset.src = VID_BASE + entry.file;

    var vid = document.createElement('video');
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.preload = 'none';
    vid.setAttribute('muted', '');
    vid.setAttribute('playsinline', '');
    vid.setAttribute('loop', '');
    vid.setAttribute('aria-hidden', 'true');

    var img = document.createElement('img');
    img.src = IMG_BASE + entry.poster;
    img.alt = entry.caption || '';
    img.loading = 'lazy';
    img.decoding = 'async';

    var badge = document.createElement('span');
    badge.className = 'motion-badge';
    badge.textContent = 'LIVE';
    badge.setAttribute('aria-hidden', 'true');

    var cap = document.createElement('div');
    cap.className = 'motion-caption';
    cap.textContent = entry.caption || '';

    item.appendChild(vid);
    item.appendChild(img);
    item.appendChild(badge);
    item.appendChild(cap);
    item._video = vid;
    return item;
  }

  function ensureVideo(item) {
    var vid = item._video;
    if (!vid || item.classList.contains('video-failed')) return null;
    if (vid.dataset.loaded === '1' || vid.dataset.loading === '1') return vid;

    vid.dataset.loading = '1';
    /* auto：进队列后完整缓冲，hover 时可立刻播；并发由 PRELOAD_MAX 控制 */
    vid.preload = 'auto';
    vid.src = item.dataset.src;
    vid.addEventListener('loadeddata', function () {
      vid.dataset.loaded = '1';
      vid.dataset.loading = '';
      vid.classList.add('ready');
      item.classList.remove('preload-pending');
      item.classList.add('preload-ready');
    }, { once: true });
    vid.addEventListener('error', function () {
      vid.dataset.loading = '';
      item.classList.add('video-failed');
      item.classList.remove('preload-pending', 'preload-ready', 'playing', 'playing-intent');
      if (activeVideo === vid) stopItem(item);
    }, { once: true });
    vid.load();
    item.classList.add('preload-pending');
    return vid;
  }

  function pumpPreload() {
    while (preloading < PRELOAD_MAX && preloadQueue.length) {
      var item = preloadQueue.shift();
      if (!item || item.classList.contains('video-failed')) continue;
      if (item._video && (item._video.dataset.loaded === '1' || item._video.dataset.loading === '1')) continue;
      preloading++;
      (function (it) {
        var vid = ensureVideo(it);
        if (!vid) { preloading--; pumpPreload(); return; }
        var done = function () {
          preloading--;
          vid.removeEventListener('loadeddata', done);
          vid.removeEventListener('error', done);
          pumpPreload();
        };
        if (vid.readyState >= 2) {
          setTimeout(done, 0);
        } else {
          vid.addEventListener('loadeddata', done, { once: true });
          vid.addEventListener('error', done, { once: true });
        }
      })(item);
    }
  }

  function enqueueVisible() {
    if (prefersReduced) return;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var gallery = document.getElementById('motion-gallery');
    var galleryRect = gallery ? gallery.getBoundingClientRect() : null;
    /* 影廊整体离开视口：不再推进预载队列 */
    if (galleryRect && (galleryRect.bottom < 0 || galleryRect.top > vh)) return;
    items.forEach(function (item) {
      if (item.dataset.queued === '1') return;
      var rect = item.getBoundingClientRect();
      /* 与视口相交即入队（含部分露出），避免首屏底部条目被 0.92 阈值卡住 */
      if (rect.bottom > 0 && rect.top < vh) {
        item.dataset.queued = '1';
        preloadQueue.push(item);
      }
    });
    pumpPreload();
  }

  function stopVideo(vid) {
    if (!vid) return;
    try { vid.pause(); } catch (e) { /* noop */ }
    try { vid.currentTime = 0; } catch (e) { /* noop */ }
  }

  function stopItem(item) {
    if (!item) return;
    item.classList.remove('playing-intent', 'playing');
    stopVideo(item._video);
    if (activeVideo === item._video || activeItem === item) {
      activeVideo = null;
      activeItem = null;
    }
  }

  function clearOtherIntents(keep) {
    items.forEach(function (it) {
      if (it !== keep) it.classList.remove('playing-intent');
    });
  }

  function playItem(item) {
    if (prefersReduced || item.classList.contains('video-failed')) return;
    var vid = ensureVideo(item);
    if (!vid) return;

    clearOtherIntents(item);
    if (activeItem && activeItem !== item) stopItem(activeItem);

    var start = function () {
      if (!item.classList.contains('playing-intent') && item !== activeItem) return;
      /* 兜底：若其它条目因竞态仍在播，强制停掉 */
      if (activeItem && activeItem !== item) stopItem(activeItem);
      items.forEach(function (it) {
        if (it !== item && it._video && !it._video.paused) stopItem(it);
      });
      item.classList.add('playing');
      activeVideo = vid;
      activeItem = item;
      var p = vid.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          item.classList.remove('playing');
          if (activeVideo === vid) {
            activeVideo = null;
            activeItem = null;
          }
        });
      }
    };

    if (vid.readyState >= 2) {
      item.classList.add('playing-intent');
      start();
      return;
    }

    vid.addEventListener('canplay', function onReady() {
      vid.removeEventListener('canplay', onReady);
      if (item.classList.contains('playing-intent')) start();
    }, { once: true });
    item.classList.add('playing-intent');
    if (vid.dataset.loading !== '1' && vid.dataset.loaded !== '1') {
      ensureVideo(item);
    }
  }

  function bindItem(item) {
    if (canHover) {
      item.addEventListener('pointerenter', function () {
        item.classList.add('is-hover');
        playItem(item);
      });
      item.addEventListener('pointerleave', function () {
        item.classList.remove('is-hover');
        stopItem(item);
      });
    } else {
      item.addEventListener('click', function () {
        if (item.classList.contains('playing') || item.classList.contains('playing-intent')) {
          stopItem(item);
        } else {
          playItem(item);
        }
      });
    }
  }

  function onScroll() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function () {
      scrollTimer = null;
      enqueueVisible();
      /* 影廊整体离开视口时停掉在播视频，避免后台解码 */
      if (activeItem) {
        var rect = activeItem.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        if (rect.bottom < 0 || rect.top > vh) stopItem(activeItem);
      }
    }, 200);
  }

  function init() {
    var grid = document.getElementById('motion-grid');
    if (!grid) return;

    fetch(VID_BASE + 'manifest.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (entries) {
        grid.innerHTML = '';
        if (!Array.isArray(entries) || !entries.length) {
          var root = grid.closest('#motion-gallery');
          if (root) root.style.display = 'none';
          return;
        }
        items = entries.map(buildItem);
        items.forEach(function (item) {
          grid.appendChild(item);
          bindItem(item);
        });

        if (prefersReduced) return;

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        document.addEventListener('visibilitychange', function () {
          if (document.hidden && activeItem) stopItem(activeItem);
        });
        enqueueVisible();
        setTimeout(enqueueVisible, 600);
      })
      .catch(function () {
        var root = grid.closest('#motion-gallery');
        if (root) root.style.display = 'none';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
