/* ============================================================
 * 浅焦映像 · 独立后端数据层（node:sqlite，零原生依赖）
 * ============================================================ */
'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'photomuse.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  product_type TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web',
  openid TEXT,
  contact_phone TEXT NOT NULL,
  query_password_hash TEXT NOT NULL,
  web_token_hash TEXT,
  amount REAL NOT NULL DEFAULT 0,
  themes TEXT NOT NULL DEFAULT '[]',
  style_id TEXT,
  style_name TEXT,
  scene_desc TEXT,
  background_color TEXT,
  order_status TEXT NOT NULL DEFAULT 'waiting_photos',
  photo_review TEXT DEFAULT 'unchecked',
  photo_note TEXT,
  selected_cells TEXT NOT NULL DEFAULT '[]',
  merch_selected TEXT NOT NULL DEFAULT '[]',
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  delivered_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_files (
  file_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  file_type TEXT NOT NULL,
  url TEXT NOT NULL,
  file_name TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS samples (
  sample_id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL,
  file_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS merchandise (
  merch_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  print_spec TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS config_kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function seedConfig(key, value) {
  const row = db.prepare('SELECT key FROM config_kv WHERE key = ?').get(key);
  if (!row) {
    db.prepare('INSERT INTO config_kv (key, value, updated_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), now());
  }
}

module.exports = { db, now, seedConfig };
