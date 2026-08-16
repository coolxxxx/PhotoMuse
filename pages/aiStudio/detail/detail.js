const {
  STATUS_LABELS,
  PHOTO_CHECK_LABELS,
  PORTRAIT_THEMES
} = require('../../../utils/ai-studio-config');

const GRID_CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const DEFAULT_PHOTOS_PER_THEME = 5;

const MERCH_CATEGORY_LABELS = {
  wall: '挂墙',
  desk: '摆台',
  calendar: '挂历',
  wallet: '钱包照',
  pendant: '挂件',
  album: '相册'
};

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
    gridCells: GRID_CELLS,
    // 分主题网格选片视图（兼容旧单主题订单：只渲染一个主题）
    themes: [],
    selectedThemes: [],
    // 周边好物区块
    showMerch: false,
    merchMode: '', // shop=商品网格 / selected=已选周边清单
    merchList: [],
    merchItems: [],
    merchTotal: '',
    merchStatusHint: '',
    hasPrintableFiles: false,
    isLoading: false,
    isUploading: false,
    isLoadingMerch: false,
    merchLoaded: false,
    queryMode: false
  },

  onLoad(options) {
    // 可搭配周边的成片 fileID 列表（非渲染态，避免大数据频繁 setData）
    this.printableFileIDs = [];
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
      paymentChecked: false
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

      // 分主题网格预览：grid_preview 按 themeId 归属到主题（旧接口未回传 themeId 时按上传顺序兜底）
      const activeGrids = collectActiveGrids(files);
      const urlMap = await getTempUrlMap(activeGrids.map(file => file.fileID));

      const themes = buildThemeViews(res.order, activeGrids, urlMap);
      const selectedThemes = buildSelectedThemes(themes, res.order);

      // 周边好物：已选片/已交付展示商品网格；已提交过周边（merch_items）后展示清单与制作进度
      const orderStatus = res.order.order_status;
      const hasMerchItems = Array.isArray(res.order.merch_items) && res.order.merch_items.length > 0;
      const showMerch = res.order.product_type === 'portrait'
        && (orderStatus === 'cell_selected' || orderStatus === 'delivered' || hasMerchItems);

      // 可用于周边搭配的成片：delivery / generated（与服务端 selectAIStudioMerch 校验口径一致）
      this.printableFileIDs = collectPrintableFileIDs(files);

      this.setData({
        order: {
          ...res.order,
          statusText: STATUS_LABELS[res.order.order_status] || res.order.order_status,
          photoCheckText: PHOTO_CHECK_LABELS[res.order.photo_check] || res.order.photo_check
        },
        customerFiles: files.filter(file => file.fileType === 'customer_photo'),
        deliveryFiles,
        deliveryUrls,
        themes,
        selectedThemes,
        showMerch,
        merchMode: hasMerchItems ? 'selected' : 'shop',
        merchItems: hasMerchItems ? res.order.merch_items : [],
        merchTotal: hasMerchItems ? formatAmount(res.order.merch_total) : '',
        merchStatusHint: hasMerchItems ? buildMerchStatusHint(res.order) : '',
        hasPrintableFiles: this.printableFileIDs.length > 0
      });

      if (showMerch && !hasMerchItems && !this.data.merchLoaded) {
        this.loadMerchList();
      }

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

  previewThemeGrid(e) {
    const index = Number(e.currentTarget.dataset.themeIndex);
    const theme = this.data.themes[index];
    if (!theme || !theme.previewUrl) return;
    const urls = this.data.themes.map(item => item.previewUrl).filter(Boolean);
    wx.previewImage({
      current: theme.previewUrl,
      urls: urls.length ? urls : [theme.previewUrl]
    });
  },

  toggleThemeCell(e) {
    const index = Number(e.currentTarget.dataset.themeIndex);
    const theme = this.data.themes[index];
    const cell = Number(e.currentTarget.dataset.cell);
    if (!theme || !GRID_CELLS.includes(cell)) return;

    const selectedCells = theme.selectedCells.slice();
    const pos = selectedCells.indexOf(cell);

    if (pos >= 0) {
      selectedCells.splice(pos, 1);
    } else {
      if (selectedCells.length >= theme.maxCells) {
        wx.showToast({ title: `最多选择 ${theme.maxCells} 个分镜`, icon: 'none' });
        return;
      }
      selectedCells.push(cell);
    }

    selectedCells.sort((a, b) => a - b);
    const selectedMap = {};
    selectedCells.forEach(item => { selectedMap[item] = true; });

    this.setData({
      [`themes[${index}].selectedCells`]: selectedCells,
      [`themes[${index}].selectedMap`]: selectedMap
    });
  },

  async submitThemeCells(e) {
    const index = Number(e.currentTarget.dataset.themeIndex);
    const theme = this.data.themes[index];
    if (!theme || theme.submitting) return;
    if (!theme.selectedCells.length) {
      wx.showToast({ title: '请先选择分镜', icon: 'none' });
      return;
    }

    const payload = {
      orderId: this.data.orderId,
      themeId: theme.themeId,
      cells: theme.selectedCells.slice()
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

    this.setData({ [`themes[${index}].submitting`]: true });
    wx.showLoading({ title: '提交选片中', mask: true });

    try {
      const res = await callFunction('selectAIStudioPortraitCells', payload);
      wx.hideLoading();
      // 全部主题选完订单才进入 cell_selected，以返回的 order_status 提示
      const nextStatus = res.order && res.order.order_status;
      wx.showToast({
        title: nextStatus === 'cell_selected' ? '选片已提交' : '本主题已选，还有主题待选',
        icon: 'none'
      });
      this.loadDetail();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      const current = this.data.themes[index];
      if (current) this.setData({ [`themes[${index}].submitting`]: false });
    }
  },

  async loadMerchList() {
    if (this.data.isLoadingMerch) return;
    this.setData({ isLoadingMerch: true });

    try {
      const res = await callFunction('listAIStudioMerchandise', {});
      const merchList = (res.data || []).map(item => ({
        merchId: item.merchId,
        name: item.name,
        desc: item.desc || '',
        price: formatAmount(item.price),
        categoryLabel: MERCH_CATEGORY_LABELS[item.category] || '周边',
        ratioText: item.imageRatio ? `画面比例 ${item.imageRatio}` : ''
      }));
      this.setData({ merchList, merchLoaded: true });
    } catch (error) {
      wx.showToast({ title: error.message || '周边清单加载失败', icon: 'none' });
    } finally {
      this.setData({ isLoadingMerch: false });
    }
  },

  goMerchShowcase(e) {
    const merchId = e.currentTarget.dataset.merch;
    const fileIDs = this.printableFileIDs || [];
    if (!fileIDs.length) {
      wx.showToast({ title: '成片制作完成后即可搭配周边', icon: 'none' });
      return;
    }

    const url = `/pages/aiStudio/showcase/showcase`
      + `?orderId=${this.data.orderId}`
      + `&merchId=${merchId}`
      + `&fileIDs=${encodeURIComponent(JSON.stringify(fileIDs))}`;

    wx.navigateTo({
      url,
      fail: () => wx.showToast({ title: '搭配页暂未开放', icon: 'none' })
    });
  }
});

// ---------------------------------------------------------------------------
// 分主题选片视图构建
// ---------------------------------------------------------------------------

// 归一化主题清单：新订单读 themes 数组；旧订单回退 theme_id/theme_name + selected_cells
function extractThemeMeta(order) {
  if (Array.isArray(order.themes) && order.themes.length > 0) {
    return order.themes
      .filter(item => item && item.themeId)
      .map(item => ({
        themeId: String(item.themeId),
        themeName: item.themeName || lookupThemeName(item.themeId),
        selectedCells: Array.isArray(item.selectedCells) ? item.selectedCells : []
      }));
  }

  const legacyCells = Array.isArray(order.selected_cells) ? order.selected_cells : [];
  if (order.theme_id || legacyCells.length) {
    return [{
      themeId: String(order.theme_id || ''),
      themeName: order.theme_name || lookupThemeName(order.theme_id) || '写真主题',
      selectedCells: legacyCells
    }];
  }
  if (order.product_type === 'portrait') {
    return [{ themeId: '', themeName: '写真主题', selectedCells: [] }];
  }
  return [];
}

function lookupThemeName(themeId) {
  const hit = PORTRAIT_THEMES.find(item => item.themeId === themeId);
  return hit ? hit.name : '';
}

// 与服务端口径一致：多主题每主题上限 = floor(deliveryCount / themeCount)，非法时兜底 5
function computePerThemeMax(deliveryCount, themeCount) {
  const total = Number(deliveryCount);
  const per = themeCount > 0 ? Math.floor(total / themeCount) : 0;
  return Number.isFinite(per) && per >= 1 ? per : DEFAULT_PHOTOS_PER_THEME;
}

function collectActiveGrids(files) {
  return files.filter(file => file.fileType === 'grid_preview' && file.status !== 'replaced');
}

// grid_preview 归属：优先按文件 themeId 精确匹配；接口未回传 themeId 时按上传顺序对位兜底
function matchGridForTheme(grids, meta, themeIndex, metaList, multi) {
  if (!grids.length) return null;

  if (meta.themeId) {
    const exact = grids.filter(file => file.themeId === meta.themeId);
    if (exact.length) return exact[exact.length - 1];
  }
  if (!multi) return grids[grids.length - 1];

  const knownIds = metaList.map(item => item.themeId).filter(Boolean);
  const unmatched = grids.filter(file => !file.themeId || knownIds.indexOf(file.themeId) < 0);
  return unmatched[themeIndex] || null;
}

function buildThemeViews(order, activeGrids, urlMap) {
  const metaList = extractThemeMeta(order);
  if (!metaList.length) return [];

  const multi = Array.isArray(order.themes) && order.themes.length > 0;
  let maxCells;
  if (multi) {
    maxCells = computePerThemeMax(order.deliveryCount, metaList.length);
  } else {
    const legacyCount = Number(order.deliveryCount);
    maxCells = legacyCount > 0 ? legacyCount : DEFAULT_PHOTOS_PER_THEME;
  }

  return metaList.map((meta, index) => {
    const gridFile = matchGridForTheme(activeGrids, meta, index, metaList, multi);
    const selectedCells = (Array.isArray(meta.selectedCells) ? meta.selectedCells : [])
      .map(Number)
      .filter(num => Number.isInteger(num))
      .sort((a, b) => a - b);
    const selectedMap = {};
    selectedCells.forEach(cell => { selectedMap[cell] = true; });

    return {
      key: meta.themeId || `theme-${index}`,
      themeId: meta.themeId,
      themeName: meta.themeName,
      previewUrl: gridFile ? (urlMap[gridFile.fileID] || '') : '',
      selectedCells,
      selectedMap,
      hasSelected: selectedCells.length > 0,
      maxCells,
      submitting: false
    };
  });
}

function buildSelectedThemes(themes, order) {
  const groups = themes
    .filter(theme => theme.selectedCells.length > 0)
    .map((theme, index) => ({
      key: `sel-${theme.key || index}`,
      themeName: theme.themeName,
      cells: theme.selectedCells
    }));

  if (!groups.length && Array.isArray(order.selected_cells) && order.selected_cells.length) {
    groups.push({ key: 'sel-legacy', themeName: '', cells: order.selected_cells });
  }
  return groups;
}

// ---------------------------------------------------------------------------
// 周边好物视图
// ---------------------------------------------------------------------------

function collectPrintableFileIDs(files) {
  const ids = [];
  files.forEach(file => {
    if ((file.fileType === 'delivery' || file.fileType === 'generated')
      && file.status !== 'replaced' && file.fileID && ids.indexOf(file.fileID) < 0) {
      ids.push(file.fileID);
    }
  });
  return ids;
}

function buildMerchStatusHint(order) {
  if (order.trackingNo) return `已发货 · 快递单号 ${order.trackingNo}`;
  if (order.order_status === 'completed') return '周边已制作完成';
  return '商家制作中，制作完成后发货';
}

function formatAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '0';
}

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

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

function getTempUrlMap(fileList) {
  if (!fileList.length) return Promise.resolve({});
  return new Promise(resolve => {
    wx.cloud.getTempFileURL({
      fileList,
      success: res => {
        const map = {};
        (res.fileList || []).forEach(item => {
          if (item.tempFileURL) map[item.fileID] = item.tempFileURL;
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
