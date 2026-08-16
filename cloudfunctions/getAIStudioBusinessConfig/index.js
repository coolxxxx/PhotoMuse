const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 与小程序端 utils/ai-studio-config.js 的 PORTRAIT_PRICING 保持一致的服务端默认值。
// 集合 ai_studio_business_config 无记录 / 字段缺失 / 读取异常时，一律回退默认值，永不返回 success:false。
const DEFAULT_BUSINESS_CONFIG = {
  baseThemePrice: 69.9,
  extraThemePrice: 39.9,
  maxThemes: 3,
  photosPerTheme: 5
};

exports.main = async () => {
  const config = { ...DEFAULT_BUSINESS_CONFIG };
  try {
    const result = await db.collection('ai_studio_business_config')
      .where({ configId: 'default' })
      .limit(1)
      .get();
    const record = result.data && result.data[0];
    if (record) {
      config.baseThemePrice = pickPrice(record.baseThemePrice, DEFAULT_BUSINESS_CONFIG.baseThemePrice);
      config.extraThemePrice = pickPrice(record.extraThemePrice, DEFAULT_BUSINESS_CONFIG.extraThemePrice);
      config.maxThemes = pickInteger(record.maxThemes, 1, 5, DEFAULT_BUSINESS_CONFIG.maxThemes);
      config.photosPerTheme = pickInteger(record.photosPerTheme, 1, 15, DEFAULT_BUSINESS_CONFIG.photosPerTheme);
    }
  } catch (error) {
    console.error('getAIStudioBusinessConfig failed, fallback to defaults:', error);
  }
  return { success: true, config };
};

function pickPrice(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 99999) return fallback;
  return Math.round(parsed * 10) / 10;
}

function pickInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}
