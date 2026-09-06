/* ============================================================
 * 动效模块 · 暗房影楼
 * 1. IntersectionObserver 滚动进场（reveal / reveal-card 类在 JSX 中声明）
 * 2. Hero 照片视差（CSS 变量驱动，不覆盖 hover transform）
 * 3. 导航栏滚动缩高
 * 4. 页面切换后重新初始化
 * ============================================================ */

(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. 滚动进场 ---------- */
  const initReveal = () => {
    const els = document.querySelectorAll('.reveal, .reveal-card, .reveal-fade');
    if (!els.length) return;

    if (!('IntersectionObserver' in window) || prefersReduced) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    els.forEach((el) => {
      // 已可见的不再重复观察
      if (!el.classList.contains('is-visible')) {
        observer.observe(el);
      }
    });
  };

  /* ---------- 2. Hero 照片视差（CSS 变量） ---------- */
  let parallaxBound = false;
  let mouseHandler = null;
  let leaveHandler = null;

  const initHeroParallax = () => {
    if (parallaxBound) {
      // 已绑定，仅确保目标归零
      return;
    }

    const heroPhotos = document.querySelector('.hero-photos');
    if (!heroPhotos) return;

    let rafId = null;
    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;

    const animate = () => {
      rafId = null;
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      heroPhotos.style.setProperty('--parallax-x', currentX.toFixed(4));
      heroPhotos.style.setProperty('--parallax-y', currentY.toFixed(4));

      if (Math.abs(targetX - currentX) > 0.005 || Math.abs(targetY - currentY) > 0.005) {
        rafId = requestAnimationFrame(animate);
      }
    };

    mouseHandler = (e) => {
      const rect = heroPhotos.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      // 归一化到 -1 ~ 1，超界截断
      targetX = Math.max(-1, Math.min(1, (e.clientX - centerX) / (rect.width / 2)));
      targetY = Math.max(-1, Math.min(1, (e.clientY - centerY) / (rect.height / 2)));
      if (!rafId) rafId = requestAnimationFrame(animate);
    };

    leaveHandler = () => {
      targetX = 0;
      targetY = 0;
      if (!rafId) rafId = requestAnimationFrame(animate);
    };

    // 只在桌面指针设备上启用
    const canHover = window.matchMedia('(hover: hover) and (min-width: 1024px)').matches;
    if (canHover) {
      document.addEventListener('mousemove', mouseHandler, { passive: true });
      document.addEventListener('mouseleave', leaveHandler);
      parallaxBound = true;
    }
  };

  /* ---------- 3. 导航栏滚动缩高 ---------- */
  let navBound = false;
  const initNavScroll = () => {
    if (navBound) return;
    const header = document.querySelector('.site-header');
    if (!header) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (window.scrollY > 20) {
            header.classList.add('scrolled');
          } else {
            header.classList.remove('scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    navBound = true;
    onScroll();
  };

  /* ---------- 初始化 ---------- */
  const init = () => {
    initReveal();
    initHeroParallax();
    initNavScroll();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // React 页面切换后重新调用
  window.__initAnimations = init;
})();
