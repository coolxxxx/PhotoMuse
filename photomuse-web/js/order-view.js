/* ============================================================
 * 光影集 PhotoMuse Web · 订单视图渲染（order.html / query.html 复用）
 * 依赖：js/api.js（window.PM）
 * 用法：await PMOrderView.render(container, { order, files, creds, onUpdated })
 *   - order / files：getOrder 或 queryOrder 返回的数据
 *   - creds 二选一：{ webToken }（下单浏览器）或
 *     { contactPhone, queryPassword }（三元组，查询页选片用）
 *   - onUpdated：选片 / 补传等写操作成功后的回调（页面负责重新拉取数据）
 * 能力：
 *   - 分主题网格选片（多主题订单每主题独立预览 + 15 宫格；
 *     旧单主题订单自动兼容为单主题视图）
 *   - 周边好物区块（cell_selected / delivered / merch_pending 起展示；
 *     已提交周边后展示清单、合计与制作/发货进度）
 * ============================================================ */
'use strict';

window.PMOrderView = (() => {

  /* 状态文案映射（与小程序端 STATUS_LABELS 保持一致） */
  const STATUS_LABELS = {
    waiting_photos: '待上传照片',
    photo_review: '照片审核中',
    waiting_authorization: '待授权确认',
    queued: '已排单',
    grid_preview: '网格预览待选片',
    cell_selected: '已选片，制作中',
    generating: '出图中',
    qc: '质检中',
    delivered: '已交付',
    revision: '返修中',
    merch_pending: '周边待制作',
    in_production: '周边制作中',
    closed: '已完结',
    completed: '已完结',
    cancelled: '已取消'
  };

  const PHOTO_CHECK_LABELS = {
    unchecked: '未审核',
    passed: '照片合格',
    need_retake: '需要重拍',
    rejected: '不适合制作'
  };

  const PAYMENT_LABELS = { paid: '已支付', unpaid: '待支付', pending: '待支付', refunded: '已退款' };

  const STATUS_GUIDES = {
    waiting_photos: '订单已创建，等待照片上传完成。',
    photo_review: '照片已提交，商家审核中（通常 1 个工作日内）。',
    waiting_authorization: '等待授权确认。',
    queued: '订单已排单，将按顺序制作。',
    grid_preview: '预览网格已生成，请在下方按主题选择心仪的分镜。',
    cell_selected: '选片已提交，高清成片制作中。',
    generating: 'AI 出图中，请耐心等待。',
    qc: '成品质检中，即将交付。',
    delivered: '成片已交付，可在下方查看与保存。',
    revision: '订单返修中，请留意审核意见。',
    merch_pending: '周边已选定，等待商家安排制作。',
    in_production: '周边制作中，完成后将寄出。',
    closed: '订单已完结。',
    completed: '周边已交付，订单已完结。',
    cancelled: '订单已取消。'
  };

  /* 旧订单无 themes 数组时的主题名兜底（与写真主题白名单一致） */
  const PORTRAIT_THEME_NAMES = {
    guofeng: '古风写真',
    sports: '运动活力',
    casual: '休闲日常',
    travel: '旅拍风光',
    family: '亲子合照'
  };

  const MERCH_CATEGORY_LABELS = {
    wall: '挂墙',
    desk: '摆台',
    calendar: '挂历',
    wallet: '钱包照',
    pendant: '挂件',
    album: '相册'
  };

  const FINAL_STATUSES = ['closed', 'cancelled', 'completed'];
  const MERCH_SHOP_STATUSES = ['cell_selected', 'delivered', 'merch_pending', 'in_production', 'completed'];
  const MAX_BATCH_PHOTOS = 3;
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
  const MAX_PHOTO_MB = 10;
  const OK_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const GRID_CELL_COUNT = 15;
  const DEFAULT_PHOTOS_PER_THEME = 5;

  /* ---------- 小工具 ---------- */
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const statusLabel = (s) => STATUS_LABELS[s] || s || '未知状态';

  const badgeClassForStatus = (s) => {
    if (s === 'delivered') { return 'badge-green'; }
    if (s === 'closed' || s === 'cancelled' || s === 'completed') { return 'badge-gray'; }
    if (s === 'merch_pending') { return 'badge-orange'; }
    if (s === 'revision' || s === 'waiting_photos' || s === 'waiting_authorization') { return 'badge-orange'; }
    return 'badge-blue';
  };

  const statusBadge = (s) => '<span class="badge ' + badgeClassForStatus(s) + '">' + esc(statusLabel(s)) + '</span>';

  const paymentBadge = (p) => {
    const label = PAYMENT_LABELS[p] || (p ? String(p) : '待支付');
    const cls = p === 'paid' ? 'badge-green' : 'badge-orange';
    return '<span class="badge ' + cls + '">' + esc(label) + '</span>';
  };

  const priceText = (n) => {
    const v = Number(n);
    if (!isFinite(v) || v <= 0) { return ''; }
    return '¥' + String(Math.round(v * 100) / 100);
  };

  const fmtSize = (n) => {
    const v = Number(n);
    if (!isFinite(v) || v <= 0) { return ''; }
    if (v < 1024 * 1024) { return Math.max(1, Math.round(v / 1024)) + 'KB'; }
    return (v / 1024 / 1024).toFixed(1) + 'MB';
  };

  const fmtTime = (v) => {
    if (!v) { return ''; }
    const d = (v && typeof v === 'object' && v.$date) ? new Date(v.$date) : new Date(v);
    if (!d || isNaN(d.getTime())) { return ''; }
    const p = (x) => (x < 10 ? '0' + x : String(x));
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };

  const extOfFile = (file) => {
    const m = /\.([A-Za-z0-9]+)$/.exec(file.name || '');
    let ext = m ? m[1].toLowerCase() : '';
    if (ext === 'jpeg' || ext === 'jpe') { ext = 'jpg'; }
    if (!ext) {
      if (file.type === 'image/png') { ext = 'png'; }
      else if (file.type === 'image/webp') { ext = 'webp'; }
      else { ext = 'jpg'; }
    }
    return ext;
  };

  const productName = (order) => order.productName || order.product_name ||
    (order.product && order.product.name) || '';

  const resolveUrls = async (ids) => {
    const unique = [];
    ids.forEach((id) => { if (id && unique.indexOf(id) < 0) { unique.push(id); } });
    if (!unique.length) { return {}; }
    try { return await PM.getTempFileURL(unique); } catch (e) { return {}; }
  };

  /* ---------- 分主题视图构建（与小程序 detail.js 同构） ---------- */

  /* 归一化主题清单：新订单读 themes 数组；旧订单回退 theme_id/theme_name + selected_cells */
  const extractThemeMeta = (order) => {
    if (Array.isArray(order.themes) && order.themes.length > 0) {
      return order.themes
        .filter((item) => item && item.themeId)
        .map((item) => ({
          themeId: String(item.themeId),
          themeName: item.themeName || PORTRAIT_THEME_NAMES[item.themeId] || item.themeId,
          selectedCells: normalizeCells(item.selectedCells)
        }));
    }
    const legacyCells = normalizeCells(order.selected_cells);
    if (order.theme_id || legacyCells.length) {
      return [{
        themeId: String(order.theme_id || ''),
        themeName: order.theme_name || PORTRAIT_THEME_NAMES[order.theme_id] || '写真主题',
        selectedCells: legacyCells
      }];
    }
    if (order.product_type === 'portrait') {
      return [{ themeId: '', themeName: '写真主题', selectedCells: [] }];
    }
    return [];
  };

  const normalizeCells = (value) => {
    if (!Array.isArray(value)) { return []; }
    return value
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= GRID_CELL_COUNT)
      .sort((a, b) => a - b);
  };

  /* 与服务端口径一致：多主题每主题上限 = floor(deliveryCount / themeCount)，非法时兜底 5 */
  const computePerThemeMax = (deliveryCount, themeCount) => {
    const total = Number(deliveryCount);
    const per = themeCount > 0 ? Math.floor(total / themeCount) : 0;
    return Number.isFinite(per) && per >= 1 ? per : DEFAULT_PHOTOS_PER_THEME;
  };

  const collectGrids = (files) => files.filter((f) => f.fileType === 'grid_preview' && f.status !== 'replaced');

  /* grid_preview 归属：优先按文件 themeId 精确匹配；接口未回传 themeId 时按上传顺序对位兜底 */
  const matchGridForTheme = (grids, meta, themeIndex, metaList, multi) => {
    if (!grids.length) { return null; }
    if (meta.themeId) {
      const exact = grids.filter((f) => f.themeId === meta.themeId);
      if (exact.length) { return exact[exact.length - 1]; }
    }
    if (!multi) { return grids[grids.length - 1]; }
    const knownIds = metaList.map((item) => item.themeId).filter(Boolean);
    const unmatched = grids.filter((f) => !f.themeId || knownIds.indexOf(f.themeId) < 0);
    return unmatched[themeIndex] || null;
  };

  /* ---------- 周边好物视图 ---------- */

  /* 可搭配周边的成片：delivery / generated（与服务端 selectMerch 校验口径一致） */
  const collectPrintableFileIDs = (files) => {
    const ids = [];
    files.forEach((f) => {
      if ((f.fileType === 'delivery' || f.fileType === 'generated')
        && f.status !== 'replaced' && f.fileID && ids.indexOf(f.fileID) < 0) {
        ids.push(f.fileID);
      }
    });
    return ids;
  };

  const buildMerchStatusHint = (order) => {
    if (order.trackingNo) { return '已发货 · 快递单号 ' + order.trackingNo; }
    if (order.order_status === 'completed') { return '周边已制作完成。'; }
    if (order.order_status === 'in_production') { return '商家制作中，制作完成后发货。'; }
    if (order.order_status === 'merch_pending') { return '周边清单已提交，商家将尽快安排制作。'; }
    return '商家制作中，制作完成后发货。';
  };

  const merchCardHtml = (m) => `
    <div class="merch-card">
      <span class="merch-tag">${esc(MERCH_CATEGORY_LABELS[m.category] || '周边')}</span>
      <div class="merch-name">${esc(m.name || '')}</div>
      ${m.desc ? `<p class="merch-desc">${esc(m.desc)}</p>` : ''}
      ${m.imageRatio ? `<div class="merch-meta">画面比例 ${esc(m.imageRatio)}</div>` : ''}
      <div class="merch-foot">
        <span class="merch-price">${esc(priceText(m.price) || '¥' + Number(m.price || 0))}</span>
        <button type="button" class="merch-go" data-merch="${esc(m.merchId)}">去搭配</button>
      </div>
    </div>`;

  const findLocalWebToken = (orderId) => {
    try {
      const arr = JSON.parse(localStorage.getItem('pm_orders') || '[]');
      const hit = (arr || []).find((o) => o && o.orderId === orderId);
      return hit ? String(hit.webToken || '') : '';
    } catch (e) { return ''; }
  };

  const goShowcase = (order, merchId, fileIDs, creds) => {
    if (!fileIDs.length) {
      PM.toast('成片制作完成后即可搭配周边', 'error');
      return;
    }
    let url = 'showcase.html?orderId=' + encodeURIComponent(order.orderId)
      + '&merchId=' + encodeURIComponent(merchId)
      + '&fileIDs=' + encodeURIComponent(JSON.stringify(fileIDs));
    const token = (creds && creds.webToken) || findLocalWebToken(order.orderId);
    if (token) { url += '&webToken=' + encodeURIComponent(token); }
    location.href = url;
  };

  const loadMerchGrid = async (container, order, files, creds) => {
    const slot = container.querySelector('[data-role="merch-grid"]');
    if (!slot) { return; }
    try {
      const res = await PM.callApi('merchandise');
      const list = (res && Array.isArray(res.data) ? res.data : []).filter((m) => m && m.merchId);
      if (!list.length) {
        slot.innerHTML = '<p class="muted small">暂未上架周边商品，敬请期待。</p>';
        return;
      }
      slot.innerHTML = '<div class="merch-grid">' + list.map(merchCardHtml).join('') + '</div>';
      const printable = collectPrintableFileIDs(files);
      Array.from(slot.querySelectorAll('[data-merch]')).forEach((btn) => {
        btn.addEventListener('click', () => {
          goShowcase(order, btn.getAttribute('data-merch'), printable, creds);
        });
      });
    } catch (e) {
      slot.innerHTML = '<div class="warn-box">周边清单加载失败：' + esc(e.message || '请刷新重试') + '</div>';
    }
  };

  /* ---------- 主渲染入口 ---------- */
  const render = async (container, opts) => {
    const order = (opts && opts.order) || {};
    const files = Array.isArray(opts && opts.files) ? opts.files : [];
    const creds = (opts && opts.creds) || {};
    const onUpdated = (opts && typeof opts.onUpdated === 'function') ? opts.onUpdated : null;

    container.innerHTML = buildHtml(order, files, creds);
    wire(container, order, creds, onUpdated);
    await fillImages(container, files);
    await loadMerchGrid(container, order, files, creds);
  };

  /* ---------- HTML 组装 ---------- */
  const buildHtml = (order, files, creds) => {
    const status = order.order_status || '';
    const final = FINAL_STATUSES.indexOf(status) >= 0;
    const parts = [];

    /* 1. 订单概览 */
    const price = priceText(order.price != null ? order.price : order.amount);
    const rows = [];
    rows.push('<div class="kv-row"><dt>订单号</dt><dd class="mono">' + esc(order.orderId || '') + '</dd></div>');
    const pn = productName(order);
    if (pn) { rows.push('<div class="kv-row"><dt>套餐</dt><dd>' + esc(pn) + '</dd></div>'); }
    if (price) { rows.push('<div class="kv-row"><dt>金额</dt><dd class="price">' + esc(price) + '</dd></div>'); }
    rows.push('<div class="kv-row"><dt>支付状态</dt><dd>' + paymentBadge(order.payment_status) + '</dd></div>');
    const themeList = extractThemeMeta(order);
    if (themeList.length > 1) {
      const names = themeList.map((t) => t.themeName).filter(Boolean).join('、');
      rows.push('<div class="kv-row"><dt>写真主题</dt><dd>' + esc(names) + '（' + themeList.length + ' 个）</dd></div>');
    } else if (themeList.length === 1 && themeList[0].themeName) {
      rows.push('<div class="kv-row"><dt>写真主题</dt><dd>' + esc(themeList[0].themeName) + '</dd></div>');
    } else {
      const themeName = order.theme_name || order.themeName;
      if (themeName) { rows.push('<div class="kv-row"><dt>写真主题</dt><dd>' + esc(themeName) + '</dd></div>'); }
    }
    const styleName = order.style_name || order.styleName;
    if (styleName) { rows.push('<div class="kv-row"><dt>照片风格</dt><dd>' + esc(styleName) + '</dd></div>'); }
    const scene = order.scene_desc || order.sceneDesc;
    if (scene) { rows.push('<div class="kv-row"><dt>场景描述</dt><dd>' + esc(scene) + '</dd></div>'); }
    const created = fmtTime(order.createdAt || order.created_at);
    if (created) { rows.push('<div class="kv-row"><dt>下单时间</dt><dd>' + esc(created) + '</dd></div>'); }
    if (order.photo_check && PHOTO_CHECK_LABELS[order.photo_check] && order.photo_check !== 'unchecked') {
      const cls = order.photo_check === 'passed' ? 'badge-green' : 'badge-orange';
      rows.push('<div class="kv-row"><dt>照片审核</dt><dd><span class="badge ' + cls + '">' +
        esc(PHOTO_CHECK_LABELS[order.photo_check]) + '</span></dd></div>');
    }
    if (order.merch_total != null && Array.isArray(order.merch_items) && order.merch_items.length) {
      rows.push('<div class="kv-row"><dt>周边合计</dt><dd class="price">' + esc(priceText(order.merch_total)) + '</dd></div>');
    }

    parts.push(
      '<section class="card">' +
        '<div class="card-head"><h2>订单概览</h2>' + statusBadge(status) + '</div>' +
        '<dl class="kv">' + rows.join('') + '</dl>' +
        (STATUS_GUIDES[status] ? '<div class="tip-box">' + esc(STATUS_GUIDES[status]) + '</div>' : '') +
      '</section>'
    );

    /* 2. 收款码（未支付且订单未终结） */
    if (order.payment_status !== 'paid' && !final) {
      parts.push(
        '<section class="card">' +
          '<div class="card-head"><h2>扫码支付</h2>' + (price ? '<span class="price">' + esc(price) + '</span>' : '') + '</div>' +
          '<div class="payment-body">' +
            '<div class="img-slot payment" data-role="payment-qr"><div class="img-loading">收款码加载中…</div></div>' +
            '<p class="payment-note" data-role="payment-note"></p>' +
            '<div class="tip-box">请扫码完成支付，建议付款时<span class="strong">备注订单号</span>便于商家核对；付款后由商家确认到账，确认前订单可能仍显示“待支付”。</div>' +
          '</div>' +
        '</section>'
      );
    }

    /* 3. 审核意见 / 补拍 / 补传 */
    const customers = files.filter((f) => f.fileType === 'customer_photo');
    if (order.photo_check === 'need_retake') {
      const note = order.reviewNote || order.review_note;
      parts.push(
        '<section class="card">' +
          '<div class="card-head"><h2>照片审核意见</h2><span class="badge badge-orange">' +
            esc(PHOTO_CHECK_LABELS.need_retake) + '</span></div>' +
          (note ? '<div class="warn-box">' + esc(note) + '</div>' : '') +
          '<div data-role="upload-panel" data-mode="retake"></div>' +
        '</section>'
      );
    } else if (!customers.length && creds.webToken && status === 'waiting_photos') {
      parts.push(
        '<section class="card">' +
          '<div class="card-head"><h2>补传照片</h2></div>' +
          '<p class="muted small">订单已创建，但尚未收到照片。请补传：最多 ' + MAX_BATCH_PHOTOS +
            ' 张，每张不超过 ' + MAX_PHOTO_MB + 'MB，支持 jpg / png / webp。</p>' +
          '<div data-role="upload-panel" data-mode="supplement"></div>' +
        '</section>'
      );
    }

    /* 4. 分主题网格预览与选片（多主题每主题独立；旧订单单主题兼容） */
    const interactive = status === 'grid_preview';
    const grids = collectGrids(files);
    const multi = Array.isArray(order.themes) && order.themes.length > 0;
    const hasAnySelection = themeList.some((t) => t.selectedCells.length > 0);
    if (order.product_type === 'portrait' && (grids.length || interactive || hasAnySelection)) {
      const maxPer = multi
        ? computePerThemeMax(order.deliveryCount, themeList.length)
        : (Number(order.deliveryCount) > 0 ? Number(order.deliveryCount) : DEFAULT_PHOTOS_PER_THEME);

      themeList.forEach((meta, themeIndex) => {
        const gridFile = matchGridForTheme(grids, meta, themeIndex, themeList, multi);
        const selected = meta.selectedCells;
        let bodyHtml = '';
        if (gridFile) {
          bodyHtml += '<div class="img-slot wide" data-role="grid-img" data-fileid="' + esc(gridFile.fileID) +
            '" title="点击查看大图"><div class="img-loading">预览图加载中…</div></div>';
        } else {
          bodyHtml += '<p class="muted small">该主题的网格预览图尚未上传，请稍后刷新查看。</p>';
        }
        if (interactive) {
          let cellsHtml = '';
          for (let n = 1; n <= GRID_CELL_COUNT; n++) {
            cellsHtml += '<button type="button" class="cell-item' +
              (selected.indexOf(n) >= 0 ? ' selected' : '') + '" data-cell="' + n + '">' + n + '</button>';
          }
          bodyHtml +=
            '<p class="muted small">3×5 预览网格 · 本主题最多选择 <b>' + maxPer + '</b> 张（已选 <b data-role="cell-count">' +
            selected.length + '</b>）' + (selected.length ? '，已选过可改选后重新提交' : '') + '</p>' +
            '<div class="cell-grid" data-role="cell-grid">' + cellsHtml + '</div>' +
            '<button class="btn" data-role="cell-confirm">' + (selected.length ? '重新选片' : '确认选片') + '</button>';
        } else if (selected.length) {
          bodyHtml += '<p class="muted small">已选分镜：</p><div class="chips">' +
            selected.map((n) => '<span class="chip chip-blue">分镜 ' + esc(n) + '</span>').join('') +
            '<span class="badge badge-blue">制作中</span></div>';
        }
        parts.push(
          '<section class="card theme-grid-card" data-role="theme-block" data-theme-index="' + themeIndex + '">' +
            '<div class="card-head"><h2>主题 · ' + esc(meta.themeName) + '</h2>' +
            (selected.length ? '<span class="badge badge-green">已选 ' + selected.length + ' 张</span>' : '') + '</div>' +
            bodyHtml +
          '</section>'
        );
      });
    }

    /* 5. 成片交付 */
    const outputs = files.filter((f) => f.fileType === 'delivery' || f.fileType === 'generated');
    if (outputs.length) {
      parts.push(
        '<section class="card">' +
          '<div class="card-head"><h2>成片交付</h2><span class="badge badge-green">' + outputs.length + ' 张</span></div>' +
          '<div class="photo-grid">' + outputs.map((f) =>
            '<div class="img-slot square" data-role="delivery-img" data-fileid="' + esc(f.fileID) +
              '" title="点击查看原图"><div class="img-loading">加载中…</div></div>'
          ).join('') + '</div>' +
          '<p class="muted small">点击图片可在新标签页查看并保存原图。</p>' +
        '</section>'
      );
    }

    /* 6. 周边好物（已选片 / 已交付 / 已提交周边时展示） */
    const merchItems = Array.isArray(order.merch_items) ? order.merch_items : [];
    const showMerch = order.product_type === 'portrait'
      && (MERCH_SHOP_STATUSES.indexOf(status) >= 0 || merchItems.length > 0);
    if (showMerch) {
      let merchBody = '';
      if (merchItems.length) {
        merchBody =
          '<div class="merch-selected-list">' + merchItems.map((m) =>
            '<div class="merch-selected-item">' +
              '<div><div class="merch-name">' + esc(m.name || '') + '</div>' +
              '<div class="merch-item-qty">数量 × ' + esc(m.qty) + ' · 单价 ' + esc(priceText(m.price)) + '</div></div>' +
              '<div class="merch-item-total">' + esc(priceText(m.lineTotal != null ? m.lineTotal : (m.price * m.qty))) + '</div>' +
            '</div>'
          ).join('') + '</div>' +
          '<div class="merch-total-row"><span>周边合计</span><span class="merch-total-value">' +
            esc(priceText(order.merch_total)) + '</span></div>' +
          '<div class="merch-status-hint">' + esc(buildMerchStatusHint(order)) + '</div>';
      } else {
        merchBody =
          '<p class="muted small">成片还能做成实体周边：选择商品进入搭配页挑选成片，由商家制作寄送。</p>' +
          (collectPrintableFileIDs(files).length ? '' : '<div class="tip-box">成片制作完成后即可搭配周边。</div>') +
          '<div data-role="merch-grid"><div class="img-loading">周边清单加载中…</div></div>';
      }
      parts.push(
        '<section class="card">' +
          '<div class="card-head"><h2>周边好物</h2>' +
            (merchItems.length ? statusBadge(status) : '') + '</div>' +
          merchBody +
        '</section>'
      );
    }

    /* 7. 我上传的照片 */
    if (customers.length) {
      parts.push(
        '<section class="card">' +
          '<div class="card-head"><h2>我上传的照片</h2><span class="badge badge-gray">' + customers.length + ' 张</span></div>' +
          '<div class="thumb-row">' + customers.map((f) =>
            '<div class="img-slot thumb" data-role="customer-img" data-fileid="' + esc(f.fileID) +
            '"><div class="img-loading">…</div></div>'
          ).join('') + '</div>' +
        '</section>'
      );
    }

    return parts.join('');
  };

  /* ---------- 事件绑定 ---------- */
  const wire = (container, order, creds, onUpdated) => {
    const multi = Array.isArray(order.themes) && order.themes.length > 0;
    const themeList = extractThemeMeta(order);
    const maxPer = multi
      ? computePerThemeMax(order.deliveryCount, themeList.length)
      : (Number(order.deliveryCount) > 0 ? Number(order.deliveryCount) : DEFAULT_PHOTOS_PER_THEME);

    /* 分主题 3×5 选片 */
    Array.from(container.querySelectorAll('[data-role="theme-block"]')).forEach((block) => {
      const grid = block.querySelector('[data-role="cell-grid"]');
      if (!grid) { return; }
      const themeIndex = Number(block.getAttribute('data-theme-index')) || 0;
      const meta = themeList[themeIndex] || { themeId: '', themeName: '' };
      const selected = new Set(meta.selectedCells || []);
      const countEl = block.querySelector('[data-role="cell-count"]');
      const updateCount = () => { if (countEl) { countEl.textContent = String(selected.size); } };

      grid.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('.cell-item') : null;
        if (!btn) { return; }
        const n = Number(btn.getAttribute('data-cell'));
        if (selected.has(n)) {
          selected.delete(n);
          btn.classList.remove('selected');
        } else {
          if (selected.size >= maxPer) {
            PM.toast('本主题最多选择 ' + maxPer + ' 张，请先取消已选', 'error');
            return;
          }
          selected.add(n);
          btn.classList.add('selected');
        }
        updateCount();
      });

      const confirmBtn = block.querySelector('[data-role="cell-confirm"]');
      if (!confirmBtn) { return; }
      confirmBtn.addEventListener('click', async () => {
        if (!selected.size) { PM.toast('请至少选择 1 张', 'error'); return; }
        const payload = { orderId: order.orderId, cells: Array.from(selected).sort((a, b) => a - b) };
        if (multi && meta.themeId) { payload.themeId = meta.themeId; }
        if (creds.webToken) {
          payload.webToken = creds.webToken;
        } else if (creds.contactPhone) {
          /* 查询页：以三元组作为凭证 */
          payload.contactPhone = creds.contactPhone;
          payload.queryPassword = creds.queryPassword;
        } else {
          PM.toast('缺少查询凭证，无法提交选片', 'error');
          return;
        }
        confirmBtn.disabled = true;
        PM.showLoading('提交选片中…');
        try {
          const res = await PM.callApi('selectCells', payload);
          /* 全部主题选完订单才进入 cell_selected，以服务端返回为准提示 */
          const nextStatus = res && res.order && res.order.order_status;
          PM.toast(nextStatus === 'cell_selected' ? '选片已提交，开始制作' : '本主题已选，还有主题待选', 'success');
          if (onUpdated) { onUpdated(); }
          else { PM.toast('请刷新页面查看最新状态', 'info'); }
        } catch (e) {
          PM.toast(e.message || '提交失败，请重试', 'error');
          confirmBtn.disabled = false;
          if (String(e.code) === 'INVALID_STATUS' && onUpdated) { onUpdated(); }
        } finally {
          PM.hideLoading();
        }
      });
    });

    /* 预览图 / 成片点击看大图（临时链接在 fillImages 后写入 data-url） */
    Array.from(container.querySelectorAll('[data-role="delivery-img"], [data-role="grid-img"]')).forEach((el) => {
      el.addEventListener('click', () => {
        const url = el.getAttribute('data-url');
        if (url) { window.open(url, '_blank', 'noopener'); }
        else { PM.toast('图片链接尚未就绪，请稍后再试', 'error'); }
      });
    });

    /* 补拍 / 补传面板 */
    const panel = container.querySelector('[data-role="upload-panel"]');
    if (panel) { mountUploadPanel(panel, order, creds, onUpdated); }
  };

  /* ---------- 补拍 / 补传上传面板 ---------- */
  const mountUploadPanel = (slot, order, creds, onUpdated) => {
    const mode = slot.getAttribute('data-mode') === 'retake' ? 'retake' : 'supplement';
    if (!creds.webToken) {
      slot.innerHTML = '<div class="tip-box">补拍上传需要下单浏览器的订单凭证：请回到下单时的浏览器打开订单页上传，或联系商家处理。</div>';
      return;
    }
    slot.innerHTML =
      '<label class="file-label">' + (mode === 'retake' ? '选择补拍照片' : '选择照片') +
        '<input type="file" accept="image/*" multiple hidden data-role="panel-input">' +
      '</label>' +
      '<div class="photo-preview-list" data-role="panel-preview"></div>' +
      '<button class="btn btn-outline" data-role="panel-submit" disabled>' +
        (mode === 'retake' ? '上传补拍照片' : '上传照片') + '</button>';

    const input = slot.querySelector('[data-role="panel-input"]');
    const preview = slot.querySelector('[data-role="panel-preview"]');
    const submitBtn = slot.querySelector('[data-role="panel-submit"]');
    const objectUrls = [];
    let picked = [];

    const renderPreview = () => {
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
      objectUrls.length = 0;
      preview.innerHTML = picked.map((f, i) => {
        const url = URL.createObjectURL(f);
        objectUrls.push(url);
        return '<div class="photo-item"><img src="' + url + '" alt="照片预览">' +
          '<button type="button" class="photo-remove" data-index="' + i + '" aria-label="移除">×</button></div>';
      }).join('');
      Array.from(preview.querySelectorAll('.photo-remove')).forEach((btn) => {
        btn.addEventListener('click', () => {
          picked.splice(Number(btn.getAttribute('data-index')), 1);
          renderPreview();
        });
      });
      submitBtn.disabled = picked.length === 0;
    };

    input.addEventListener('change', () => {
      Array.from(input.files || []).forEach((f) => {
        if (picked.length >= MAX_BATCH_PHOTOS) { PM.toast('一次最多上传 ' + MAX_BATCH_PHOTOS + ' 张', 'error'); return; }
        const typeOk = OK_MIME_TYPES.indexOf(f.type) >= 0 || /\.(jpe?g|png|webp)$/i.test(f.name || '');
        if (!typeOk) { PM.toast('「' + f.name + '」格式不支持，仅支持 jpg/png/webp', 'error'); return; }
        if (f.size > MAX_PHOTO_BYTES) { PM.toast('「' + f.name + '」超过 ' + MAX_PHOTO_MB + 'MB 限制', 'error'); return; }
        picked.push(f);
      });
      input.value = '';
      renderPreview();
    });

    submitBtn.addEventListener('click', async () => {
      if (!picked.length) { return; }
      submitBtn.disabled = true;
      try {
        const prefix = mode === 'retake'
          ? 'ai-studio/' + order.orderId + '/customer-retake/'
          : 'ai-studio/' + order.orderId + '/web-customer/';
        for (let i = 0; i < picked.length; i++) {
          const f = picked[i];
          PM.showLoading('正在上传 ' + (i + 1) + '/' + picked.length + ' …');
          const fileID = await PM.uploadFile(prefix + Date.now() + '-' + i + '.' + extOfFile(f), f);
          await PM.callApi('registerPhoto', {
            orderId: order.orderId,
            webToken: creds.webToken,
            fileID: fileID,
            fileName: f.name,
            size: f.size,
            mimeType: f.type || ''
          });
        }
        PM.hideLoading();
        PM.toast('上传成功，等待商家审核', 'success');
        if (onUpdated) { onUpdated(); }
      } catch (e) {
        PM.hideLoading();
        PM.toast('上传失败：' + (e.message || '请重试'), 'error');
        submitBtn.disabled = false;
      }
    });
  };

  /* ---------- 图片填充（临时链接） ---------- */
  const fillImages = async (container, files) => {
    const slots = Array.from(container.querySelectorAll('[data-fileid]'));
    const ids = slots.map((s) => s.getAttribute('data-fileid')).filter(Boolean);

    const paySlot = container.querySelector('[data-role="payment-qr"]');
    let payConfig = null;
    if (paySlot) {
      try {
        const res = await PM.callApi('paymentQR');
        payConfig = (res && res.config) ? res.config : null;
      } catch (e) { payConfig = null; }
      if (payConfig && payConfig.fileID) { ids.push(payConfig.fileID); }
    }

    const urlMap = await resolveUrls(ids);
    slots.forEach((slot) => { applySlotImage(slot, urlMap[slot.getAttribute('data-fileid')]); });

    if (paySlot) {
      const card = paySlot.closest ? paySlot.closest('.card') : null;
      if (payConfig && payConfig.fileID) {
        applySlotImage(paySlot, urlMap[payConfig.fileID]);
        const noteEl = container.querySelector('[data-role="payment-note"]');
        if (noteEl) { noteEl.textContent = payConfig.note || ''; }
      } else if (card && card.parentNode) {
        /* 商家未配置收款码：整个卡片移除，避免误导 */
        card.parentNode.removeChild(card);
      }
    }
  };

  const applySlotImage = (slot, url) => {
    const isCover = slot.classList.contains('square') || slot.classList.contains('thumb');
    if (url) {
      const img = document.createElement('img');
      img.className = 'slot-img' + (isCover ? ' cover' : '');
      img.alt = '';
      img.onerror = () => { slot.innerHTML = '<div class="img-fallback">图片加载失败</div>'; };
      img.src = url;
      slot.innerHTML = '';
      slot.appendChild(img);
      const role = slot.getAttribute('data-role');
      if (role === 'delivery-img' || role === 'grid-img') { slot.setAttribute('data-url', url); }
    } else {
      slot.innerHTML = '<div class="img-fallback">图片链接获取失败</div>';
    }
  };

  return {
    STATUS_LABELS: STATUS_LABELS,
    PHOTO_CHECK_LABELS: PHOTO_CHECK_LABELS,
    render: render
  };
})();
