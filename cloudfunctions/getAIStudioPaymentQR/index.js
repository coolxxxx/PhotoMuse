const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event = {}) => {
  try {
    const result = await db.collection('ai_studio_payment_config')
      .where({ configId: 'default' })
      .limit(1)
      .get();
    const doc = result.data && result.data[0];

    if (!doc) return { success: true, config: null };

    return {
      success: true,
      config: {
        fileID: doc.fileID,
        note: doc.note,
        updatedAt: doc.updatedAt
      }
    };
  } catch (error) {
    console.error('getAIStudioPaymentQR failed:', error);
    return { success: true, config: null };
  }
};
