const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async () => {
  try {
    const result = await db.collection('ai_studio_samples')
      .where({ enabled: true })
      .orderBy('sortOrder', 'asc')
      .limit(50)
      .get();

    const rows = result.data || [];
    const data = rows.map(doc => ({
      sampleId: doc._id,
      themeId: cleanText(doc.themeId, 32),
      fileID: cleanText(doc.fileID, 300),
      caption: cleanText(doc.caption, 100),
      sortOrder: normalizeNumber(doc.sortOrder)
    }));

    return { success: true, data };
  } catch (error) {
    console.error('listAIStudioSamples failed:', error);
    return { success: true, data: [] };
  }
};

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
