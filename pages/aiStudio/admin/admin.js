const {
  STATUS_LABELS,
  PHOTO_CHECK_LABELS
} = require('../../../utils/ai-studio-config');

Page({
  data: {
    statusOptions: [
      { value: 'photo_review', label: '待审核' },
      { value: 'queued', label: '已排单' },
      { value: 'generating', label: '出图中' },
      { value: 'qc', label: '质检中' },
      { value: 'delivered', label: '已交付' },
      { value: 'waiting_photos', label: '待补图' },
      { value: 'cancelled', label: '已取消' }
    ],
    selectedStatus: 'photo_review',
    orders: [],
    isLoading: false,
    actionOrderId: ''
  },

  onLoad() {
    if (!this.ensureAdminPassword()) return;
    this.loadOrders();
  },

  onShow() {
    if (!this.ensureAdminPassword()) return;
    this.loadOrders();
  },

  ensureAdminPassword() {
    const app = getApp();
    if (app.globalData && app.globalData.aiStudioAdminPassword) return true;

    wx.showToast({ title: '请先管理登录', icon: 'none' });
    wx.redirectTo({ url: '/pages/aiStudio/adminLogin/adminLogin' });
    return false;
  },

  onPullDownRefresh() {
    this.loadOrders().finally(() => wx.stopPullDownRefresh());
  },

  goBack() {
    const pages = getCurrentPages ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.redirectTo({ url: '/pages/aiStudio/adminLogin/adminLogin' });
    }
  },

  logoutAdmin() {
    const app = getApp();
    if (app.globalData) app.globalData.aiStudioAdminPassword = '';
    wx.showToast({ title: '已退出管理', icon: 'success' });
    wx.redirectTo({ url: '/pages/aiStudio/adminLogin/adminLogin' });
  },

  selectStatus(e) {
    this.setData({ selectedStatus: e.currentTarget.dataset.status });
    this.loadOrders();
  },

  async loadOrders() {
    this.setData({ isLoading: true });
    try {
      const res = await callFunction('adminListAIStudioOrders', {
        status: this.data.selectedStatus,
        page: 0,
        pageSize: 20,
        adminPassword: getAdminPassword()
      });

      const orders = await hydrateOrderImages((res.data || []).map(order => ({
        ...order,
        statusText: STATUS_LABELS[order.order_status] || order.order_status,
        photoCheckText: PHOTO_CHECK_LABELS[order.photo_check] || order.photo_check,
        customerFiles: (order.files || []).filter(file => file.fileType === 'customer_photo' && file.status === 'uploaded'),
        deliveryFiles: (order.files || []).filter(file => file.fileType === 'delivery')
      })));

      this.setData({ orders });
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
      this.setData({ orders: [] });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  passReview(e) {
    const orderId = e.currentTarget.dataset.id;
    this.reviewOrder(orderId, 'pass', '照片合格，进入证件照制作队列。');
  },

  requestRetake(e) {
    const orderId = e.currentTarget.dataset.id;
    this.reviewOrder(orderId, 'need_retake', '照片光线、清晰度或遮挡影响制作，请重新上传清晰正脸照。');
  },

  rejectOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认拒单',
      content: '将订单标记为已取消，并记录为不适合制作。确定继续吗？',
      success: res => {
        if (res.confirm) {
    this.reviewOrder(orderId, 'reject', '照片或用途不符合制作规则。');
        }
      }
    });
  },

  async reviewOrder(orderId, action, reason) {
    this.setData({ actionOrderId: orderId });
    try {
      await callFunction('adminReviewAIStudioOrder', { orderId, action, reason, adminPassword: getAdminPassword() });
      wx.showToast({ title: '已更新', icon: 'success' });
      this.loadOrders();
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  chooseDelivery(e) {
    const orderId = e.currentTarget.dataset.id;
    const onSuccess = files => this.uploadDeliveryFiles(orderId, files);

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => onSuccess(res.tempFiles || [])
      });
    } else {
      wx.chooseImage({
        count: 9,
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => onSuccess((res.tempFilePaths || []).map((path, index) => ({
          path,
          size: (res.tempFiles && res.tempFiles[index] && res.tempFiles[index].size) || 0
        })))
      });
    }
  },

  async uploadDeliveryFiles(orderId, files) {
    if (!files.length) return;

    this.setData({ actionOrderId: orderId });
    wx.showLoading({ title: '上传交付图', mask: true });

    try {
      const deliveryFiles = [];
      for (let i = 0; i < files.length; i += 1) {
        const tempFilePath = files[i].tempFilePath || files[i].path;
        const ext = getFileExtension(tempFilePath);
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `ai-studio/${orderId}/delivery/${Date.now()}-${i}.${ext}`,
          filePath: tempFilePath
        });

        deliveryFiles.push({
          fileID: uploadRes.fileID,
          fileName: `delivery-${i + 1}.${ext}`,
          size: files[i].size || 0,
          mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`
        });
      }

      await callFunction('adminDeliverAIStudioOrder', {
        orderId,
        deliveryFiles,
        deliveryNote: '证件照电子版已完成制作和人工 QC。',
        adminPassword: getAdminPassword()
      });

      wx.hideLoading();
      wx.showToast({ title: '已交付', icon: 'success' });
      this.loadOrders();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '交付失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls || [];
    wx.previewImage({ current: url, urls });
  }
});

async function hydrateOrderImages(orders) {
  const fileIds = [];
  orders.forEach(order => {
    order.customerFiles.forEach(file => fileIds.push(file.fileID));
    order.deliveryFiles.forEach(file => fileIds.push(file.fileID));
  });

  const urlMap = await getTempUrlMap(fileIds);

  return orders.map(order => ({
    ...order,
    customerFiles: order.customerFiles.map(file => ({
      ...file,
      tempUrl: urlMap[file.fileID] || ''
    })),
    customerUrls: order.customerFiles.map(file => urlMap[file.fileID]).filter(Boolean),
    deliveryFiles: order.deliveryFiles.map(file => ({
      ...file,
      tempUrl: urlMap[file.fileID] || ''
    })),
    deliveryUrls: order.deliveryFiles.map(file => urlMap[file.fileID]).filter(Boolean)
  }));
}

function getTempUrlMap(fileList) {
  if (!fileList.length) return Promise.resolve({});
  return new Promise(resolve => {
    wx.cloud.getTempFileURL({
      fileList,
      success: res => {
        const map = {};
        (res.fileList || []).forEach(item => {
          if (item.fileID && item.tempFileURL) map[item.fileID] = item.tempFileURL;
        });
        resolve(map);
      },
      fail: () => resolve({})
    });
  });
}

function getFileExtension(path) {
  const cleanPath = String(path || '').split('?')[0];
  const ext = cleanPath.includes('.') ? cleanPath.split('.').pop().toLowerCase() : 'jpg';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg';
}

function callFunction(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
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

function getAdminPassword() {
  const app = getApp();
  return (app.globalData && app.globalData.aiStudioAdminPassword) || '';
}
