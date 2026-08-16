// pages/aiStudio/showcase/showcase.js - 周边场景模拟展示页
// 仅从登录态订单详情进入：选成片 + 选周边品类，纯 CSS 实时模拟实物效果

// 与云函数 selectAIStudioMerch 的 DEFAULT_MERCH 保持一致（本地仅做展示与预估，提交以服务端 merch_total 为准）
const MERCH_CATALOG = [
  { merchId: 'wall_8', label: '挂墙·8寸', category: 'wall', price: 49 },
  { merchId: 'wall_12', label: '挂墙·12寸', category: 'wall', price: 79 },
  { merchId: 'desk_5', label: '水晶摆台', category: 'desk', price: 29 },
  { merchId: 'calendar', label: '挂历', category: 'calendar', price: 39 },
  { merchId: 'wallet', label: '钱包照', category: 'wallet', price: 9.9 },
  { merchId: 'pendant', label: '亚克力挂件', category: 'pendant', price: 19 },
  { merchId: 'album', label: '精装相册', category: 'album', price: 69 }
];

const WEEK_HEADER = ['日', '一', '二', '三', '四', '五', '六'];
const WALLET_CARD_COUNT = 6;
const MAX_QTY = 9;
const MAX_CART_ITEMS = 20;
const PHOTO_LIMIT = 50;

Page({
  data: {
    orderId: '',
    catalog: [],
    activeMerchId: 'wall_8',
    activeLabel: '',
    activePriceText: '',
    photos: [],
    currentPhotoIndex: 0,
    currentPhotoUrl: '',
    walletCards: [],
    pendantPhotos: [],
    albumPhotos: [],
    calendarMonths: [],
    calendarRange: '',
    cart: [],
    cartTotalText: '0',
    isLoadingPhotos: false,
    isSubmitting: false
  },

  onLoad(options) {
    const catalog = MERCH_CATALOG.map(item => ({
      ...item,
      priceText: formatPrice(item.price)
    }));
    const requested = String(options.merchId || '');
    const activeMerchId = MERCH_CATALOG.some(item => item.merchId === requested)
      ? requested
      : MERCH_CATALOG[0].merchId;

    this.applyActive(activeMerchId);
    this.setData({
      orderId: String(options.orderId || ''),
      catalog,
      calendarMonths: buildCalendarMonths(),
      calendarRange: buildCalendarRange()
    });
    this.initPhotos(options.fileIDs);
  },

  goBack() {
    const pages = getCurrentPages ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.redirectTo({ url: '/pages/aiStudio/index' });
    }
  },

  async initPhotos(rawFileIDs) {
    const fileIDs = parseFileIDs(rawFileIDs);
    if (!fileIDs.length) {
      this.updateScenePhotos();
      return;
    }

    this.setData({ isLoadingPhotos: true });
    try {
      // 逐个换取临时链接，避免一次性批量失败
      const photos = await resolvePhotos(fileIDs);
      this.setData({ photos, isLoadingPhotos: false });
      this.updateScenePhotos();
    } catch (error) {
      this.setData({ isLoadingPhotos: false });
      this.updateScenePhotos();
    }
  },

  applyActive(merchId) {
    const merch = findMerch(merchId) || MERCH_CATALOG[0];
    this.setData({
      activeMerchId: merch.merchId,
      activeLabel: merch.label,
      activePriceText: formatPrice(merch.price)
    });
  },

  switchMerch(e) {
    const merchId = String(e.currentTarget.dataset.merchId || '');
    if (!merchId || merchId === this.data.activeMerchId) return;
    this.applyActive(merchId);
  },

  // 换照片后即时重渲染所有场景派生数据
  updateScenePhotos() {
    const photos = this.data.photos;
    if (!photos.length) {
      this.setData({
        currentPhotoIndex: 0,
        currentPhotoUrl: '',
        walletCards: [],
        pendantPhotos: [],
        albumPhotos: []
      });
      return;
    }

    const index = Math.min(this.data.currentPhotoIndex, photos.length - 1);
    const pick = offset => photos[(index + offset) % photos.length] || {};
    const urlOf = photo => photo.url || '';

    this.setData({
      currentPhotoIndex: index,
      currentPhotoUrl: urlOf(photos[index]),
      walletCards: buildRange(WALLET_CARD_COUNT).map(slot => ({
        slot,
        url: urlOf(pick(slot))
      })),
      pendantPhotos: [
        { slot: 0, url: urlOf(pick(0)) },
        { slot: 1, url: urlOf(pick(1)) }
      ],
      albumPhotos: [
        { slot: 0, url: urlOf(pick(0)) },
        { slot: 1, url: urlOf(pick(1)) }
      ]
    });
  },

  onScenePhotoTap() {
    const photos = this.data.photos;
    if (!photos.length) {
      wx.showToast({ title: '暂无成片可选', icon: 'none' });
      return;
    }
    if (photos.length === 1) {
      wx.showToast({ title: '当前订单只有 1 张成片', icon: 'none' });
      return;
    }
    if (photos.length > 6) {
      // showActionSheet 最多 6 项，超出时引导使用底部照片条
      wx.showToast({ title: '请通过下方照片条切换成片', icon: 'none' });
      return;
    }

    wx.showActionSheet({
      itemList: photos.map((photo, index) => `成片 ${index + 1}`),
      success: res => this.setCurrentPhoto(res.tapIndex)
    });
  },

  onStripPhotoTap(e) {
    this.setCurrentPhoto(Number(e.currentTarget.dataset.index));
  },

  setCurrentPhoto(index) {
    if (!(index >= 0) || index >= this.data.photos.length) return;
    if (index === this.data.currentPhotoIndex) return;
    this.setData({ currentPhotoIndex: index });
    this.updateScenePhotos();
  },

  addToCart() {
    const photo = this.data.photos[this.data.currentPhotoIndex];
    if (!photo) {
      wx.showToast({ title: '暂无成片可选', icon: 'none' });
      return;
    }

    const merch = findMerch(this.data.activeMerchId) || MERCH_CATALOG[0];
    const key = `${merch.merchId}::${photo.fileID}`;
    const cart = this.data.cart.slice();
    const existing = cart.find(item => item.key === key);

    if (existing) {
      if (existing.qty >= MAX_QTY) {
        wx.showToast({ title: '每项最多 9 件', icon: 'none' });
        return;
      }
      existing.qty += 1;
    } else {
      if (cart.length >= MAX_CART_ITEMS) {
        wx.showToast({ title: '最多 20 个周边项', icon: 'none' });
        return;
      }
      cart.push({
        key,
        merchId: merch.merchId,
        label: merch.label,
        price: merch.price,
        priceText: formatPrice(merch.price),
        fileID: photo.fileID,
        photoUrl: photo.url || '',
        qty: 1
      });
    }

    this.setData({ cart });
    this.recalcCart();
  },

  onQtyMinus(e) {
    const index = Number(e.currentTarget.dataset.index);
    const cart = this.data.cart.slice();
    const item = cart[index];
    if (!item || item.qty <= 1) return;
    item.qty -= 1;
    this.setData({ cart });
    this.recalcCart();
  },

  onQtyPlus(e) {
    const index = Number(e.currentTarget.dataset.index);
    const cart = this.data.cart.slice();
    const item = cart[index];
    if (!item) return;
    if (item.qty >= MAX_QTY) {
      wx.showToast({ title: '每项最多 9 件', icon: 'none' });
      return;
    }
    item.qty += 1;
    this.setData({ cart });
    this.recalcCart();
  },

  removeCartItem(e) {
    const index = Number(e.currentTarget.dataset.index);
    const cart = this.data.cart.slice();
    cart.splice(index, 1);
    this.setData({ cart });
    this.recalcCart();
  },

  recalcCart() {
    const total = round1(this.data.cart.reduce((sum, item) => sum + item.price * item.qty, 0));
    this.setData({ cartTotalText: formatPrice(total) });
  },

  async submitMerch() {
    if (this.data.isSubmitting) return;
    if (!this.data.orderId) {
      wx.showToast({ title: '缺少订单号，请从订单详情进入', icon: 'none' });
      return;
    }
    if (!this.data.cart.length) {
      wx.showToast({ title: '请先添加周边项', icon: 'none' });
      return;
    }

    const items = this.data.cart.map(item => ({
      merchId: item.merchId,
      fileID: item.fileID,
      qty: item.qty
    }));

    this.setData({ isSubmitting: true });
    wx.showLoading({ title: '提交中', mask: true });

    try {
      // 登录态直接调用，最终金额以服务端 merch_total 为准
      await callFunction('selectAIStudioMerch', {
        orderId: this.data.orderId,
        items
      });
      wx.hideLoading();
      wx.showToast({ title: '周边已选定，商家将安排制作', icon: 'none', duration: 1600 });
      setTimeout(() => this.goBack(), 1700);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ isSubmitting: false });
    }
  }
});

function findMerch(merchId) {
  return MERCH_CATALOG.find(item => item.merchId === merchId);
}

function parseFileIDs(raw) {
  if (!raw) return [];
  let list = [];
  try {
    const parsed = JSON.parse(decodeURIComponent(String(raw)));
    if (Array.isArray(parsed)) list = parsed;
  } catch (error) {
    list = [];
  }
  return list
    .filter(id => typeof id === 'string' && id.startsWith('cloud://'))
    .slice(0, PHOTO_LIMIT);
}

function resolvePhotos(fileIDs) {
  const photos = [];
  const next = index => {
    if (index >= fileIDs.length) return Promise.resolve(photos);
    return getTempUrl(fileIDs[index]).then(url => {
      photos.push({ fileID: fileIDs[index], url });
      return next(index + 1);
    });
  };
  return next(0);
}

function getTempUrl(fileID) {
  return new Promise(resolve => {
    if (!wx.cloud || !wx.cloud.getTempFileURL) {
      resolve('');
      return;
    }
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: res => {
        const item = res.fileList && res.fileList[0];
        resolve((item && item.tempFileURL) || '');
      },
      fail: () => resolve('')
    });
  });
}

// 当月起 13 个月的示意月历：月名 + 星期表头 + 日期点阵（按真实首日星期对齐）
function buildCalendarMonths() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 13; i += 1) {
    const first = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const offset = first.getDay();
    const cells = [];
    for (let b = 0; b < offset; b += 1) cells.push({ id: `b${b}`, on: 0 });
    for (let day = 1; day <= days; day += 1) cells.push({ id: `d${day}`, on: 1 });
    months.push({
      label: `${first.getMonth() + 1}月`,
      header: WEEK_HEADER,
      cells
    });
  }
  return months;
}

function buildCalendarRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 12, 1);
  return `${start.getFullYear()}.${pad2(start.getMonth() + 1)} — ${end.getFullYear()}.${pad2(end.getMonth() + 1)}`;
}

function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}

function buildRange(count) {
  const list = [];
  for (let i = 0; i < count; i += 1) list.push(i);
  return list;
}

function round1(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function formatPrice(value) {
  const rounded = round1(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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
