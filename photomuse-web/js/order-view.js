/* ============================================================
 * 光影集 PhotoMuse Web · 订单视图渲染（order.html / query.html 复用）
 * 依赖：js/api.js（window.PM）
 * 用法：await PMOrderView.render(container, { order, files, creds, onUpdated })
 *   - order / files：getOrder 或 queryOrder 返回的数据
 *   - creds 二选一：{ webToken }（下单浏览器）或
 *     { contactPhone, queryPassword }（三元组，查询页选片用）
 *   - onUpdated：选片 / 补传等写操作成功后的回调（页面负责重新拉取数据）
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
    closed: '已完结',
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
    grid_preview: '预览网格已生成，请在下方选择心仪的分镜。',
    cell_selected: '选片已提交，高清成片制作中。',
    generating: 'AI 出图中，请耐心等待。',
    qc: '成品质检中，即将交付。',
    delivered: '成片已交付，可在下方查看与保存。',
    revision: '订单返修中，请留意审核意见。',
    closed: '订单已完结。',
    cancelled: '订单已取消。'
  };

  const FINAL_STATUSES = ['closed', 'cancelled'];
  const MAX_BATCH_PHOTOS = 3;
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
  const MAX_PHOTO_MB = 10;
  const OK_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const GRID_CELL_COUNT = 15;

  /* ---------- 小工具 ---------- */
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const statusLabel = (s) => STATUS_LABELS[s] || s || '未知状态';

  const badgeClassForStatus = (s) => {
    if (s === 'delivered') { return 'badge-green'; }
    if (s === 'closed' || s === 'cancelled') { return 'badge-gray'; }
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

  /* ---------- 主渲染入口 ---------- */
  const render = async (container, opts) => {
    const order = (opts && opts.order) || {};
    const files = Array.isArray(opts && opts.files) ? opts.files : [];
    const creds = (opts && opts.creds) || {};
    const onUpdated = (opts && typeof opts.onUpdated === 'function') ? opts.onUpdated : null;

    container.innerHTML = buildHtml(order, files, creds);
    wire(container, order, creds, onUpdated);
    await fillImages(container, files);
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
    const themeName = order.theme_name || order.themeName;
    if (themeName) { rows.push('<div class="kv-row"><dt>写真主题</dt><dd>' + esc(themeName) + '</dd></div>'); }
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

    /* 4. 网格预览与选片 */
    const previewFile = files.find((f) => f.fileType === 'grid_preview');
    const selectedCells = Array.isArray(order.selected_cells) ? order.selected_cells.slice() : [];
    if (previewFile || status === 'grid_preview' || selectedCells.length) {
      const interactive = status === 'grid_preview';
      const maxSel = Number(order.deliveryCount) || 5;
      let bodyHtml = '';
      if (previewFile) {
        bodyHtml += '<div class="img-slot wide" data-role="grid-img" data-fileid="' + esc(previewFile.fileID) +
          '"><div class="img-loading">预览图加载中…</div></div>';
      } else {
        bodyHtml += '<p class="muted">预览图生成中，请稍后刷新查看。</p>';
      }
      if (interactive) {
        let cellsHtml = '';
        for (let n = 1; n <= GRID_CELL_COUNT; n++) {
          cellsHtml += '<button type="button" class="cell-item' +
            (selectedCells.indexOf(n) >= 0 ? ' selected' : '') + '" data-cell="' + n + '">' + n + '</button>';
        }
        bodyHtml +=
          '<p class="muted small">3×5 预览网格 · 最多选择 <b>' + maxSel + '</b> 张（已选 <b data-role="cell-count">' +
          selectedCells.length + '</b>）</p>' +
          '<div class="cell-grid" data-role="cell-grid">' + cellsHtml + '</div>' +
          '<button class="btn" data-role="cell-confirm">确认选片</button>';
      } else if (selectedCells.length) {
        selectedCells.sort((a, b) => a - b);
        bodyHtml += '<p class="muted small">已选分镜：</p><div class="chips">' +
          selectedCells.map((n) => '<span class="chip chip-blue">分镜 ' + esc(n) + '</span>').join('') +
          '</div>';
      }
      parts.push('<section class="card"><div class="card-head"><h2>写真网格预览</h2></div>' + bodyHtml + '</section>');
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

    /* 6. 我上传的照片 */
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
    /* 3×5 选片 */
    const grid = container.querySelector('[data-role="cell-grid"]');
    if (grid) {
      const maxSel = Number(order.deliveryCount) || 5;
      const selected = new Set(Array.isArray(order.selected_cells) ? order.selected_cells : []);
      const countEl = container.querySelector('[data-role="cell-count"]');
      const updateCount = () => { if (countEl) { countEl.textContent = String(selected.size); } };

      grid.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('.cell-item') : null;
        if (!btn) { return; }
        const n = Number(btn.getAttribute('data-cell'));
        if (selected.has(n)) {
          selected.delete(n);
          btn.classList.remove('selected');
        } else {
          if (selected.size >= maxSel) {
            PM.toast('最多选择 ' + maxSel + ' 张，请先取消已选', 'error');
            return;
          }
          selected.add(n);
          btn.classList.add('selected');
        }
        updateCount();
      });

      const confirmBtn = container.querySelector('[data-role="cell-confirm"]');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          if (!selected.size) { PM.toast('请至少选择 1 张', 'error'); return; }
          const payload = { orderId: order.orderId, cells: Array.from(selected).sort((a, b) => a - b) };
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
            await PM.callApi('selectCells', payload);
            PM.toast('选片已提交，开始制作', 'success');
            if (onUpdated) { onUpdated(); }
            else { PM.toast('请刷新页面查看最新状态', 'info'); }
          } catch (e) {
            PM.toast(e.message || '提交失败，请重试', 'error');
            confirmBtn.disabled = false;
          } finally {
            PM.hideLoading();
          }
        });
      }
    }

    /* 成片点击看大图（临时链接在 fillImages 后写入 data-url） */
    Array.from(container.querySelectorAll('[data-role="delivery-img"]')).forEach((el) => {
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
      if (slot.getAttribute('data-role') === 'delivery-img') { slot.setAttribute('data-url', url); }
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
