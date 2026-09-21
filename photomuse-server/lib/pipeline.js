/* ============================================================
 * 浅焦映像 · 审核通过后自动出图流水线（到「可 QC」）
 * 证件照：客户图 + 底色 → 直接生成交付候选
 * 写真：参考图 → 主题网格 → 默认分镜 1/2/3 交付候选
 * 完成/失败后发邮件通知
 * ============================================================ */
'use strict';

const path = require('path');
const ai = require('./ai');
const notify = require('./notify');

/* 与 server.js 共享的 db/audit 由注入，避免循环依赖 */
let deps = null;
function bind(d) { deps = d; }

function parseThemes(order) {
  try {
    return (JSON.parse(order.themes || '[]') || []).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function autoCells() {
  return String(process.env.PM_AUTO_GEN_CELLS || '1,2,3')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 15);
}

async function run(orderId) {
  if (!deps) throw new Error('pipeline not bound');
  const { db, getOrder, orderFiles, audit, nowStr, rid } = deps;
  const o = getOrder(orderId);
  if (!o) return { success: false, error: 'ORDER_NOT_FOUND' };

  const photos = orderFiles(orderId, 'customer');
  if (!photos.length) {
    await notify.send('generation_failed', o, { error: '订单无客户照片' });
    return { success: false, error: 'NO_PHOTOS' };
  }

  db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?')
    .run('generating', nowStr(), orderId);
  await notify.send('review_passed', o, { autoGen: true });

  const themes = parseThemes(o);
  const isPortrait = Boolean(themes.length) || String(o.product_type || o.product_id || '').includes('portrait');
  const done = [];
  const failures = [];

  try {
    if (isPortrait) {
      const themeCount = themes.length || 1;
      const sceneDesc = o.scene_desc || '';
      const refPrompt = ai.buildPrompt('reference', { themeCount, sceneDesc });
      const ref = await ai.generateImage(refPrompt);
      const refUrl = ai.saveUpload(path.join('orders', orderId, 'reference.png'), ref.buffer);
      db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(rid('file'), orderId, 'generated', refUrl, nowStr());
      done.push('reference');

      const cells = autoCells();
      for (const theme of themes.length ? themes : [{ themeId: 'professional' }]) {
        const themeId = theme.themeId || theme;
        const themeName = theme.themeName || themeId;
        const gridPrompt = ai.buildPrompt('grid', { themeId, sceneDesc });
        const grid = await ai.generateImage(gridPrompt);
        const gridUrl = ai.saveUpload(path.join('orders', orderId, 'grid-' + themeId + '.png'), grid.buffer);
        db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(rid('file'), orderId, 'grid_preview', gridUrl, nowStr());
        done.push('grid:' + themeId);

        for (const cell of cells) {
          try {
            const cellPrompt = ai.buildPrompt('cell', { cell, themeId });
            const img = await ai.generateImage(cellPrompt);
            const url = ai.saveUpload(path.join('orders', orderId, 'cell-' + themeId + '-' + cell + '.png'), img.buffer);
            db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
              .run(rid('file'), orderId, 'delivery', url, nowStr());
            done.push('cell:' + themeId + ':' + cell);
          } catch (e) {
            failures.push('cell ' + themeId + '#' + cell + ': ' + e.message);
          }
        }
        audit(orderId, 'system', 'auto_generate_theme', { themeId, themeName, cells });
      }

      const summary = `写真自动出图完成：参考图 + 网格×${themes.length || 1}，默认分镜 ${cells.join('/')}；请 QC 后交付`;
      db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?')
        .run('qc', nowStr(), orderId);
      await notify.send('generation_ready', o, { summary });
      audit(orderId, 'system', 'auto_generate_ready', { done, failures });
      return { success: true, done, failures, summary };
    }

    /* 证件照 / 标准：用客户照片直接出一张交付候选（简化全自动路径） */
    const styleId = o.style_id || o.styleId || '';
    const prompt = ai.buildPrompt('cell', { cell: 1, themeId: 'professional', sceneDesc: o.scene_desc || styleId });
    const img = await ai.generateImage(prompt);
    const url = ai.saveUpload(path.join('orders', orderId, 'idphoto-auto.png'), img.buffer);
    db.prepare('INSERT INTO order_files (file_id, order_id, file_type, url, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(rid('file'), orderId, 'delivery', url, nowStr());
    done.push('idphoto');
    db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?')
      .run('qc', nowStr(), orderId);
    await notify.send('generation_ready', o, { summary: '证件照自动出图完成，请 QC 后交付' });
    audit(orderId, 'system', 'auto_generate_ready', { done });
    return { success: true, done, failures: [], summary: '证件照自动出图完成' };
  } catch (e) {
    console.error('[pipeline] failed', orderId, e);
    db.prepare('UPDATE orders SET order_status = ?, updated_at = ? WHERE order_id = ?')
      .run('queued', nowStr(), orderId);
    await notify.send('generation_failed', o, { error: e.message || String(e) });
    audit(orderId, 'system', 'auto_generate_failed', { error: String(e.message || e) });
    return { success: false, error: e.message || String(e), done, failures };
  }
}

module.exports = { bind, run };
