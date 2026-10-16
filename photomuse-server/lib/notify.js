/* ============================================================
 * 浅焦映像 · 订单邮件通知（QQ 邮箱 SMTP）
 * 环境变量：
 *   PM_SMTP_USER  发件邮箱（必填；不配则邮件通知自动关闭）
 *   PM_SMTP_PASS  QQ 邮箱 SMTP 授权码（非登录密码）
 *   PM_NOTIFY_TO  收件人，默认同 USER
 *   PM_SMTP_HOST / PM_SMTP_PORT 默认 smtp.qq.com:465
 * ============================================================ */
'use strict';

const nodemailer = require('nodemailer');

const USER = process.env.PM_SMTP_USER || '';
const PASS = process.env.PM_SMTP_PASS || '';
const TO = process.env.PM_NOTIFY_TO || USER;
const HOST = process.env.PM_SMTP_HOST || 'smtp.qq.com';
const PORT = Number(process.env.PM_SMTP_PORT || 465);
const ADMIN_URL = process.env.PM_ADMIN_URL || 'https://www.czpsm.art/PM/admin.html';

function enabled() {
  return Boolean(USER && PASS && TO);
}

function themesText(order) {
  try {
    const list = JSON.parse(order.themes || '[]');
    return list.map(t => (t && (t.themeName || t.themeId)) || t).filter(Boolean).join('、') || '—';
  } catch (e) {
    return '—';
  }
}

function photoCountHint(order) {
  return order.reference_photo_count != null ? order.reference_photo_count : '见后台';
}

function build(type, order, extra) {
  const orderId = order.order_id;
  const phone = order.contact_phone || '—';
  const productId = order.product_id || order.product_name || '—';
  const themes = themesText(order);
  const photos = photoCountHint(order);
  const map = {
    photo_review: {
      subject: `【浅焦映像】新订单待人工审核 ${orderId}`,
      text: [
        `订单号：${orderId}`,
        `套餐：${productId}`,
        `写真主题：${themes}`,
        `参考照片：${photos}`,
        `联系手机：${phone}`,
        `来源：${(extra && extra.source) || 'web'}`,
        '',
        `请打开管理后台审核：${ADMIN_URL}`,
        '通过后系统将自动调用模型出图；完成后会再发一封「待 QC」邮件。'
      ].join('\n')
    },
    review_passed: {
      subject: `【浅焦映像】审核通过，开始自动出图 ${orderId}`,
      text: `订单号：${orderId}\n套餐：${productId}\n主题：${themes}\n手机：${phone}\n自动出图：已启动\n后台：${ADMIN_URL}`
    },
    generation_ready: {
      subject: `【浅焦映像】出图完成，待人工 QC ${orderId}`,
      text: [
        `订单号：${orderId}`,
        `套餐：${productId}`,
        `主题：${themes}`,
        `手机：${phone}`,
        `结果：${(extra && extra.summary) || '候选成片已就绪，请 QC 后交付'}`,
        '',
        `请 QC 并交付：${ADMIN_URL}`
      ].join('\n')
    },
    generation_failed: {
      subject: `【浅焦映像】自动出图失败 ${orderId}`,
      text: `订单号：${orderId}\n套餐：${productId}\n失败：${(extra && extra.error) || '未知错误'}\n后台：${ADMIN_URL}`
    }
  };
  return map[type] || { subject: `【浅焦映像】订单事件 ${type} ${orderId}`, text: `订单号：${orderId}` };
}

async function send(type, order, extra) {
  if (!enabled() || !order) {
    console.warn('[notify] SMTP 未配置或订单为空，跳过', type);
    return { ok: false, reason: 'CONFIG_MISSING' };
  }
  const mail = build(type, order, extra);
  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS }
  });
  const info = await transporter.sendMail({
    from: `"浅焦映像" <${USER}>`,
    to: TO,
    subject: mail.subject,
    text: mail.text
  });
  console.log('[notify]', type, order.order_id, info && info.messageId);
  return { ok: true, messageId: info && info.messageId };
}

module.exports = { send, enabled };
