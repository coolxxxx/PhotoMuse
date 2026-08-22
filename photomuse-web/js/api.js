/* ============================================================
 * 光影集 PhotoMuse Web · API 层
 * 依赖：js/config.js（window.PM_CONFIG）、CloudBase Web SDK（全局 cloudbase）
 * 提供：SDK 初始化 / 匿名登录 / photomuseOpenApi 调用封装 /
 *       云存储上传 / 临时链接 / 统一 toast / loading 遮罩
 * ============================================================ */
'use strict';

window.PM = (() => {
  const cfg = window.PM_CONFIG || {};
  const KEY_PLACEHOLDER = '请部署时替换为你的开放接口Key';
  const FUNCTION_NAME = 'photomuseOpenApi';

  let app = null;
  let authReady = null;

  /* ---------- 配置检查 ---------- */
  const isConfigured = () => {
    const key = String(cfg.OPEN_API_KEY || '').trim();
    return Boolean(cfg.ENV_ID && key && key !== KEY_PLACEHOLDER);
  };

  /* ---------- SDK 初始化与匿名登录（幂等） ---------- */
  const ensureApp = () => {
    if (!window.cloudbase) { throw new Error('CloudBase SDK 未加载，请检查网络后刷新重试'); }
    if (!cfg.ENV_ID) { throw new Error('站点未配置环境 ID（js/config.js 的 ENV_ID）'); }
    if (!app) { app = window.cloudbase.init({ env: cfg.ENV_ID }); }
    return app;
  };

  const ensureAuth = () => {
    if (!authReady) {
      authReady = (async () => {
        const a = ensureApp();
        const auth = a.auth({ persistence: 'local' });
        try {
          if (!auth.hasLoginState()) { await auth.signInAnonymously(); }
        } catch (e) {
          /* 已有登录态或重复登录时忽略，其余情况再试一次 */
          try { await auth.signInAnonymously(); } catch (e2) {
            throw new Error('匿名登录失败：' + (e2.message || e.message));
          }
        }
        return a;
      })().catch((e) => { authReady = null; throw e; });
    }
    return authReady;
  };

  /* ---------- 统一调用 photomuseOpenApi ----------
   * 成功返回 result 对象（success !== false）
   * 失败抛 Error：err.code / err.message 可直接展示
   */
  const callApi = async (action, payload) => {
    if (!isConfigured()) { throw new Error('站点未配置 API Key，请联系管理员'); }
    let res = null;
    try {
      const a = await ensureAuth();
      res = await a.callFunction({
        name: FUNCTION_NAME,
        data: { apiKey: String(cfg.OPEN_API_KEY).trim(), action: action, payload: payload || {} }
      });
    } catch (e) {
      /* SDK 拒绝时 message 常为空，真实信息在 errMsg；归一化便于页面展示与排查 */
      let msg = (e && (e.message || e.errMsg)) || '';
      if (!msg) {
        try { msg = JSON.stringify(e, Object.getOwnPropertyNames(e || {})).slice(0, 260); } catch (_) { msg = String(e); }
      }
      const hint = /origin|domain|域名/i.test(msg) ? '（疑似未配置 Web 安全域名：CloudBase 控制台→环境→安全配置→添加 www.czpsm.art）'
        : /auth|登录|anonymous/i.test(msg) ? '（疑似未启用匿名登录：CloudBase 控制台→环境→身份验证→启用匿名登录）'
        : '';
      throw new Error(String(msg || '调用云函数失败') + hint);
    }
    const result = res && res.result;
    if (!result || typeof result !== 'object') { throw new Error('服务端无返回，请稍后重试'); }
    if (result.success === false) {
      const err = new Error(result.message || '请求失败，请稍后重试');
      err.code = result.code || 'INTERNAL_ERROR';
      throw err;
    }
    return result;
  };

  /* ---------- 云存储 ---------- */
  const uploadFile = async (cloudPath, filePath) => {
    const a = await ensureAuth();
    const res = await a.uploadFile({ cloudPath: cloudPath, filePath: filePath });
    if (!res || !res.fileID) { throw new Error('云存储上传失败，请重试'); }
    return res.fileID;
  };

  /* 批量换取临时访问链接，返回 { fileID: url } 映射 */
  const getTempFileURL = async (fileIDs) => {
    const list = (Array.isArray(fileIDs) ? fileIDs : [fileIDs]).filter(Boolean);
    if (!list.length) { return {}; }
    const a = await ensureAuth();
    let res = null;
    try {
      res = await a.getTempFileURL(list);
    } catch (e) {
      /* 兼容不同 SDK 版本的两种入参形态 */
      res = await a.getTempFileURL({ fileList: list });
    }
    let rows = [];
    if (Array.isArray(res)) { rows = res; }
    else if (res && Array.isArray(res.fileList)) { rows = res.fileList; }
    const map = {};
    rows.forEach((item) => {
      if (item && item.fileID) {
        map[item.fileID] = item.tempFileURL || item.fileUrl || item.url || '';
      }
    });
    return map;
  };

  /* ---------- toast ---------- */
  let toastTimer = null;
  const toast = (message, type) => {
    let el = document.getElementById('pm-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pm-toast';
      document.body.appendChild(el);
    }
    el.textContent = String(message || '');
    el.className = 'pm-toast show' + (type ? ' pm-toast-' + type : '');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(() => { el.className = 'pm-toast'; }, 2800);
  };

  /* ---------- loading 遮罩 ---------- */
  const showLoading = (text) => {
    let el = document.getElementById('pm-loading');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pm-loading';
      el.className = 'pm-loading';
      const spinner = document.createElement('div');
      spinner.className = 'spinner';
      const label = document.createElement('div');
      label.className = 'pm-loading-text';
      el.appendChild(spinner);
      el.appendChild(label);
      document.body.appendChild(el);
    }
    el.querySelector('.pm-loading-text').textContent = text || '处理中…';
    el.classList.add('show');
  };

  const hideLoading = () => {
    const el = document.getElementById('pm-loading');
    if (el) { el.classList.remove('show'); }
  };

  /* ---------- 未配置 API Key 横幅 ----------
   * 页面需包含：<div id="config-banner" class="banner banner-warning hidden">…</div>
   * 带有 data-requires-key 属性的按钮会被禁用
   */
  const setupConfigBanner = () => {
    const el = document.getElementById('config-banner');
    if (!el) { return; }
    if (!isConfigured()) {
      el.classList.remove('hidden');
      const nodes = document.querySelectorAll('[data-requires-key]');
      for (let i = 0; i < nodes.length; i++) { nodes[i].disabled = true; }
    }
  };

  return {
    isConfigured: isConfigured,
    callApi: callApi,
    uploadFile: uploadFile,
    getTempFileURL: getTempFileURL,
    toast: toast,
    showLoading: showLoading,
    hideLoading: hideLoading,
    setupConfigBanner: setupConfigBanner
  };
})();
