/**
 * wx-server-sdk 内存模拟层（仅供本地集成测试）
 * - 内存文档数据库：支持 where 等值/in 匹配、orderBy/skip/limit、get/update/count、doc().update/remove、点路径更新（themes.0.selectedCells）
 * - cloud.callFunction 会加载 cloudfunctions/<name>/index.js 真实模块执行（同一进程、同一数据）
 * - uploadFile/downloadFile/getTempFileURL 用内存文件仓；downloadFile 未命中时生成一张合法 64x64 JPEG（供制作稿管线真跑）
 */
const path = require('path');
const fs = require('fs');

const state = {
  collections: new Map(), // name -> [{ _id, ...doc }]
  files: new Map(), // fileID -> Buffer
  currentOpenid: undefined,
  autoId: 1
};

function nowDate() {
  return { __serverDate: Date.now() };
}

function isServerDate(v) {
  return v && typeof v === 'object' && typeof v.__serverDate === 'number';
}

function matchesCondition(doc, cond) {
  for (const key of Object.keys(cond || {})) {
    const expected = cond[key];
    if (expected && typeof expected === 'object' && Array.isArray(expected.__in)) {
      if (!expected.__in.includes(doc[key])) return false;
      continue;
    }
    if (isServerDate(expected) && isServerDate(doc[key])) {
      if (expected.__serverDate !== doc[key].__serverDate) return false;
      continue;
    }
    if (doc[key] !== expected) return false;
  }
  return true;
}

function setPath(target, dottedKey, value) {
  const parts = String(dottedKey).split('.');
  let node = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const seg = parts[i];
    const nextSeg = parts[i + 1];
    if (Array.isArray(node)) {
      const idx = Number(seg);
      if (!node[idx]) node[idx] = /^\d+$/.test(nextSeg) ? [] : {};
      node = node[idx];
    } else {
      if (typeof node[seg] !== 'object' || node[seg] === null) {
        node[seg] = /^\d+$/.test(nextSeg) ? [] : {};
      }
      node = node[seg];
    }
  }
  const last = parts[parts.length - 1];
  if (Array.isArray(node) && /^\d+$/.test(last)) {
    node[Number(last)] = value;
  } else {
    node[last] = value;
  }
}

function applyUpdateData(doc, data) {
  for (const key of Object.keys(data || {})) {
    if (key.includes('.')) {
      setPath(doc, key, data[key]);
    } else if (data[key] && typeof data[key] === 'object' && !isServerDate(data[key]) && !Array.isArray(data[key])) {
      // 浅合并嵌套对象（贴近服务端行为）
      doc[key] = { ...(doc[key] || {}), ...data[key] };
    } else {
      doc[key] = data[key];
    }
  }
}

function getCollection(name) {
  if (!state.collections.has(name)) state.collections.set(name, []);
  return state.collections.get(name);
}

function cloneDoc(doc) {
  return JSON.parse(JSON.stringify(doc, (k, v) => (isServerDate(v) ? { __serverDate: v.__serverDate } : v)));
}

class Query {
  constructor(name) {
    this.name = name;
    this.cond = {};
    this.orderField = null;
    this.orderDir = 'asc';
    this.skipCount = 0;
    this.limitCount = Infinity;
  }

  where(cond) {
    this.cond = cond || {};
    return this;
  }

  orderBy(field, dir) {
    this.orderField = field;
    this.orderDir = dir === 'desc' ? 'desc' : 'asc';
    return this;
  }

  skip(n) {
    this.skipCount = n || 0;
    return this;
  }

  limit(n) {
    this.limitCount = n === undefined ? Infinity : n;
    return this;
  }

  _matched() {
    return getCollection(this.name).filter(doc => matchesCondition(doc, this.cond));
  }

  _sorted(docs) {
    if (!this.orderField) return docs;
    const dir = this.orderDir === 'desc' ? -1 : 1;
    return docs.slice().sort((a, b) => {
      const va = a[this.orderField];
      const vb = b[this.orderField];
      const ta = isServerDate(va) ? va.__serverDate : va;
      const tb = isServerDate(vb) ? vb.__serverDate : vb;
      if (ta === tb) return 0;
      if (ta === undefined) return 1;
      if (tb === undefined) return -1;
      return (ta < tb ? -1 : 1) * dir;
    });
  }

  async get() {
    const docs = this._sorted(this._matched()).slice(this.skipCount, this.skipCount + this.limitCount);
    return { data: docs.map(cloneDoc) };
  }

  async count() {
    return { total: this._matched().length };
  }

  async update({ data }) {
    const docs = this._matched();
    docs.forEach(doc => applyUpdateData(doc, data));
    return { stats: { updated: docs.length } };
  }
}

class Collection extends Query {
  constructor(name) {
    super(name);
  }

  async add({ data }) {
    const doc = { _id: 'mock-id-' + state.autoId++, ...cloneDoc(data || {}) };
    getCollection(this.name).push(doc);
    return { _id: doc._id };
  }

  doc(id) {
    const self = this;
    return {
      async get() {
        const found = getCollection(self.name).find(d => d._id === id);
        return { data: found ? cloneDoc(found) : null };
      },
      async update({ data }) {
        const found = getCollection(self.name).find(d => d._id === id);
        if (found) applyUpdateData(found, data);
        return { stats: { updated: found ? 1 : 0 } };
      },
      async remove() {
        const list = getCollection(self.name);
        const idx = list.findIndex(d => d._id === id);
        if (idx >= 0) list.splice(idx, 1);
        return { stats: { removed: idx >= 0 ? 1 : 0 } };
      }
    };
  }
}

const functionCache = new Map();

function loadCloudFunction(name) {
  if (functionCache.has(name)) return functionCache.get(name);
  const fnPath = path.resolve(__dirname, '../../cloudfunctions', name, 'index.js');
  if (!fs.existsSync(fnPath)) throw new Error('云函数不存在: ' + name);
  const mod = require(fnPath);
  functionCache.set(name, mod);
  return mod;
}

function makeFakeJpeg() {
  // 用 jpeg-js 生成一张合法 64x64 JPEG，供 downloadFile 兜底（制作稿管线真跑）
  const jpeg = require('jpeg-js');
  const w = 64, h = 64;
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    buf[i * 4] = (i * 7) % 256;
    buf[i * 4 + 1] = (i * 13) % 256;
    buf[i * 4 + 2] = (i * 29) % 256;
    buf[i * 4 + 3] = 255;
  }
  return jpeg.encode({ data: buf, width: w, height: h }, 90).data;
}

const cloud = {
  DYNAMIC_CURRENT_ENV: Symbol('DYNAMIC_CURRENT_ENV'),
  init() {},
  getWXContext() {
    return { OPENID: state.currentOpenid };
  },
  database() {
    const db = {
      serverDate: nowDate,
      command: {
        in: arr => ({ __in: arr })
      },
      collection: name => new Collection(name)
    };
    return db;
  },
  async callFunction({ name, data }) {
    const mod = loadCloudFunction(name);
    const result = await mod.main(data || {});
    return { result };
  },
  async uploadFile({ cloudPath }) {
    const fileID = 'cloud://mock-env.636c/' + cloudPath;
    return { fileID };
  },
  async downloadFile({ fileID }) {
    return { fileContent: state.files.get(fileID) || makeFakeJpeg() };
  },
  async getTempFileURL({ fileList }) {
    return {
      fileList: (fileList || []).map(fileID => ({
        fileID,
        tempFileURL: 'https://mock-tmp/' + encodeURIComponent(fileID)
      }))
    };
  }
};

cloud.__mock = {
  state,
  invoke(name, data, openid) {
    state.currentOpenid = openid;
    return loadCloudFunction(name).main(data || {});
  },
  reset() {
    state.collections.clear();
    state.files.clear();
    state.currentOpenid = undefined;
    state.autoId = 1;
  },
  storeFile(fileID, buffer) {
    state.files.set(fileID, buffer);
  },
  snapshot(name) {
    return getCollection(name).map(cloneDoc);
  }
};

module.exports = cloud;
