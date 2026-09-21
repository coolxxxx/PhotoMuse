/**
 * 浅焦映像 · 订单通知（邮件）
 * 事件：
 *   { type: 'photo_review', orderId, source? }           提交待审
 *   { type: 'review_passed', orderId, autoGen? }         审核通过
 *   { type: 'generation_ready', orderId, summary? }      出图完成待 QC
 *   { type: 'generation_failed', orderId, error? }       自动出图失败
 * 密钥（环境变量，不入库）：
 *   AI_STUDIO_SMTP_USER     发件 QQ 邮箱，如 1670825@qq.com
 *   AI_STUDIO_SMTP_PASS     QQ 邮箱 SMTP 授权码（非登录密码）
 *   AI_STUDIO_NOTIFY_TO     收件人，默认与 USER 相同
 *   AI_STUDIO_SMTP_HOST     默认 smtp.qq.com
 *   AI_STUDIO_SMTP_PORT     默认 465
 */
const cloud = require('wx-server-sdk');
const nodemailer = require('nodemailer');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  try {
    const type = String(event.type || '');
    const orderId = String(event.orderId || '').trim();
    if (!type || !orderId) {
      return { success: false, code: 'VALIDATION_ERROR', message: '缺少 type 或 orderId' };
    }

    const user = process.env.AI_STUDIO_SMTP_USER || '';
    const pass = process.env.AI_STUDIO_SMTP_PASS || '';
    const to = process.env.AI_STUDIO_NOTIFY_TO || user;
    const host = process.env.AI_STUDIO_SMTP_HOST || 'smtp.qq.com';
    const port = Number(process.env.AI_STUDIO_SMTP_PORT || 465);

    if (!user || !pass || !to) {
      console.warn('notifyAIStudioOrder: SMTP 未配置，跳过发信');
      return { success: false, code: 'CONFIG_MISSING', message: '邮件通知未配置 SMTP' };
    }

    const order = await loadOrder(orderId);
    const mail = buildMail(type, orderId, order, event);
    const info = await sendMail({ host, port, user, pass, to, mail });

    await db.collection('ai_studio_audit_logs').add({
      data: {
        orderId,
        actorOpenid: 'system_notify',
        action: 'notify_email',
        payload: { type, messageId: info && info.messageId, to },
        createdAt: db.serverDate()
      }
    });

    return { success: true, messageId: info && info.messageId };
  } catch (error) {
    console.error('notifyAIStudioOrder failed:', error);
    return { success: false, code: 'INTERNAL_ERROR', message: error.message || '通知失败' };
  }
};

async function loadOrder(orderId) {
  try {
    const r = await db.collection('ai_studio_orders').where({ orderId }).limit(1).get();
    return (r.data && r.data[0]) || null;
  } catch (e) {
    return null;
  }
}

function buildMail(type, orderId, order, event) {
  const phone = order && order.contact_phone ? order.contact_phone : (order && order.contactPhone) || '—';
  const productId = order && order.productId || '—';
  const themes = (order && (order.portrait_themes || order.themes) || [])
    .map(t => (t && (t.themeName || t.themeId)) || t)
    .filter(Boolean)
    .join('、') || '—';
  const photoCount = order && order.reference_photo_count != null ? order.reference_photo_count : '—';
  const status = order && order.order_status || '—';
  const sceneDesc = order && (order.scene_desc || order.sceneDesc) || '';
  const adminUrl = process.env.AI_STUDIO_ADMIN_URL || 'https://www.czpsm.art/PM/admin.html';

  const map = {
    photo_review: {
      subject: `【浅焦映像】新订单待人工审核 ${orderId}`,
      lines: [
        `订单号：${orderId}`,
        `套餐：${productId}`,
        `写真主题：${themes}`,
        `参考照片：${photoCount} 张`,
        `联系手机：${phone}`,
        `当前状态：${status}`,
        sceneDesc ? `场景描述：${sceneDesc}` : '',
        `来源：${event.source || 'web/miniprogram'}`,
        '',
        `请打开管理后台审核：${adminUrl}`,
        '通过后系统将自动调用模型出图；出图完成后会再发一封「待 QC」邮件。'
      ]
    },
    review_passed: {
      subject: `【浅焦映像】审核已通过，开始自动出图 ${orderId}`,
      lines: [
        `订单号：${orderId}`,
        `套餐：${productId}`,
        `主题：${themes}`,
        `手机：${phone}`,
        `自动出图：${event.autoGen ? '已启动' : '未启用（请后台手动生成）'}`,
        `管理后台：${adminUrl}`
      ]
    },
    generation_ready: {
      subject: `【浅焦映像】出图完成，待人工 QC ${orderId}`,
      lines: [
        `订单号：${orderId}`,
        `套餐：${productId}`,
        `主题：${themes}`,
        `手机：${phone}`,
        `生成结果：${event.summary || '已产出候选成片，请在后台 QC 后交付'}`,
        '',
        `请 QC 并交付：${adminUrl}`
      ]
    },
    generation_failed: {
      subject: `【浅焦映像】自动出图失败 ${orderId}`,
      lines: [
        `订单号：${orderId}`,
        `套餐：${productId}`,
        `主题：${themes}`,
        `失败原因：${event.error || '未知错误'}`,
        '',
        `请到后台检查生图配置并手动重试：${adminUrl}`
      ]
    }
  };

  const hit = map[type] || {
    subject: `【浅焦映像】订单事件 ${type} ${orderId}`,
    lines: [`订单号：${orderId}`, `事件：${type}`]
  };

  return {
    subject: hit.subject,
    text: hit.lines.filter(Boolean).join('\n')
  };
}

function sendMail({ host, port, user, pass, to, mail }) {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  return transporter.sendMail({
    from: `"浅焦映像" <${user}>`,
    to,
    subject: mail.subject,
    text: mail.text
  });
}
