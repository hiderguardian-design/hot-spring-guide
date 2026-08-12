#!/usr/bin/env node
/** 静态文件烟雾检查：不需要浏览器或第三方依赖。 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const required = [
  'index.html', 'README.md', 'LICENSE', 'CONTRIBUTING.md',
  'manifest.webmanifest', 'sw.js',
  'app/index.html', 'app/app.js', 'app/utils.js', 'app/icon.svg', 'app/map/gd-map.svg',
  'data/regions-gd.json', 'data/transit-gd.json', 'data/LICENSE', 'docs/DATA_SCHEMA.md', 'scripts/validate.js', 'scripts/unit-test.js'
];
const errors = [];
for (const relative of required) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) errors.push(`缺少或为空: ${relative}`);
}
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/regions-gd.json'), 'utf8'));
for (const ref of ['app.js', 'utils.js', '../manifest.webmanifest']) {
  if (!html.includes(ref)) errors.push(`app/index.html 未引用 ${ref}`);
}
for (const ref of ['../data/regions-gd.json', '../data/transit-gd.json', 'map/gd-map.svg', 'window.HotSpring']) {
  if (!js.includes(ref)) errors.push(`app/app.js 未引用 ${ref}`);
}
if (!sw.includes('self.addEventListener')) errors.push('sw.js 缺少 Service Worker 事件监听');
if (!Array.isArray(data.regions) || data.regions.length < 1) errors.push('区域数据为空');
if (errors.length) {
  errors.forEach(item => console.error(`✗ ${item}`));
  process.exit(1);
}
console.log(`✓ 静态文件烟雾检查通过（${data.regions.length} 个区域）`);
