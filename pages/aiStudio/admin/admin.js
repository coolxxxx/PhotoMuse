const {
  STATUS_LABELS,
  PHOTO_CHECK_LABELS,
  PORTRAIT_THEMES
} = require('../../../utils/ai-studio-config');

// 样张管理用主题快捷项（与后端 adminUpsertAIStudioSamples 主题白名单一致）
const SAMPLE_THEME_OPTIONS = [
  { themeId: 'guofeng', label: '古风' },
  { themeId: 'sports', label: '运动' },
  { themeId: 'casual', label: '休闲' },
  { themeId: 'travel', label: '旅拍' },
  { themeId: 'family', label: '亲子' }
];

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
      { value: 'merch_pending', label: '待制作' },
      { value: 'in_production', label: '制作中' },
      { value: 'completed', label: '已完结' },
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
    },
    showSamplesPanel: false,
    isLoadingSamples: false,
    sampleGroups: [],
    showPricingPanel: false,
    isSavingPricing: false,
    pricingConfig: {
      baseThemePrice: '',
      extraThemePrice: '',
      maxThemes: '',
      photosPerTheme: ''
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

  // ---------------------------------------------------------------------
  // 样张管理
  // ---------------------------------------------------------------------
  toggleSamplesPanel() {
    const showSamplesPanel = !this.data.showSamplesPanel;
    this.setData({ showSamplesPanel });
    if (showSamplesPanel) this.loadSamples();
  },

  async loadSamples() {
    this.setData({ isLoadingSamples: true });
    try {
      const res = await callFunction('listAIStudioSamples', {});
      const samples = res.data || [];
      const urlMap = await getTempUrlMap(samples.map(sample => sample.fileID).filter(Boolean));

      const byTheme = {};
      samples.forEach(sample => {
        if (!byTheme[sample.themeId]) byTheme[sample.themeId] = [];
        byTheme[sample.themeId].push({
          sampleId: sample.sampleId,
          fileID: sample.fileID,
          caption: sample.caption || '',
          sortOrder: sample.sortOrder || 0,
          enabled: true,
          tempUrl: urlMap[sample.fileID] || ''
        });
      });

      this.setData({
        sampleGroups: PORTRAIT_THEMES.map(theme => ({
          themeId: theme.themeId,
          themeName: theme.name,
          items: byTheme[theme.themeId] || []
        }))
      });
    } catch (error) {
      wx.showToast({ title: error.message || '样张加载失败', icon: 'none' });
    } finally {
      this.setData({ isLoadingSamples: false });
    }
  },

  onSampleFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    const groupIndex = Number(e.currentTarget.dataset.groupIndex);
    const itemIndex = Number(e.currentTarget.dataset.itemIndex);
    if (!field || !Number.isInteger(groupIndex) || !Number.isInteger(itemIndex)) return;
    this.setData({ [`sampleGroups[${groupIndex}].items[${itemIndex}].${field}`]: e.detail.value });
  },

  onSampleEnabledChange(e) {
    const groupIndex = Number(e.currentTarget.dataset.groupIndex);
    const itemIndex = Number(e.currentTarget.dataset.itemIndex);
    if (!Number.isInteger(groupIndex) || !Number.isInteger(itemIndex)) return;
    this.setData({ [`sampleGroups[${groupIndex}].items[${itemIndex}].enabled`]: !!e.detail.value });
    this.saveSampleItemAt(groupIndex, itemIndex);
  },

  saveSampleItem(e) {
    this.saveSampleItemAt(Number(e.currentTarget.dataset.groupIndex), Number(e.currentTarget.dataset.itemIndex));
  },

  async saveSampleItemAt(groupIndex, itemIndex) {
    const group = this.data.sampleGroups[groupIndex];
    const sample = group && group.items[itemIndex];
    if (!group || !sample) return;

    const sortOrder = Number(sample.sortOrder);
    this.setData({ actionOrderId: 'sample-save' });
    try {
      await callFunction('adminUpsertAIStudioSamples', {
        adminPassword: getAdminPassword(),
        samples: [{
          sampleId: sample.sampleId,
          themeId: group.themeId,
          fileID: sample.fileID,
          caption: (sample.caption || '').trim(),
          sortOrder: Number.isFinite(sortOrder) && sortOrder >= 0 ? Math.min(999, Math.round(sortOrder)) : 0,
          enabled: sample.enabled !== false
        }]
      });
      wx.showToast({ title: '样张已保存', icon: 'success' });
      this.loadSamples();
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  removeSample(e) {
    const groupIndex = Number(e.currentTarget.dataset.groupIndex);
    const itemIndex = Number(e.currentTarget.dataset.itemIndex);
    const group = this.data.sampleGroups[groupIndex];
    const sample = group && group.items[itemIndex];
    if (!sample) return;

    wx.showModal({
      title: '删除样张',
      content: '确定从样张库删除该样张吗？',
      success: res => {
        if (res.confirm) this.removeSampleById(sample.sampleId);
      }
    });
  },

  async removeSampleById(sampleId) {
    this.setData({ actionOrderId: 'sample-save' });
    try {
      await callFunction('adminUpsertAIStudioSamples', {
        adminPassword: getAdminPassword(),
        samples: [],
        removeSampleIds: [sampleId]
      });
      wx.showToast({ title: '样张已删除', icon: 'success' });
      this.loadSamples();
    } catch (error) {
      wx.showToast({ title: error.message || '删除失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  pickSampleTheme() {
    return new Promise(resolve => {
      wx.showActionSheet({
        itemList: SAMPLE_THEME_OPTIONS.map(item => item.label),
        success: res => {
          const theme = SAMPLE_THEME_OPTIONS[res.tapIndex];
          resolve(theme ? theme.themeId : null);
        },
        fail: () => resolve(null)
      });
    });
  },

  uploadSample() {
    this.pickSampleTheme().then(themeId => {
      if (!themeId) return;

      const onPicked = file => {
        if (file) this.uploadSampleFile(themeId, file);
      };

      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
          success: res => onPicked((res.tempFiles || [])[0])
        });
      } else {
        wx.chooseImage({
          count: 1,
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
          success: res => {
            const path = (res.tempFilePaths || [])[0];
            if (!path) return;
            onPicked({ tempFilePath: path, size: 0 });
          }
        });
      }
    });
  },

  async uploadSampleFile(themeId, file) {
    const tempFilePath = file.tempFilePath || file.path;

    this.setData({ actionOrderId: 'sample-upload' });
    wx.showLoading({ title: '上传样张', mask: true });

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ai-studio/samples/${themeId}/${Date.now()}.jpg`,
        filePath: tempFilePath
      });
      await callFunction('adminUpsertAIStudioSamples', {
        adminPassword: getAdminPassword(),
        samples: [{ themeId, fileID: uploadRes.fileID, caption: '', sortOrder: 0 }]
      });

      wx.hideLoading();
      wx.showToast({ title: '样张已上传', icon: 'success' });
      this.loadSamples();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '样张上传失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  generateSample() {
    this.pickSampleTheme().then(themeId => {
      if (!themeId) return;

      wx.showModal({
        title: '关联订单',
        editable: true,
        placeholderText: '请输入用于生成样张的订单号',
        success: res => {
          if (!res.confirm) return;
          const orderId = (res.content || '').trim();
          if (!orderId) {
            wx.showToast({ title: '请输入订单号', icon: 'none' });
            return;
          }
          this.runSampleGeneration(orderId, themeId);
        }
      });
    });
  },

  async runSampleGeneration(orderId, themeId) {
    this.setData({ actionOrderId: 'gen-sample' });
    wx.showLoading({ title: 'AI 生成样张中，可能需要 1-2 分钟', mask: true });

    try {
      await callFunction('generateAIStudioImage', {
        adminPassword: getAdminPassword(),
        orderId,
        stage: 'sample',
        themeId
      });
      wx.hideLoading();
      wx.showToast({ title: '样张已生成，请刷新', icon: 'none' });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '生成失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  registerSampleFromFile() {
    wx.showModal({
      title: '从文件登记样张',
      editable: true,
      placeholderText: '粘贴生成图 fileID（cloud:// 开头）',
      success: res => {
        if (!res.confirm) return;
        const fileID = (res.content || '').trim();
        if (!fileID || fileID.indexOf('cloud://') !== 0) {
          wx.showToast({ title: 'fileID 需以 cloud:// 开头', icon: 'none' });
          return;
        }
        this.pickSampleTheme().then(themeId => {
          if (!themeId) return;
          this.saveRegisteredSample(themeId, fileID);
        });
      }
    });
  },

  async saveRegisteredSample(themeId, fileID) {
    this.setData({ actionOrderId: 'sample-upload' });
    wx.showLoading({ title: '登记样张', mask: true });

    try {
      await callFunction('adminUpsertAIStudioSamples', {
        adminPassword: getAdminPassword(),
        samples: [{ themeId, fileID, caption: '', sortOrder: 0 }]
      });

      wx.hideLoading();
      wx.showToast({ title: '样张已登记', icon: 'success' });
      this.loadSamples();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '登记失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  // ---------------------------------------------------------------------
  // 定价设置
  // ---------------------------------------------------------------------
  togglePricingPanel() {
    const showPricingPanel = !this.data.showPricingPanel;
    this.setData({ showPricingPanel });
    if (showPricingPanel) this.loadPricingConfig();
  },

  async loadPricingConfig() {
    try {
      const res = await callFunction('getAIStudioBusinessConfig', {});
      const config = res.config || {};
      this.setData({
        pricingConfig: {
          baseThemePrice: valueToString(config.baseThemePrice),
          extraThemePrice: valueToString(config.extraThemePrice),
          maxThemes: valueToString(config.maxThemes),
          photosPerTheme: valueToString(config.photosPerTheme)
        }
      });
    } catch (error) {
      wx.showToast({ title: error.message || '读取定价失败', icon: 'none' });
    }
  },

  onPricingFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`pricingConfig.${field}`]: e.detail.value });
  },

  async savePricingConfig() {
    const raw = this.data.pricingConfig;
    const baseThemePrice = Number(raw.baseThemePrice);
    const extraThemePrice = Number(raw.extraThemePrice);
    const maxThemes = Number(raw.maxThemes);
    const photosPerTheme = Number(raw.photosPerTheme);

    if (!Number.isFinite(baseThemePrice) || baseThemePrice < 1 || baseThemePrice > 99999 ||
      !Number.isFinite(extraThemePrice) || extraThemePrice < 1 || extraThemePrice > 99999) {
      wx.showToast({ title: '主题价格需为 1-99999 的数字', icon: 'none' });
      return;
    }
    if (!Number.isInteger(maxThemes) || maxThemes < 1 || maxThemes > 5) {
      wx.showToast({ title: '最多主题数需为 1-5 的整数', icon: 'none' });
      return;
    }
    if (!Number.isInteger(photosPerTheme) || photosPerTheme < 1 || photosPerTheme > 15) {
      wx.showToast({ title: '每主题成片数需为 1-15 的整数', icon: 'none' });
      return;
    }

    this.setData({ isSavingPricing: true });
    try {
      await callFunction('adminUpsertAIStudioBusinessConfig', {
        adminPassword: getAdminPassword(),
        config: { baseThemePrice, extraThemePrice, maxThemes, photosPerTheme }
      });
      wx.showToast({ title: '定价已保存', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ isSavingPricing: false });
    }
  },

  // ---------------------------------------------------------------------
  // 分主题出图
  // ---------------------------------------------------------------------
  generateReferenceImage(e) {
    this.runImageGeneration(e.currentTarget.dataset.id, 'reference');
  },

  async generateGridImage(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(item => item.orderId === orderId);
    const themeId = await this.resolveGenerationTheme(order);
    if (themeId === undefined) return;
    this.runImageGeneration(orderId, 'grid', null, themeId);
  },

  async generateCellImage(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(item => item.orderId === orderId);
    const themes = getOrderThemes(order);

    let themeId = null;
    let cells = [];

    if (themes.length > 1) {
      themeId = await this.resolveGenerationTheme(order);
      if (themeId === undefined) return;
      cells = normalizeCells((themes.find(theme => theme.themeId === themeId) || {}).selectedCells);
    } else {
      cells = normalizeCells(order && order.selected_cells);
      if (!cells.length && themes.length === 1) {
        cells = normalizeCells(themes[0].selectedCells);
      }
    }

    if (!cells.length) {
      wx.showToast({ title: '该订单暂无已选分镜', icon: 'none' });
      return;
    }

    wx.showActionSheet({
      itemList: cells.slice(0, 6).map(cell => `分镜 ${cell} 号`),
      success: res => {
        const cell = cells[res.tapIndex];
        if (cell) this.runImageGeneration(orderId, 'cell', cell, themeId);
      }
    });
  },

  resolveGenerationTheme(order) {
    return new Promise(resolve => {
      const themes = getOrderThemes(order);
      if (themes.length <= 1) {
        resolve(null);
        return;
      }
      wx.showActionSheet({
        itemList: themes.slice(0, 6).map(theme => theme.themeName || theme.themeId),
        success: res => {
          const theme = themes[res.tapIndex];
          resolve(theme ? theme.themeId : null);
        },
        fail: () => resolve(undefined)
      });
    });
  },

  async runImageGeneration(orderId, stage, cell, themeId) {
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
      if (themeId) payload.themeId = themeId;

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

  // ---------------------------------------------------------------------
  // 收款设置
  // ---------------------------------------------------------------------
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
        generatedFiles: (order.files || []).filter(file => (file.fileType === 'generated' || file.fileType === 'grid_preview' || file.fileType === 'print') && file.status === 'uploaded'),
        printTicketFiles: (order.files || []).filter(file => file.fileType === 'print_ticket' && file.status === 'uploaded'),
        merchItems: Array.isArray(order.merch_items) ? order.merch_items : [],
        merchTotal: typeof order.merch_total === 'number' ? order.merch_total : 0,
        hasSelectedCells: hasAnySelectedCells(order)
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

  // ---------------------------------------------------------------------
  // 周边制作流转与制作稿导出
  // ---------------------------------------------------------------------
  async startMerchProduction(e) {
    const orderId = e.currentTarget.dataset.id;
    this.setData({ actionOrderId: orderId });
    try {
      await callFunction('adminUpdateMerchProduction', {
        adminPassword: getAdminPassword(),
        orderId,
        action: 'start'
      });
      wx.showToast({ title: '已开始制作', icon: 'success' });
      this.loadOrders();
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  shipMerchProduction(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '发货完成',
      editable: true,
      placeholderText: '快递单号（可留空）',
      success: res => {
        if (!res.confirm) return;
        this.confirmShipMerch(orderId, (res.content || '').trim());
      }
    });
  },

  async confirmShipMerch(orderId, trackingNo) {
    this.setData({ actionOrderId: orderId });
    try {
      const payload = {
        adminPassword: getAdminPassword(),
        orderId,
        action: 'ship'
      };
      if (trackingNo) payload.trackingNo = trackingNo;

      await callFunction('adminUpdateMerchProduction', payload);
      wx.showToast({ title: '已完结', icon: 'success' });
      this.loadOrders();
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    } finally {
      this.setData({ actionOrderId: '' });
    }
  },

  async exportPrintFiles(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(item => item.orderId === orderId);
    const merchItems = (order && order.merchItems) || [];
    if (!merchItems.length) {
      wx.showToast({ title: '该订单暂无周边清单', icon: 'none' });
      return;
    }

    this.setData({ actionOrderId: `export:${orderId}` });
    const errors = [];

    for (let i = 0; i < merchItems.length; i += 1) {
      const merch = merchItems[i];
      wx.showLoading({ title: `导出制作稿 ${i + 1}/${merchItems.length}`, mask: true });
      try {
        await callFunction('exportAIStudioPrintFile', {
          adminPassword: getAdminPassword(),
          orderId,
          merchItemId: merch.merchItemId
        });
      } catch (error) {
        errors.push(`${merch.name || merch.merchItemId}：${error.message || '导出失败'}`);
      }
    }
    wx.hideLoading();

    if (errors.length) {
      wx.showToast({ title: errors.slice(0, 2).join('；'), icon: 'none' });
    } else {
      wx.showToast({ title: '制作稿已导出', icon: 'success' });
    }

    this.setData({ actionOrderId: '' });
    this.loadOrders();
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

function getOrderThemes(order) {
  if (!order) return [];
  const themes = Array.isArray(order.themes) ? order.themes : [];
  const cleaned = themes.filter(theme => theme && theme.themeId)
    .map(theme => ({ themeId: theme.themeId, themeName: theme.themeName || '', selectedCells: theme.selectedCells }));
  if (cleaned.length) return cleaned;
  if (order.theme_id) {
    return [{ themeId: order.theme_id, themeName: order.theme_name || '', selectedCells: order.selected_cells }];
  }
  return [];
}

function normalizeCells(cells) {
  return ((Array.isArray(cells) ? cells : []) || [])
    .map(cell => Number(cell))
    .filter(cell => Number.isInteger(cell) && cell > 0)
    .sort((a, b) => a - b);
}

function hasAnySelectedCells(order) {
  if (Array.isArray(order.selected_cells) && order.selected_cells.length > 0) return true;
  if (Array.isArray(order.themes)) {
    return order.themes.some(theme => theme && Array.isArray(theme.selectedCells) && theme.selectedCells.length > 0);
  }
  return false;
}

function valueToString(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '';
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
