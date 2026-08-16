const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const THEME_WHITELIST = ['guofeng', 'sports', 'casual', 'travel', 'family'];
const MAX_BATCH = 50;

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权维护样张库');
    }

    const samples = Array.isArray(event.samples) ? event.samples : [];
    const removeSampleIds = (Array.isArray(event.removeSampleIds) ? event.removeSampleIds : [])
      .map(id => cleanText(id, 64))
      .filter(Boolean);

    if (samples.length < 1 && removeSampleIds.length < 1) {
      return fail('VALIDATION_ERROR', '请至少提供 1 条样张数据或待删除 ID');
    }
    if (samples.length > MAX_BATCH || removeSampleIds.length > MAX_BATCH) {
      return fail('VALIDATION_ERROR', '单次最多维护 50 条样张');
    }

    const prepared = [];
    for (const item of samples) {
      if (!item || typeof item !== 'object') {
        return fail('VALIDATION_ERROR', '样张数据无效');
      }
      const themeId = cleanText(item.themeId, 32);
      if (!THEME_WHITELIST.includes(themeId)) {
        return fail('VALIDATION_ERROR', '主题无效（须为 guofeng/sports/casual/travel/family）');
      }
      const fileID = cleanText(item.fileID, 300);
      if (!fileID || !fileID.startsWith('cloud://')) {
        return fail('VALIDATION_ERROR', '样张文件参数无效');
      }
      prepared.push({
        sampleId: cleanText(item.sampleId, 64),
        themeId,
        fileID,
        caption: cleanText(item.caption, 100),
        sortOrder: clampSortOrder(item.sortOrder),
        enabled: item.enabled === undefined ? true : Boolean(item.enabled)
      });
    }

    let updated = 0;

    for (const sample of prepared) {
      const { sampleId, ...data } = sample;
      if (sampleId) {
        await db.collection('ai_studio_samples').doc(sampleId).update({
          data: { ...data, updatedAt: db.serverDate() }
        });
      } else {
        await db.collection('ai_studio_samples').add({
          data: { ...data, createdAt: db.serverDate(), updatedAt: db.serverDate() }
        });
      }
      updated += 1;
    }

    for (const sampleId of removeSampleIds) {
      await db.collection('ai_studio_samples').doc(sampleId).remove();
      updated += 1;
    }

    await writeAudit(null, OPENID, 'admin_upsert_samples', { count: updated });

    return { success: true, updated };
  } catch (error) {
    console.error('adminUpsertAIStudioSamples failed:', error);
    return fail('INTERNAL_ERROR', '保存样张失败');
  }
};

function clampSortOrder(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(999, Math.round(parsed));
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
