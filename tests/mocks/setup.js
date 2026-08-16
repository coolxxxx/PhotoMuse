/**
 * 测试引导：把 tests/mocks/wx-server-sdk.js 安装为根 node_modules/wx-server-sdk，
 * 使 cloudfunctions 目录下各函数的 require('wx-server-sdk') 解析到模拟层。
 */
const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '../../node_modules/wx-server-sdk');
const source = path.resolve(__dirname, 'wx-server-sdk.js');

fs.mkdirSync(target, { recursive: true });
fs.copyFileSync(source, path.join(target, 'index.js'));
fs.writeFileSync(
  path.join(target, 'package.json'),
  JSON.stringify({ name: 'wx-server-sdk', version: '0.0.0-mock', main: 'index.js' }, null, 2)
);

module.exports = require(target);
