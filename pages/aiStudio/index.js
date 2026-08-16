const {
  PRODUCTS,
  STYLES,
  PORTRAIT_THEMES,
  PORTRAIT_PRICING,
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
    selectedThemeIds: [],
    currentTheme: null,
    currentThemeTips: [],
    // 影楼三块新能力：样张 / 阶梯价格条 / AI 推荐主题
    samples: [],
    samplesByTheme: {},
    businessConfig: Object.assign({}, PORTRAIT_PRICING),
    priceBar: computePriceBar(PORTRAIT_PRICING, []),
    analysisResult: null,
    isAnalyzing: false,
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
    // 并行拉取写真样张 + 阶梯定价配置（getAIStudioBusinessConfig 为独立云函数）
    Promise.all([this.loadBusinessConfig(), this.loadSamples()]).catch(() => {});
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

  // ---------------------------------------------------------------------------
  // 套餐切换（联动重置多选主题 / AI 推荐结果 / 价格条）
  // ---------------------------------------------------------------------------

  selectProduct(e) {
    const selectedProductId = e.currentTarget.dataset.id;
    const product = PRODUCTS.find(item => item.productId === selectedProductId);
    const isPortrait = Boolean(product && product.productType === 'portrait');

    if (isPortrait) {
      const keep = (this.data.selectedThemeIds || [])
        .filter(id => PORTRAIT_THEMES.some(theme => theme.themeId === id));
      const themeIds = keep.length > 0
        ? keep
        : (PORTRAIT_THEMES[0] ? [PORTRAIT_THEMES[0].themeId] : []);

      this.setData(Object.assign({
        selectedProductId,
        selectedStyleId: '',
        selectedThemeIds: themeIds,
        analysisResult: null,
        isPortrait: true,
        currentExample: PRODUCT_EXAMPLES[selectedProductId] || null,
        priceBar: computePriceBar(this.data.businessConfig, themeIds)
      }, buildThemeState(themeIds[themeIds.length - 1])));
      return;
    }

    const nextStyle = product && product.productId === 'resume_photo_29_9'
      ? STYLES.find(item => item.styleId === 'ID-03')
      : STYLES[0];

    this.setData({
      selectedProductId,
      selectedStyleId: nextStyle ? nextStyle.styleId : this.data.selectedStyleId,
      selectedThemeIds: [],
      isPortrait: false,
      currentTheme: null,
      currentThemeTips: [],
      analysisResult: null,
      currentExample: PRODUCT_EXAMPLES[selectedProductId] || PRODUCT_EXAMPLES[PRODUCTS[0].productId],
      priceBar: computePriceBar(this.data.businessConfig, [])
    });
  },

  selectStyle(e) {
    this.setData({ selectedStyleId: e.currentTarget.dataset.id });
  },

  // ---------------------------------------------------------------------------
  // 功能二：主题多选（上限 maxThemes）+ 实时阶梯价格条
  // ---------------------------------------------------------------------------

  selectTheme(e) {
    const themeId = e.currentTarget.dataset.id;
    if (!themeId) return;

    const selected = this.data.selectedThemeIds || [];
    const maxThemes = getMaxThemes(this.data.businessConfig);
    let next = selected;

    if (selected.indexOf(themeId) > -1) {
      next = selected.filter(id => id !== themeId);
    } else if (selected.length >= maxThemes) {
      wx.showToast({ title: `最多选择 ${maxThemes} 个主题`, icon: 'none' });
    } else {
      next = selected.concat(themeId);
    }

    this.setData(Object.assign({
      selectedThemeIds: next,
      priceBar: computePriceBar(this.data.businessConfig, next)
    }, buildThemeState(themeId)));
  },

  // ---------------------------------------------------------------------------
  // 功能三：上传正脸照 -> AI 推荐主题
  // ---------------------------------------------------------------------------

  async runThemeAnalysis() {
    if (!this.data.isPortrait || this.data.isAnalyzing) return;

    const firstPhoto = this.data.photos[0];
    if (!firstPhoto || !firstPhoto.tempFilePath) {
      wx.showToast({ title: '请先上传一张正脸照', icon: 'none' });
      return;
    }

    this.setData({ isAnalyzing: true });
    wx.showLoading({ title: 'AI 分析中，约需 10 秒', mask: true });

    try {
      const ext = getFileExtension(firstPhoto.tempFilePath);
      // 分析用图不登记订单，走独立 analysis 路径
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ai-studio/analysis/${Date.now()}-0.${ext}`,
        filePath: firstPhoto.tempFilePath
      });

      const res = await callFunction('analyzeAIStudioPhoto', { fileID: uploadRes.fileID });
      wx.hideLoading();
      this.setData({ analysisResult: normalizeAnalysisResult(res.analysis) });
    } catch (error) {
      wx.hideLoading();
      if (error && error.code === 'CONFIG_MISSING') {
        wx.showToast({ title: error.message || '视觉模型未配置', icon: 'none', duration: 2500 });
        setTimeout(() => {
          wx.showToast({ title: '可联系客服人工推荐', icon: 'none', duration: 2500 });
        }, 2600);
        return;
      }
      wx.showToast({ title: (error && error.message) || 'AI 分析失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ isAnalyzing: false });
    }
  },

  applyAnalysisRecommendation() {
    const analysis = this.data.analysisResult;
    if (!analysis || !Array.isArray(analysis.scores) || analysis.scores.length === 0) return;

    const maxThemes = getMaxThemes(this.data.businessConfig);
    const recommendedIds = analysis.scores
      .slice(0, Math.min(2, maxThemes))
      .map(item => item.themeId)
      .filter(id => PORTRAIT_THEMES.some(theme => theme.themeId === id));

    if (recommendedIds.length === 0) return;

    this.setData(Object.assign({
      selectedThemeIds: recommendedIds,
      priceBar: computePriceBar(this.data.businessConfig, recommendedIds)
    }, buildThemeState(recommendedIds[0])));

    wx.showToast({ title: `已勾选 ${recommendedIds.length} 个推荐主题`, icon: 'none' });
  },

  // ---------------------------------------------------------------------------
  // 功能一：主题样张（listAIStudioSamples + getTempFileURL 换链）
  // ---------------------------------------------------------------------------

  previewSample(e) {
    const themeId = e.currentTarget.dataset.theme;
    const index = Number(e.currentTarget.dataset.index) || 0;
    const samples = (this.data.samplesByTheme[themeId] || [])
      .filter(item => item.tempFileUrl);

    if (samples.length === 0) return;

    const urls = samples.map(item => item.tempFileUrl);
    wx.previewImage({ current: urls[index] || urls[0], urls });
  },

  async loadSamples() {
    try {
      const res = await callFunction('listAIStudioSamples', {});
      const samples = (res.data || [])
        .filter(item => item && item.fileID && item.themeId);

      const grouped = {};
      PORTRAIT_THEMES.forEach(theme => { grouped[theme.themeId] = []; });
      samples.forEach(sample => {
        if (!grouped[sample.themeId]) grouped[sample.themeId] = [];
        grouped[sample.themeId].push(sample);
      });

      if (samples.length > 0) {
        const urlMap = {};
        const urlResult = await wx.cloud.getTempFileURL({
          fileList: samples.map(item => item.fileID)
        });
        (urlResult.fileList || []).forEach(file => {
          if (file && file.fileID && file.tempFileUrl) {
            urlMap[file.fileID] = file.tempFileUrl;
          }
        });
        Object.keys(grouped).forEach(themeId => {
          grouped[themeId] = grouped[themeId].map(sample => ({
            sampleId: sample.sampleId,
            fileID: sample.fileID,
            caption: sample.caption || '',
            tempFileUrl: urlMap[sample.fileID] || sample.fileID
          }));
        });
      }

      this.setData({ samples, samplesByTheme: grouped });
    } catch (error) {
      console.warn('加载写真样张失败:', error);
    }
  },

  async loadBusinessConfig() {
    try {
      const res = await callFunction('getAIStudioBusinessConfig', {});
      const config = normalizeBusinessConfig(res.config);
      this.setData({
        businessConfig: config,
        priceBar: computePriceBar(config, this.data.selectedThemeIds)
      });
    } catch (error) {
      console.warn('加载写真定价配置失败:', error);
    }
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
    if (this.data.isPortrait && this.data.selectedThemeIds.length === 0) {
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
        // 多主题套系：服务端按 themes 数组阶梯计价
        orderPayload.styleId = '';
        orderPayload.themes = this.data.selectedThemeIds.slice();
        orderPayload.sceneDesc = this.data.sceneDesc;
      } else {
        orderPayload.styleId = this.data.selectedStyleId;
      }

      const createRes = await callFunction('createAIStudioOrder', orderPayload);

      const orderId = createRes.order.orderId;
      const orderPrice = createRes.order.price;

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

      if (typeof orderPrice === 'number' && Number.isFinite(orderPrice)) {
        wx.showToast({ title: `订单已提交，应付 ¥${formatPrice(orderPrice)}`, icon: 'none', duration: 3000 });
      } else {
        wx.showToast({ title: '订单已提交', icon: 'success' });
      }

      this.setData({
        photos: [],
        customerNote: '',
        queryPassword: '',
        selectedThemeIds: [],
        sceneDesc: '',
        currentTheme: null,
        currentThemeTips: [],
        analysisResult: null,
        priceBar: computePriceBar(this.data.businessConfig, []),
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

// ---------------------------------------------------------------------------
// 纯工具函数
// ---------------------------------------------------------------------------

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

function getMaxThemes(config) {
  const parsed = Number(config && config.maxThemes);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : PORTRAIT_PRICING.maxThemes;
}

function normalizeBusinessConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  const baseThemePrice = Number(source.baseThemePrice);
  const extraThemePrice = Number(source.extraThemePrice);
  const photosPerTheme = Number(source.photosPerTheme);
  return {
    baseThemePrice: Number.isFinite(baseThemePrice) && baseThemePrice > 0
      ? Math.round(baseThemePrice * 10) / 10
      : PORTRAIT_PRICING.baseThemePrice,
    extraThemePrice: Number.isFinite(extraThemePrice) && extraThemePrice > 0
      ? Math.round(extraThemePrice * 10) / 10
      : PORTRAIT_PRICING.extraThemePrice,
    maxThemes: getMaxThemes(source),
    photosPerTheme: Number.isInteger(photosPerTheme) && photosPerTheme > 0
      ? photosPerTheme
      : PORTRAIT_PRICING.photosPerTheme
  };
}

function computePriceBar(config, themeIds) {
  const normalized = normalizeBusinessConfig(config);
  const count = Array.isArray(themeIds) ? themeIds.length : 0;
  const extraCount = Math.max(0, count - 1);
  const total = count > 0
    ? Math.round((normalized.baseThemePrice + extraCount * normalized.extraThemePrice) * 10) / 10
    : 0;

  let priceDetail;
  if (count === 0) {
    priceDetail = `基础 1 主题 ¥${formatPrice(normalized.baseThemePrice)}，每加 1 主题 +¥${formatPrice(normalized.extraThemePrice)}`;
  } else if (count === 1) {
    priceDetail = `基础 1 主题 ¥${formatPrice(normalized.baseThemePrice)}`;
  } else {
    priceDetail = `基础 1 主题 ¥${formatPrice(normalized.baseThemePrice)} + ${extraCount} 主题 ×¥${formatPrice(normalized.extraThemePrice)}`;
  }

  return {
    themeCount: count,
    maxThemes: normalized.maxThemes,
    priceDetail,
    priceTotal: count > 0 ? `¥${formatPrice(total)}` : `¥${formatPrice(normalized.baseThemePrice)} 起`,
    photoText: count > 0
      ? `${count * normalized.photosPerTheme} 张成片`
      : `每主题 ${normalized.photosPerTheme} 张`
  };
}

function normalizeAnalysisResult(analysis) {
  const raw = analysis && typeof analysis === 'object' ? analysis : {};
  const scores = (Array.isArray(raw.scores) ? raw.scores : [])
    .filter(item => item && item.themeId)
    .map(item => {
      const theme = PORTRAIT_THEMES.find(t => t.themeId === item.themeId);
      const score = Math.min(100, Math.max(0, Math.round(Number(item.score) || 0)));
      return {
        themeId: item.themeId,
        themeName: item.themeName || (theme ? theme.name : item.themeId),
        score,
        reason: item.reason || '暂无数据'
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    summary: raw.summary || 'AI 已完成照片分析，以下为各主题适配度。',
    scores
  };
}

function formatPrice(value) {
  const num = Math.round(Number(value) * 10) / 10;
  if (!Number.isFinite(num)) return '0';
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
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
          // 附带后端错误码（如 analyzeAIStudioPhoto 的 CONFIG_MISSING）供分支处理
          const error = new Error((res.result && res.result.message) || '操作失败');
          error.code = res.result && res.result.code;
          reject(error);
        }
      },
      fail: reject
    });
  });
}
