const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

/**
 * 浅焦映像全部集合（7 个业务 + 4 个配置）。
 * 业务集合：订单/文件/任务/审计/路由/模型设置/提示词模板
 * 配置集合：定价单例/样张库/周边目录/收款码（均有代码内置默认值，建集合是为了后台可改）
 */
const COLLECTIONS = [
  'ai_studio_orders',
  'ai_studio_files',
  'ai_studio_jobs',
  'ai_studio_audit_logs',
  'ai_studio_routes',
  'ai_studio_model_settings',
  'ai_studio_prompt_templates',
  'ai_studio_business_config',
  'ai_studio_samples',
  'ai_studio_merchandise',
  'ai_studio_payment_config'
];

exports.main = async () => {
  const created = [];
  const existed = [];
  const failed = [];

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
      created.push(name);
    } catch (error) {
      const code = (error && (error.code || error.errCode)) || '';
      const msg = String((error && error.message) || error);
      // 已存在（数据库 COLLECTION_EXISTS / -501001 或文案提示已存在）视为成功
      if (code === 'COLLECTION_EXISTS' || code === -501001 || msg.includes('already exist') || msg.includes('已存在')) {
        existed.push(name);
      } else {
        failed.push({ name, message: msg.slice(0, 120) });
      }
    }
  }

  return {
    success: failed.length === 0,
    createdCount: created.length,
    existedCount: existed.length,
    created,
    existed,
    failed,
    total: COLLECTIONS.length
  };
};
