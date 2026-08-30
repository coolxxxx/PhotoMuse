/* ============================================================
 * 浅焦映像 Web · API 层 v2（独立后端 HTTP 通道）
 * 后端：photomuse-server（/PM/api/*），数据/AI 全在自有服务器
 * 接口形状与 v1 完全一致：PM.callApi / PM.uploadFile / PM.getTempFileURL
 * 页面逻辑零改动；内部记录会话凭证（orderId/webToken）
 * ============================================================ */
'use strict';

window.PM = (() => {
  const API_BASE = '/PM/api';
  const UPLOAD_BASE = '/PM/api/upload';

  /* 会话凭证：createOrder 成功后记录，供 uploadFile 鉴权 */
  const session = { orderId: null, webToken: null };

  /* ---------- 兼容保留：旧页面检测函数（切后端后恒可用） ---------- */
  const isConfigured = () => true;

  /* ---------- action 分发调用 ---------- */
  const callApi = async (action, payload) => {
    const res = await fetch(API_BASE + '/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, payload: payload || {} })
    });
    if (!res.ok) throw new Error('网络请求失败（' + res.status + '），请稍后重试');
    const result = await res.json();
    if (!result || typeof result !== 'object') throw new Error('服务端无返回，请稍后重试');
    if (result.success === false) {
      const err = new Error(result.message || '请求失败，请稍后重试');
      err.code = result.code || 'INTERNAL_ERROR';
      throw err;
    }
    /* 自动记录订单会话凭证 */
    if (action === 'createOrder' && result.orderId && result.webToken) {
      session.orderId = result.orderId;
      session.webToken = result.webToken;
    }
    return result;
  };

  /* ---------- 上传（multipart → 本地 uploads，fileID 即公网 URL） ---------- */
  const uploadFile = async (cloudPath, file) => {
    const fd = new FormData();
    if (session.orderId) {
      fd.append('orderId', session.orderId);
      fd.append('webToken', session.webToken);
    }
    fd.append('cloudPath', String(cloudPath || '').replace(/^ai-studio\//, '').replace(/[\\/:*?"<>|]/g, '_'));
    fd.append('file', file, file && file.name ? file.name : 'photo.jpg');
    const res = await fetch(UPLOAD_BASE, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('上传失败（' + res.status + '），请重试');
    const result = await res.json();
    if (!result || result.success === false || !result.fileID) {
      throw new Error((result && result.message) || '上传失败，请重试');
    }
    return result.fileID;
  };

  /* ---------- 本地文件即公网 URL：恒等映射 ---------- */
  const getTempFileURL = async (fileIDs) => {
    const list = (Array.isArray(fileIDs) ? fileIDs : [fileIDs]).filter(Boolean);
    const map = {};
    list.forEach((id) => { map[id] = id; });
    return map;
  };

  /* ---------- toast / loading（不变） ---------- */
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

  const setupConfigBanner = () => { /* 独立后端无需 key 配置检查 */ };

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
