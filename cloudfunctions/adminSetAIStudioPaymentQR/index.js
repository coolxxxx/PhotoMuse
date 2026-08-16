const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权配置收款码');
    }

    const fileID = cleanText(event.fileID, 300);
    const note = cleanText(event.note, 100);

    if (!fileID || !fileID.startsWith('cloud://')) {
      return fail('VALIDATION_ERROR', '收款码文件参数无效');
    }

    const existing = await db.collection('ai_studio_payment_config')
      .where({ configId: 'default' })
      .limit(1)
      .get();
    const doc = existing.data && existing.data[0];

    if (doc) {
      await db.collection('ai_studio_payment_config').doc(doc._id).update({
        data: {
          fileID,
          note,
          updatedAt: db.serverDate()
        }
      });
    } else {
      await db.collection('ai_studio_payment_config').add({
        data: {
          configId: 'default',
          fileID,
          note,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
    }

    await writeAudit(null, OPENID, 'admin_set_payment_qr', { fileID });

    const saved = await getConfig();

    return {
      success: true,
      config: {
        configId: 'default',
        fileID: saved.fileID,
        note: saved.note,
        updatedAt: saved.updatedAt
      }
    };
  } catch (error) {
    console.error('adminSetAIStudioPaymentQR failed:', error);
    return fail('INTERNAL_ERROR', '保存收款码失败');
  }
};

async function getConfig() {
  const result = await db.collection('ai_studio_payment_config')
    .where({ configId: 'default' })
    .limit(1)
    .get();
  return (result.data && result.data[0]) || {};
}

function isAdmin(openid) {
  const raw = process.env.AI_STUDIO_ADMIN_OPENIDS || '';
  return raw.split(',').map(item => item.trim()).filter(Boolean).includes(openid);
}

function isAdminPassword(value) {
  const expected = process.env.AI_STUDIO_ADMIN_PASSWORD || '';
  if (!expected) return false;
  if (typeof value !== 'string') return false;
  return value.trim() === expected;
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

async function writeAudit(orderId, actorOpenid, action, payload = {}) {
  await db.collection('ai_studio_audit_logs').add({
    data: {
      orderId,
      actorOpenid,
      action,
      payload,
      createdAt: db.serverDate()
    }
  });
}

function fail(code, message) {
  return { success: false, code, message };
}
