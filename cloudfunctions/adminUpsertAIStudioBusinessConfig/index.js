const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();

  try {
    if (!isAdmin(OPENID) || !isAdminPassword(event.adminPassword)) {
      return fail('FORBIDDEN', '无权配置写真定价');
    }

    const input = event.config && typeof event.config === 'object' ? event.config : {};
    const parsed = normalizeConfig(input);
    if (!parsed) {
      return fail('VALIDATION_ERROR', '定价配置无效：价格需为 1-99999，maxThemes 需为 1-5 的整数，photosPerTheme 需为 1-15 的整数');
    }

    const now = db.serverDate();
    const existing = await db.collection('ai_studio_business_config')
      .where({ configId: 'default' })
      .limit(1)
      .get();
    const existingDoc = existing.data && existing.data[0];
    if (existingDoc) {
      await db.collection('ai_studio_business_config').doc(existingDoc._id).update({
        data: {
          ...parsed,
          updatedBy: OPENID,
          updatedAt: now
        }
      });
    } else {
      await db.collection('ai_studio_business_config').add({
        data: {
          configId: 'default',
          ...parsed,
          createdBy: OPENID,
          createdAt: now,
          updatedBy: OPENID,
          updatedAt: now
        }
      });
    }

    await writeAudit(OPENID, 'admin_upsert_business_config', { config: parsed });

    return { success: true, config: parsed };
  } catch (error) {
    console.error('adminUpsertAIStudioBusinessConfig failed:', error);
    return fail('INTERNAL_ERROR', '保存写真定价配置失败');
  }
};

function normalizeConfig(input) {
  const baseThemePrice = roundPrice(input.baseThemePrice);
  const extraThemePrice = roundPrice(input.extraThemePrice);
  const maxThemes = toInteger(input.maxThemes);
  const photosPerTheme = toInteger(input.photosPerTheme);
  if (baseThemePrice === null || extraThemePrice === null) return null;
  if (maxThemes === null || maxThemes < 1 || maxThemes > 5) return null;
  if (photosPerTheme === null || photosPerTheme < 1 || photosPerTheme > 15) return null;
  return { baseThemePrice, extraThemePrice, maxThemes, photosPerTheme };
}

function roundPrice(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99999) return null;
  return Math.round(parsed * 10) / 10;
}

function toInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

async function writeAudit(actorOpenid, action, payload = {}) {
  await db.collection('ai_studio_audit_logs').add({
    data: {
      orderId: 'business_config',
      actorOpenid,
      action,
      payload,
      createdAt: db.serverDate()
    }
  });
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

function fail(code, message) {
  return { success: false, code, message };
}
