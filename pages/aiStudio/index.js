const {
  PRODUCTS,
  STYLES,
  PORTRAIT_THEMES,
  STATUS_LABELS,
  PHOTO_CHECK_LABELS,
  AUTHORIZATION_TEXT,
  PRODUCT_EXAMPLES
} = require('../../utils/ai-studio-config');

Page({
  data: {
    products: PRODUCTS,
    styles: STYLES,
    portraitThemes: PORTRAIT_THEMES,
    statusLabels: STATUS_LABELS,
    photoCheckLabels: PHOTO_CHECK_LABELS,
    authorizationText: AUTHORIZATION_TEXT,
    productExamples: PRODUCT_EXAMPLES,
    currentExample: PRODUCT_EXAMPLES[PRODUCTS[0].productId],
    selectedProductId: PRODUCTS[0].productId,
    selectedStyleId: STYLES[0].styleId,
    isPortrait: false,
    selectedThemeId: '',
    currentTheme: null,
    currentThemeTips: [],
    sceneDesc: '',
    backgroundOptions: ['白底', '蓝底', '红底', '灰底'],
    clothingOptions: ['保持原服装', '白衬衫', '深色西装'],
    specOptions: ['一寸', '二寸', '考试报名', '社保照', '简历头像'],
    backgroundIndex: 0,
    clothingIndex: 0,
    specIndex: 0,
    customerNote: '',
    contactPhone: '',
    queryPassword: '',
    showQueryPanel: false,
    queryOrderId: '',
    queryContactPhone: '',
    queryOrderPassword: '',
    photos: [],
    authorization: {
      isSelfOrAuthorized: false,
      isAdult: false,
      agreesProduction: false
    },
    orders: [],
    isLoading: false,
    isSubmitting: false
  },

  onLoad() {
    this.loadOrders();
  },

  onShow() {
    this.loadOrders();
  },

  goBack() {
    const pages = getCurrentPages ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: '/pages/aiStudio/index' });
    }
  },

  selectProduct(e) {
    const selectedProductId = e.currentTarget.dataset.id;
    const product = PRODUCTS.find(item => item.productId === selectedProductId);
    const isPortrait = Boolean(product && product.productType === 'portrait');

    if (isPortrait) {
      const themeId = this.data.selectedThemeId
        || (PORTRAIT_THEMES[0] && PORTRAIT_THEMES[0].themeId)
        || '';

      this.setData(Object.assign({
        selectedProductId,
        selectedStyleId: '',
        selectedThemeId: themeId,
        isPortrait: true,
        currentExample: PRODUCT_EXAMPLES[selectedProductId] || null
      }, buildThemeState(themeId)));
      return;
    }

    const nextStyle = product && product.productId === 'resume_photo_29_9'
      ? STYLES.find(item => item.styleId === 'ID-03')
      : STYLES[0];

    this.setData({
      selectedProductId,
      selectedStyleId: nextStyle ? nextStyle.styleId : this.data.selectedStyleId,
      selectedThemeId: '',
      isPortrait: false,
      currentTheme: null,
      currentThemeTips: [],
      currentExample: PRODUCT_EXAMPLES[selectedProductId] || PRODUCT_EXAMPLES[PRODUCTS[0].productId]
    });
  },

  selectStyle(e) {
    this.setData({ selectedStyleId: e.currentTarget.dataset.id });
  },

  selectTheme(e) {
    const themeId = e.currentTarget.dataset.id;
    this.setData(Object.assign({ selectedThemeId: themeId }, buildThemeState(themeId)));
  },

  onSceneDescInput(e) {
    this.setData({ sceneDesc: e.detail.value || '' });
  },

  onBackgroundChange(e) {
    this.setData({ backgroundIndex: Number(e.detail.value) || 0 });
  },

  onClothingChange(e) {
    this.setData({ clothingIndex: Number(e.detail.value) || 0 });
  },

  onSpecChange(e) {
    this.setData({ specIndex: Number(e.detail.value) || 0 });
  },

  onNoteInput(e) {
    this.setData({ customerNote: e.detail.value || '' });
  },

  onPhoneInput(e) {
    this.setData({ contactPhone: (e.detail.value || '').trim() });
  },

  onQueryPasswordInput(e) {
    this.setData({ queryPassword: (e.detail.value || '').trim() });
  },

  toggleQueryPanel() {
    this.setData({ showQueryPanel: !this.data.showQueryPanel });
  },

  onQueryOrderIdInput(e) {
    this.setData({ queryOrderId: (e.detail.value || '').trim() });
  },

  onQueryPhoneInput(e) {
    this.setData({ queryContactPhone: (e.detail.value || '').trim() });
  },

  onQueryOrderPasswordInput(e) {
    this.setData({ queryOrderPassword: (e.detail.value || '').trim() });
  },

  onAuthChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`authorization.${field}`]: !!e.detail.value
    });
  },

  choosePhotos() {
    const remain = 3 - this.data.photos.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传 3 张照片', icon: 'none' });
      return;
    }

    const onSuccess = (files) => {
      const nextPhotos = files
        .map(file => ({
          tempFilePath: file.tempFilePath || file.path,
          size: file.size || 0
        }))
        .filter(file => file.tempFilePath && file.size <= 10 * 1024 * 1024);

      if (nextPhotos.length !== files.length) {
        wx.showToast({ title: '已忽略超过 10MB 的图片', icon: 'none' });
      }

      this.setData({
        photos: this.data.photos.concat(nextPhotos).slice(0, 3)
      });
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

  removePhoto(e) {
    const index = Number(e.currentTarget.dataset.index);
    const photos = this.data.photos.slice();
    photos.splice(index, 1);
    this.setData({ photos });
  },

  async submitOrder() {
    if (this.data.isSubmitting) return;
    if (this.data.photos.length < 1) {
      wx.showToast({ title: '请至少上传 1 张正脸照', icon: 'none' });
      return;
    }

    const auth = this.data.authorization;
    if (!auth.isSelfOrAuthorized || !auth.isAdult || !auth.agreesProduction) {
      wx.showToast({ title: '请先完成授权确认', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(this.data.contactPhone)) {
      wx.showToast({ title: '请填写正确手机号', icon: 'none' });
      return;
    }
    if (this.data.queryPassword.length < 6) {
      wx.showToast({ title: '查询密码至少 6 位', icon: 'none' });
      return;
    }
    if (this.data.isPortrait && !this.data.selectedThemeId) {
      wx.showToast({ title: '请选择写真主题', icon: 'none' });
      return;
    }

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交订单中', mask: true });

    try {
      const orderPayload = {
        productId: this.data.selectedProductId,
        usage: this.data.specOptions[this.data.specIndex],
        backgroundColor: this.data.backgroundOptions[this.data.backgroundIndex],
        clothingOption: this.data.clothingOptions[this.data.clothingIndex],
        spec: this.data.specOptions[this.data.specIndex],
        customerNote: this.data.customerNote,
        contactPhone: this.data.contactPhone,
        queryPassword: this.data.queryPassword,
        authorization: auth
      };

      if (this.data.isPortrait) {
        orderPayload.styleId = '';
        orderPayload.themeId = this.data.selectedThemeId;
        orderPayload.sceneDesc = this.data.sceneDesc;
      } else {
        orderPayload.styleId = this.data.selectedStyleId;
      }

      const createRes = await callFunction('createAIStudioOrder', orderPayload);

      const orderId = createRes.order.orderId;

      for (let i = 0; i < this.data.photos.length; i += 1) {
        const photo = this.data.photos[i];
        const ext = getFileExtension(photo.tempFilePath);
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `ai-studio/${orderId}/customer/${Date.now()}-${i}.${ext}`,
          filePath: photo.tempFilePath
        });

        await callFunction('uploadAIStudioPhoto', {
          orderId,
          fileID: uploadRes.fileID,
          fileName: `customer-${i + 1}.${ext}`,
          size: photo.size,
          mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`
        });
      }

      await callFunction('submitAIStudioOrder', { orderId });
      wx.hideLoading();
      wx.showToast({ title: '订单已提交', icon: 'success' });

      this.setData({
        photos: [],
        customerNote: '',
        queryPassword: '',
        selectedThemeId: '',
        sceneDesc: '',
        currentTheme: null,
        currentThemeTips: [],
        authorization: {
          isSelfOrAuthorized: false,
          isAdult: false,
          agreesProduction: false
        }
      });

      this.loadOrders();
      wx.navigateTo({ url: `/pages/aiStudio/detail/detail?orderId=${orderId}` });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  async loadOrders() {
    this.setData({ isLoading: true });
    try {
      const res = await callFunction('listMyAIStudioOrders', { page: 0, pageSize: 10 });
      this.setData({
        orders: (res.data || []).map(order => ({
          ...order,
          statusText: STATUS_LABELS[order.order_status] || order.order_status,
          photoCheckText: PHOTO_CHECK_LABELS[order.photo_check] || order.photo_check
        }))
      });
    } catch (error) {
      console.warn('加载证件照订单失败:', error);
    } finally {
      this.setData({ isLoading: false });
    }
  },

  openOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/aiStudio/detail/detail?orderId=${orderId}` });
  },

  async queryOrder() {
    const orderId = this.data.queryOrderId;
    const contactPhone = this.data.queryContactPhone;
    const queryPassword = this.data.queryOrderPassword;

    if (!orderId) {
      wx.showToast({ title: '请输入订单号', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(contactPhone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }
    if (queryPassword.length < 6) {
      wx.showToast({ title: '查询密码至少 6 位', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '查询订单中', mask: true });
      await callFunction('queryAIStudioOrder', { orderId, contactPhone, queryPassword });

      const app = getApp();
      app.globalData.aiStudioOrderQuery = { orderId, contactPhone, queryPassword };

      wx.hideLoading();
      wx.navigateTo({ url: `/pages/aiStudio/detail/detail?orderId=${orderId}&query=1` });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '查询失败', icon: 'none' });
    }
  },

  openAdminLogin() {
    wx.navigateTo({ url: '/pages/aiStudio/adminLogin/adminLogin' });
  }
});

function getFileExtension(path) {
  const cleanPath = String(path || '').split('?')[0];
  const ext = cleanPath.includes('.') ? cleanPath.split('.').pop().toLowerCase() : 'jpg';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg';
}

function buildThemeState(themeId) {
  const theme = PORTRAIT_THEMES.find(item => item.themeId === themeId) || null;
  return {
    currentTheme: theme,
    currentThemeTips: theme ? splitSceneHint(theme.sceneHint) : []
  };
}

function splitSceneHint(hint) {
  return String(hint || '')
    .split(/[，、]/)
    .map(part => part.trim())
    .filter(Boolean);
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
