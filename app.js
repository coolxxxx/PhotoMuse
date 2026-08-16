// app.js - 光影集 PhotoMuse
App({
  globalData: {
    aiStudioAdminPassword: '',
    aiStudioOrderQuery: null
  },

  onLaunch: function() {
    // 检查云开发能力是否可用
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，无法使用云能力，请升级到最新微信版本',
        showCancel: false
      });
      return;
    }

    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-9gv5zn35c8ca8869-00c771e2',
      traceUser: true
    });
  }
});
