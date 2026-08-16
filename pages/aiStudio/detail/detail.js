const {
  STATUS_LABELS,
  PHOTO_CHECK_LABELS
} = require('../../../utils/ai-studio-config');

const GRID_CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

Page({
  data: {
    orderId: '',
    order: null,
    customerFiles: [],
    deliveryFiles: [],
    deliveryUrls: [],
    retakePhotos: [],
    paymentQR: null,
    paymentChecked: false,
    gridPreviewUrl: '',
    gridCells: GRID_CELLS,
    selectedCells: [],
    selectedMap: {},
    isLoading: false,
    isUploading: false,
    isSubmittingCells: false,
    queryMode: false
  },

  onLoad(options) {
    this.setData({
      orderId: options.orderId || '',
      queryMode: options.query === '1'
    });
    this.loadDetail();
  },

  onShow() {
    if (this.data.orderId) this.loadDetail();
  },

  goBack() {
    const pages = getCurrentPages ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.redirectTo({ url: '/pages/aiStudio/index' });
    }
  },

  async loadDetail() {
    if (!this.data.orderId) return;
    this.setData({
      isLoading: true,
      paymentQR: null,
      paymentChecked: false,
      gridPreviewUrl: ''
    });

    try {
      const res = this.data.queryMode
        ? await this.queryDetailByCredential()
        : await callFunction('getAIStudioOrderDetail', {
          orderId: this.data.orderId
        });

      const files = res.files || [];
      const deliveryFiles = files.filter(file => file.fileType === 'delivery');
      const deliveryUrls = await getTempUrls(deliveryFiles.map(file => file.fileID));

      // 网格预览图：只取最新一条 grid_preview，且不混入交付图/客户图
      const gridPreviewFiles = files.filter(file => file.fileType === 'grid_preview');
      const latestGridFile = gridPreviewFiles[gridPreviewFiles.length - 1];
      const gridPreviewUrl = latestGridFile
        ? (await getTempUrls([latestGridFile.fileID]))[0] || ''
        : '';

      this.setData({
        order: {
          ...res.order,
          statusText: STATUS_LABELS[res.order.order_status] || res.order.order_status,
          photoCheckText: PHOTO_CHECK_LABELS[res.order.photo_check] || res.order.photo_check
        },
        customerFiles: files.filter(file => file.fileType === 'customer_photo'),
        deliveryFiles,
        deliveryUrls,
        gridPreviewUrl
      });

      if (res.order.payment_status === 'unpaid') {
        this.loadPaymentQR();
      }
    } catch (error) {
      wx.showToast({ title: error.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  async loadPaymentQR() {
    try {
      const res = await callFunction('getAIStudioPaymentQR');
      const config = res.config;
      const url = config && config.fileID
        ? (await getTempUrls([config.fileID]))[0] || ''
        : '';

      this.setData({
        paymentQR: url ? { url, note: config.note || '' } : null,
        paymentChecked: true
      });
    } catch (error) {
      this.setData({ paymentQR: null, paymentChecked: true });
    }
  },

  queryDetailByCredential() {
    const app = getApp();
    const query = app.globalData && app.globalData.aiStudioOrderQuery;
    if (!query || query.orderId !== this.data.orderId) {
      return Promise.reject(new Error('请返回证件照制作页重新查询订单'));
    }

    return callFunction('queryAIStudioOrder', query);
  },

  chooseRetakePhotos() {
    const remain = 3 - this.data.retakePhotos.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传 3 张照片', icon: 'none' });
      return;
    }

    const onSuccess = files => {
      const retakePhotos = this.data.retakePhotos.concat(
        files.map(file => ({
          tempFilePath: file.tempFilePath || file.path,
          size: file.size || 0
        })).filter(file => file.tempFilePath)
      ).slice(0, 3);
      this.setData({ retakePhotos });
    };

    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => onSuccess(res.tempFiles || [])
      });
    } else {
      wx.chooseImage({
        count: remain,
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: res => onSuccess((res.tempFilePaths || []).map((path, index) => ({
          path,
          size: (res.tempFiles && res.tempFiles[index] && res.tempFiles[index].size) || 0
        })))
      });
    }
  },

  removeRetakePhoto(e) {
    const index = Number(e.currentTarget.dataset.index);
    const retakePhotos = this.data.retakePhotos.slice();
    retakePhotos.splice(index, 1);
    this.setData({ retakePhotos });
  },

  async submitRetakePhotos() {
    if (this.data.retakePhotos.length < 1) {
      wx.showToast({ title: '请先选择补拍照片', icon: 'none' });
      return;
    }

    this.setData({ isUploading: true });
    wx.showLoading({ title: '上传补拍中', mask: true });

    try {
      for (let i = 0; i < this.data.retakePhotos.length; i += 1) {
        const photo = this.data.retakePhotos[i];
        const ext = getFileExtension(photo.tempFilePath);
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `ai-studio/${this.data.orderId}/customer-retake/${Date.now()}-${i}.${ext}`,
          filePath: photo.tempFilePath
        });

        await callFunction('uploadAIStudioPhoto', {
          orderId: this.data.orderId,
          fileID: uploadRes.fileID,
          fileName: `retake-${i + 1}.${ext}`,
          size: photo.size,
          mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`
        });
      }

      await callFunction('submitAIStudioOrder', { orderId: this.data.orderId });
      wx.hideLoading();
      wx.showToast({ title: '补拍已提交', icon: 'success' });
      this.setData({ retakePhotos: [] });
      this.loadDetail();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '上传失败', icon: 'none' });
    } finally {
      this.setData({ isUploading: false });
    }
  },

  previewDelivery(e) {
    const current = e.currentTarget.dataset.url;
    wx.previewImage({
      current,
      urls: this.data.deliveryUrls
    });
  },

  previewGridImage() {
    if (!this.data.gridPreviewUrl) return;
    wx.previewImage({
      current: this.data.gridPreviewUrl,
      urls: [this.data.gridPreviewUrl]
    });
  },

  getMaxCellCount() {
    const order = this.data.order || {};
    const count = Number(order.deliveryCount);
    return count > 0 ? count : 5;
  },

  toggleCell(e) {
    const cell = Number(e.currentTarget.dataset.cell);
    const selectedCells = this.data.selectedCells.slice();
    const index = selectedCells.indexOf(cell);

    if (index >= 0) {
      selectedCells.splice(index, 1);
    } else {
      const max = this.getMaxCellCount();
      if (selectedCells.length >= max) {
        wx.showToast({ title: `最多选择 ${max} 个分镜`, icon: 'none' });
        return;
      }
      selectedCells.push(cell);
    }

    const selectedMap = {};
    selectedCells.forEach(item => { selectedMap[item] = true; });
    this.setData({ selectedCells, selectedMap });
  },

  async submitSelectedCells() {
    if (this.data.isSubmittingCells) return;
    if (!this.data.selectedCells.length) {
      wx.showToast({ title: '请先选择分镜', icon: 'none' });
      return;
    }

    const payload = {
      orderId: this.data.orderId,
      cells: this.data.selectedCells.slice()
    };

    if (this.data.queryMode) {
      const app = getApp();
      const query = app.globalData && app.globalData.aiStudioOrderQuery;
      if (!query || query.orderId !== this.data.orderId) {
        wx.showToast({ title: '请返回证件照制作页重新查询订单', icon: 'none' });
        return;
      }
      payload.contactPhone = query.contactPhone;
      payload.queryPassword = query.queryPassword;
    }

    this.setData({ isSubmittingCells: true });
    wx.showLoading({ title: '提交选片中', mask: true });

    try {
      await callFunction('selectAIStudioPortraitCells', payload);
      wx.hideLoading();
      wx.showToast({ title: '选片已提交', icon: 'success' });
      this.setData({ selectedCells: [], selectedMap: {} });
      this.loadDetail();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ isSubmittingCells: false });
    }
  }
});

function getTempUrls(fileList) {
  if (!fileList.length) return Promise.resolve([]);
  return new Promise(resolve => {
    wx.cloud.getTempFileURL({
      fileList,
      success: res => {
        resolve((res.fileList || []).map(item => item.tempFileURL).filter(Boolean));
      },
      fail: () => resolve([])
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
