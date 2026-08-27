/* ============================================================
 * 光影集 PhotoMuse Web · CloudBase 传输层兼容补丁
 * 背景：新版 SDK 的 GATEWAY 网关域执行 Web 安全域名白名单，
 *       而添加自定义安全域名需要升级套餐（CreateAuthDomain 受限）；
 *       旧域 *.tcb-api.tencentcloudapi.com 放行但部分浏览器
 *       （Chromium 系）对该域 /web 路由的 TLS 行为握手失败。
 * 方案：nginx 同源反向代理 /pm-tcb/ → tcb-api 域，本补丁把
 *       SDK 发往该域的 fetch/XHR 全部重写到代理路径。
 * 依赖：nginx location /pm-tcb/（见 docs/Web版部署指南.md）
 * ============================================================ */
'use strict';

(function () {
  const TCB_ORIGIN = 'https://cloud1-9gv5zn35c8ca8869-00c771e2.ap-shanghai.tcb-api.tencentcloudapi.com/';
  const PROXY_PATH = '/pm-tcb/';

  const rewrite = (u) => {
    if (typeof u === 'string' && u.indexOf(TCB_ORIGIN) === 0) {
      return PROXY_PATH + u.slice(TCB_ORIGIN.length);
    }
    return u;
  };

  /* XHR：SDK 的 callFunction / 云存储走 XHR 适配器 */
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    const args = Array.prototype.slice.call(arguments);
    args[1] = rewrite(url);
    return origOpen.apply(this, args);
  };

  /* fetch：SDK 的匿名登录走 fetch；本脚本须在 vendor SDK 之前加载，
   * 这样 SDK 内部捕获到的 window.fetch 已是重写版本 */
  if (typeof window.fetch === 'function') {
    const origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        if (typeof input === 'string' && input.indexOf(TCB_ORIGIN) === 0) {
          input = PROXY_PATH + input.slice(TCB_ORIGIN.length);
        } else if (input && typeof input.url === 'string' && input.url.indexOf(TCB_ORIGIN) === 0) {
          input = new Request(PROXY_PATH + input.url.slice(TCB_ORIGIN.length), input);
        }
      } catch (e) { /* 重写失败则按原样请求 */ }
      return origFetch(input, init);
    };
  }
})();
