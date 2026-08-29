/* ============================================================
 * 浅焦映像 Web · 动效层（暗房影楼 v3）
 * 1. 滚动进场：.reveal / .reveal-card 进入视口浮现
 * 2. Hero 样张视差：桌面鼠标驱动 CSS 变量（不覆盖 hover 态）
 * 3. 样张 Ken Burns：.kenburns 缓慢呼吸缩放（CSS 动画，JS 只负责启动）
 * 遵循 prefers-reduced-motion；交互逻辑零改动
 * ============================================================ */
(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. 滚动进场 ---------- */
  function initReveal() {
    var els = document.querySelectorAll('.reveal, .reveal-card');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || prefersReduced) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -36px 0px' });
    els.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- 2. Hero 样张鼠标视差 ---------- */
  function initHeroParallax() {
    var wrap = document.querySelector('.hero-photos');
    if (!wrap) return;
    var canHover = window.matchMedia('(hover: hover) and (min-width: 1024px)').matches;
    if (!canHover || prefersReduced) return;

    var rafId = null;
    var tx = 0, ty = 0, cx = 0, cy = 0;

    var animate = function () {
      rafId = null;
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      wrap.style.setProperty('--parallax-x', cx.toFixed(4));
      wrap.style.setProperty('--parallax-y', cy.toFixed(4));
      if (Math.abs(tx - cx) > 0.004 || Math.abs(ty - cy) > 0.004) {
        rafId = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('mousemove', function (e) {
      var rect = wrap.getBoundingClientRect();
      var centerX = rect.left + rect.width / 2;
      var centerY = rect.top + rect.height / 2;
      tx = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
      ty = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));
      if (!rafId) rafId = requestAnimationFrame(animate);
    }, { passive: true });
    document.addEventListener('mouseleave', function () {
      tx = 0; ty = 0;
      if (!rafId) rafId = requestAnimationFrame(animate);
    });
  }

  /* ---------- 3. Ken Burns 启动（节流到视口内才播） ---------- */
  function initKenBurns() {
    var els = document.querySelectorAll('.kenburns');
    if (!els.length || prefersReduced) return;
    if (!('IntersectionObserver' in window)) return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('kb-run');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25 });
    els.forEach(function (el) { observer.observe(el); });
  }

  function init() {
    initReveal();
    initHeroParallax();
    initKenBurns();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
