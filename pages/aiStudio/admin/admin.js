const {
  STATUS_LABELS,
  PHOTO_CHECK_LABELS
} = require('../../../utils/ai-studio-config');

Page({
  data: {
    statusOptions: [
      { value: 'photo_review', label: '待审核' },
      { value: 'queued', label: '已排单' },
      { value: 'grid_preview', label: '待选片' },
      { value: 'cell_selected', label: '制作中' },
      { value: 'generating', label: '出图中' },
      { value: 'qc', label: '质检中' },
      { value: 'delivered', label: '已交付' },
      { value: 'waiting_photos', label: '待补图' },
      { value: 'cancelled', label: '已取消' }
    ],
    selectedStatus: 'photo_review',
    orders: [],
    isLoading: false,
    actionOrderId: '',
    showModelPanel: false,
    isSavingModel: false,
    imageSizeOptions: ['1024x1024', '768x1344', '1344x768', '2048x2048'],
    imageSizeIndex: 0,
    modelConfig: {
      apiUrl: '',
      apiKey: '',
      model: '',
      imageSize: '1024x1024',
      enabled: true
    }
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

  toggleModelPanel() {
    const showModelPanel = !this.data.showModelPanel;
    this.setData({ showModelPanel });
    if (showModelPanel) this.loadModelSettings();
  },

  async loadModelSettings() {
    try {
      const res = await callFunction('getAIStudioRuntimeConfig', {});
      const settings = (((res.config || {}).modelSettings) || []).find(item => item.scene === 'image_generation') || {};
      const imageSize = settings.imageSize || '1024x1024';

      this.setData({
        modelConfig: {
          apiUrl: settings.apiUrl || '',
          apiKey: '',
          model: settings.model || '',
          imageSize,
          enabled: settings.enabled !== false
        },
        imageSizeIndex: Math.max(0, this.data.imageSizeOptions.indexOf(imageSize))
      });
    } catch (error) {
      wx.showToast({ title: error.message || '读取模型设置失败', icon: 'none' });
    }
  },

  onModelFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`modelConfig.${field}`]: e.detail.value });
  },

  onImageSizeChange(e) {
    const index = Number(e.detail.value);
    const imageSize = this.data.imageSizeOptions[index];
    if (!imageSize) return;
    this.setData({ imageSizeIndex: index, 'modelConfig.imageSize': imageSize });
  },

  onModelEnabledChange(e) {
    this.setData({ 'modelConfig.enabled': !!e.detail.value });
  },

  async saveModelSettings() {
    const config = this.data.modelConfig;
    const apiUrl = (config.apiUrl || '').trim();
    const model = (config.model || '').trim();
    const apiKey = (config.apiKey || '').trim();

    if (!apiUrl || !model) {
      wx.showToast({ title: '请填写接口地址和模型名称', icon: 'none' });
      return;
    }

    const modelSetting = {
      scene: 'image_generation',
      enabled: !!config.enabled,
      provider: 'openai_compatible',
      model,
      apiUrl,
      imageSize: config.imageSize,
      publicName: 'AI 生图接口'
    };
    if (apiKey) modelSetting.apiKey = apiKey;

    this.setData({ isSavingModel: true });
    try {
      await callFunction('adminUpsertAIStudioRuntimeConfig', {
        adminPassword: getAdminPassword(),
        modelSettings: [modelSetting]
      });
      wx.showToast({ title: '模型设置已保存', icon: 'success' });
      this.setData({ showModelPanel: false, 'modelConfig.apiKey': '' });
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ isSavingModel: false });
    }
  },

  generateReferenceImage(e) {
    this.runImageGeneration(e.currentTarget.dataset.id, 'reference');
  },

  generateGridImage(e) {
    this.runImageGeneration(e.currentTarget.dataset.id, 'grid');
  },

  generateCellImage(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(item => item.orderId === orderId);
    const cells = ((order && order.selected_cells) || [])
      .map(cell => Number(cell))
      .filter(cell => Number.isInteger(cell) && cell > 0)
      .sort((a, b) => a - b);

    if (!cells.length) {
      wx.showToast({ title: '该订单暂无已选分镜', icon: 'none' });
      return;
    }

    wx.showActionSheet({
      itemList: cells.slice(0, 6).map(cell => `分镜 ${cell} 号`),
      success: res => {
        const cell = cells[res.tapIndex];
        if (cell) this.runImageGeneration(orderId, 'cell', cell);
      }
    });
  },

  async runImageGeneration(orderId, stage, cell) {
    if (this.data.actionOrderId) return;

    this.setData({ actionOrderId: `gen:${orderId}` });
    wx.showLoading({ title: 'AI 出图中，可能需要 1-2 分钟', mask: true });

    try {
      const payload = {
        adminPassword: getAdminPassword(),
        orderId,
        stage
      };
      if (stage === 'cell' && cell) payload.cell = cell;

      const res = await callFunction('generateAIStudioImage', payload);
      wx.hideLoading();

      const fileID = res.file && res.file.fileID;
      if (fileID) {
        const urlMap = await getTempUrlMap([fileID]);
        const url = urlMap[fileID];
        if (url) wx.previewImage({ current: url, urls: [url] });
      }
      this.loadOrders();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '生成失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  setupPaymentQR() {
    const saveFile = file => {
      if (file) this.savePaymentQR(file);
    };

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => saveFile((res.tempFiles || [])[0])
      });
    } else {
      wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => {
          const path = (res.tempFilePaths || [])[0];
          if (!path) return;
          saveFile({
            tempFilePath: path,
            size: (res.tempFiles && res.tempFiles[0] && res.tempFiles[0].size) || 0
          });
        }
      });
    }
  },

  async savePaymentQR(file) {
    const tempFilePath = file.tempFilePath || file.path;

    this.setData({ actionOrderId: 'payment-qr' });
    wx.showLoading({ title: '上传收款码', mask: true });

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ai-studio/payment/qr-${Date.now()}.png`,
        filePath: tempFilePath
      });
      wx.hideLoading();

      const note = await this.promptPaymentNote();
      if (note === null) return;

      wx.showLoading({ title: '保存收款码', mask: true });
      await callFunction('adminSetAIStudioPaymentQR', {
        adminPassword: getAdminPassword(),
        fileID: uploadRes.fileID,
        note
      });

      wx.hideLoading();
      wx.showToast({ title: '收款码已更新', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '收款码更新失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  promptPaymentNote() {
    return new Promise(resolve => {
      wx.showModal({
        title: '收款码备注',
        editable: true,
        placeholderText: '如：微信收款码，请备注订单号后四位',
        success: res => {
          if (res.confirm) resolve(res.content || '');
          else resolve(null);
        },
        fail: () => resolve(null)
      });
    });
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
        deliveryFiles: (order.files || []).filter(file => file.fileType === 'delivery'),
        generatedFiles: (order.files || []).filter(file => (file.fileType === 'generated' || file.fileType === 'grid_preview') && file.status === 'uploaded')
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

  markOrderPaid(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(item => item.orderId === orderId);
    const price = (order && order.price) || '';

    wx.showModal({
      title: '确认收款',
      content: `请确认已收到该订单款项 ${price} 元`,
      success: res => {
        if (res.confirm) this.confirmOrderPaid(orderId);
      }
    });
  },

  async confirmOrderPaid(orderId) {
    this.setData({ actionOrderId: orderId });
    try {
      await callFunction('adminMarkAIStudioOrderPaid', {
        orderId,
        adminPassword: getAdminPassword()
      });
      wx.showToast({ title: '已标记支付', icon: 'success' });
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

  chooseGridPreview(e) {
    const orderId = e.currentTarget.dataset.id;
    const uploadFile = file => {
      if (file) this.uploadGridPreview(orderId, file);
    };

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => uploadFile((res.tempFiles || [])[0])
      });
    } else {
      wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => {
          const path = (res.tempFilePaths || [])[0];
          if (!path) return;
          uploadFile({
            tempFilePath: path,
            size: (res.tempFiles && res.tempFiles[0] && res.tempFiles[0].size) || 0
          });
        }
      });
    }
  },

  async uploadGridPreview(orderId, file) {
    const tempFilePath = file.tempFilePath || file.path;

    this.setData({ actionOrderId: orderId });
    wx.showLoading({ title: '上传预览网格', mask: true });

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ai-studio/${orderId}/grid/${Date.now()}-0.jpg`,
        filePath: tempFilePath
      });

      await callFunction('adminUploadAIStudioGridPreview', {
        orderId,
        fileID: uploadRes.fileID,
        fileName: 'grid-preview.jpg',
        size: file.size || 0,
        mimeType: 'image/jpeg',
        adminPassword: getAdminPassword()
      });

      wx.hideLoading();
      wx.showToast({ title: '预览网格已上传，等待用户选片', icon: 'none' });
      this.loadOrders();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '上传失败', icon: 'none' });
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
    order.generatedFiles.forEach(file => fileIds.push(file.fileID));
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
    deliveryUrls: order.deliveryFiles.map(file => urlMap[file.fileID]).filter(Boolean),
    generatedFiles: order.generatedFiles.map(file => ({
      ...file,
      tempUrl: urlMap[file.fileID] || ''
    })),
    generatedUrls: order.generatedFiles.map(file => urlMap[file.fileID]).filter(Boolean)
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
