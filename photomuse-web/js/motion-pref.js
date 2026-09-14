/* ============================================================
 * 浅焦映像 Web · 动效偏好统一入口
 * 优先级：用户在本站的显式选择（localStorage） > 系统偏好(prefers-reduced-motion)
 * 提供全局 window.PM_MOTION_ON 与切换按钮，供各动效脚本统一读取
 * 无障碍立场：系统要求减少动画时默认关闭，但保留用户显式开启的权利
 * ============================================================ */
(function () {
  'use strict';

  var KEY = 'pm_motion_pref'; /* 'on' | 'off' | null(跟随系统) */
  var systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) { /* 隐私模式下忽略 */ }

  var motionOn = stored === 'on' ? true : (stored === 'off' ? false : !systemReduced);

  window.PM_MOTION_ON = motionOn;
  /* 同步到 html class：CSS 的 reduced-motion 覆盖据此让位 */
  var syncClass = function () {
    document.documentElement.classList.toggle('pm-motion-on', window.PM_MOTION_ON);
  };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', syncClass); } else { syncClass(); }
  window.PM_MOTION_SYSTEM_REDUCED = systemReduced;

  /* 切换时重载页面：动效脚本初始化逻辑简单可靠，避免运行时状态机复杂化 */
  window.PM_setMotion = function (on) {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* 忽略 */ }
    location.reload();
  };

  /* 悬浮开关（右下角，仅在系统要求减少动画且用户尚未显式选择时高亮提示） */
  function mountToggle() {
    if (document.getElementById('pm-motion-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'pm-motion-toggle';
    btn.type = 'button';
    btn.className = 'pm-motion-toggle' + (motionOn ? ' is-on' : '');
    btn.setAttribute('aria-pressed', String(motionOn));
    btn.title = motionOn ? '关闭动效' : '开启动效（视差 / 影廊播放 / 进场动画）';
    btn.innerHTML = '<span class="pm-motion-dot" aria-hidden="true"></span><span class="pm-motion-label">动效' + (motionOn ? '开' : '关') + '</span>';
    btn.addEventListener('click', function () { window.PM_setMotion(!motionOn); });
    document.body.appendChild(btn);

    /* 首次访问且系统要求减少动画：温和提示一次可手动开启 */
    if (systemReduced && !stored && !motionOn) {
      var tip = document.createElement('div');
      tip.className = 'pm-motion-tip';
      tip.innerHTML = '检测到系统开启了「减少动画」，动效已默认关闭。<br>想看视差与动态样张？点右下角 <b>动效关</b> 开启。';
      document.body.appendChild(tip);
      setTimeout(function () { if (tip.parentNode) { tip.classList.add('fade'); } }, 9000);
      setTimeout(function () { if (tip.parentNode) { tip.parentNode.removeChild(tip); } }, 11000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountToggle);
  } else {
    mountToggle();
  }
})();
