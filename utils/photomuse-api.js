/* ============================================================
 * 浅焦映像小程序 · 独立后端 HTTP 封装
 * 替代 wx.cloud.callFunction / uploadFile / getTempFileURL（签名一致）
 * 后端：https://www.czpsm.art/PM/api
 * 登录：deviceId 匿名身份（预留 code2session），token 缓存本地
 * ============================================================ */
'use strict';

const API_BASE = 'https://www.czpsm.art/PM/api';

function getStoredToken() {
  try { return wx.getStorageSync('pm_user_token') || ''; } catch (e) { return ''; }
}
function storeToken(token) {
  try { wx.setStorageSync('pm_user_token', token); } catch (e) { /* ignore */ }
}

/* 令牌失效时清空缓存并重置登录态，供自愈重试用 */
function resetLogin() {
  loginPromise = null;
  storeToken('');
}

let loginPromise = null;

/* 匿名登录（deviceId 模式；token 90 天有效，过期自动重登） */
function ensureLogin() {
  if (loginPromise) return loginPromise;
  loginPromise = new Promise((resolve, reject) => {
    let deviceId = '';
    try { deviceId = wx.getStorageSync('pm_device_id') || ''; } catch (e) {}
    if (!deviceId) {
      deviceId = 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
      try { wx.setStorageSync('pm_device_id', deviceId); } catch (e) {}
    }
    wx.request({
      url: API_BASE + '/wx/login',
      method: 'POST',
      data: { deviceId: deviceId },
      success: (res) => {
        if (res.data && res.data.success && res.data.token) {
          storeToken(res.data.token);
          resolve(res.data.token);
        } else {
          reject(new Error((res.data && res.data.message) || '登录失败'));
        }
      },
      fail: () => reject(new Error('网络连接失败，请检查网络'))
    });
  });
  loginPromise = loginPromise.catch((e) => { loginPromise = null; throw e; });
  return loginPromise;
}

/**
 * 把后端响应体转成 wx.cloud.callFunction 的 { result } 语义：
 * 成功返回响应体本身，业务失败抛带 code 的 Error（交由 fail 分支）。
 * 页面侧的 callFunction 包装判的是 res.result.success，故必须包一层 result。
 */
function normalizeResult(res) {
  const result = res.data;
  if (result && result.success) return result;
  const error = new Error((result && result.message) || '操作失败');
  error.code = result && result.code;
  throw error;
}

/* 与 wx.cloud.callFunction 同签名（回调式） */
function callFunction(options) {
  const { name, data, success, fail } = options;
  let retried = false;
  const doRequest = (token) => {
    wx.request({
      url: API_BASE + '/open/wx/' + name,
      method: 'POST',
      header: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'X-User-Token': token } : {}),
      data: data || {},
      success: (res) => {
        try {
          success({ result: normalizeResult(res) });
        } catch (e) {
          /* token 过期/失效自愈：清掉旧凭证重新登录后自动重试一次 */
          if (!retried && e && e.code === 'UNAUTHENTICATED') {
            retried = true;
            resetLogin();
            ensureLogin().then(doRequest).catch((err) => fail(err));
            return;
          }
          fail(e);
        }
      },
      fail: () => fail(new Error('网络连接失败，请检查网络'))
    });
  };
  const cached = getStoredToken();
  if (cached) {
    doRequest(cached);
  } else {
    ensureLogin().then(doRequest).catch((e) => fail(e));
  }
}

/* 与 wx.cloud.uploadFile 同签名（回调式）：直传独立后端，返回 { fileID: 公网URL } */
function uploadFile(options) {
  const { cloudPath, filePath, success, fail } = options;
  const doUpload = (token) => {
    wx.uploadFile({
      url: API_BASE + '/upload/wx',
      filePath: filePath,
      name: 'file',
      header: token ? { 'X-User-Token': token } : {},
      formData: { cloudPath: String(cloudPath || '').replace(/^ai-studio\//, '') },
      success: (res) => {
        try {
          const result = JSON.parse(res.data);
          if (result && result.success && result.fileID) {
            success({ fileID: result.fileID });
          } else {
            fail(new Error((result && result.message) || '上传失败'));
          }
        } catch (e) { fail(new Error('上传响应异常')); }
      },
      fail: () => fail(new Error('网络连接失败，请检查网络'))
    });
  };
  const cached = getStoredToken();
  if (cached) {
    doUpload(cached);
  } else {
    ensureLogin().then(doUpload).catch((e) => fail(e));
  }
}

/* 与 wx.cloud.getTempFileURL 同签名：独立后端下 fileID 即公网 URL，恒等映射 */
function getTempFileURL(options) {
  const { fileList, success, fail } = options;
  const list = Array.isArray(fileList) ? fileList : [];
  const result = {
    fileList: list.map((fileID) => ({ fileID: fileID, tempFileURL: fileID }))
  };
  if (success) setTimeout(() => success(result), 0);
  return Promise.resolve(result);
}

module.exports = { callFunction, uploadFile, getTempFileURL, ensureLogin };
