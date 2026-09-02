Page({
  data: {
    isChecking: false,
    errorMessage: '',
    adminPassword: ''
  },

  onPasswordInput(e) {
    this.setData({ adminPassword: (e.detail.value || '').trim() });
  },

  goBack() {
    const pages = getCurrentPages ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.redirectTo({ url: '/pages/aiStudio/index' });
    }
  },

  async loginAdmin() {
    if (this.data.isChecking) return;
    if (!this.data.adminPassword) {
      wx.showToast({ title: '请输入管理口令', icon: 'none' });
      return;
    }

    this.setData({
      isChecking: true,
      errorMessage: ''
    });

    try {
      await callFunction('adminListAIStudioOrders', {
        status: 'photo_review',
        page: 0,
        pageSize: 1,
        adminPassword: this.data.adminPassword
      });

      const app = getApp();
const photomuseApi = require("../../utils/photomuse-api.js");
      app.globalData.aiStudioAdminPassword = this.data.adminPassword;

      wx.showToast({ title: '登录成功', icon: 'success' });
      wx.navigateTo({ url: '/pages/aiStudio/admin/admin' });
    } catch (error) {
      const message = error.message || '暂无管理权限';
      this.setData({ errorMessage: message });
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ isChecking: false });
    }
  }
});

function callFunction(name, data) {
  return new Promise((resolve, reject) => {
    photomuseApi.callFunction({
      name,
      data,
      success: res => {
        if (res.result && res.result.success) {
          resolve(res.result);
        } else {
          reject(new Error((res.result && res.result.message) || '操作失败'));
        }
      },
      fail: reject
    });
  });
}
