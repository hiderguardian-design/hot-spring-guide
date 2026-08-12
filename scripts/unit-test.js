#!/usr/bin/env node
/**
 * 纯函数单元测试：不依赖浏览器、不依赖第三方库。
 * 用法: node scripts/unit-test.js
 */
'use strict';

const assert = require('assert');
const U = require('../app/utils.js');

let pass = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    process.exitCode = 1;
  }
}

console.log('esc');
test('转义 HTML 特殊字符', () => {
  assert.strictEqual(U.esc('<a b="c">&\''), '&lt;a b=&quot;c&quot;&gt;&amp;&#39;');
});
test('null/undefined 返回空字符串', () => {
  assert.strictEqual(U.esc(null), '');
  assert.strictEqual(U.esc(undefined), '');
});

console.log('numberText');
test('数字带后缀', () => assert.strictEqual(U.numberText(90, '℃'), '90℃'));
test('非数字返回待补充', () => assert.strictEqual(U.numberText(null), '待补充'));

console.log('hotelCountValue');
test('复合表述取最大数字（8家+139家民宿 → 139）', () => {
  assert.strictEqual(U.hotelCountValue({ hotelCount: '8家温泉度假区+139家民宿（永汉镇口径）' }), 139);
});
test('酒店+乡村民宿取最大（7家+130+ → 130）', () => {
  assert.strictEqual(U.hotelCountValue({ hotelCount: '7家温泉主题酒店+130+乡村民宿' }), 130);
});
test('排除 4A 等级数字（2个4A级景区 → 2）', () => {
  assert.strictEqual(U.hotelCountValue({ hotelCount: '2个4A级温泉景区' }), 2);
});
test('单数字', () => assert.strictEqual(U.hotelCountValue({ hotelCount: '148家温泉酒店/民宿' }), 148));
test('约60家', () => assert.strictEqual(U.hotelCountValue({ hotelCount: '约60家温泉旅游企业' }), 60));
test('N+ 形式', () => assert.strictEqual(U.hotelCountValue({ hotelCount: '100+民宿' }), 100));
test('无数字回退 hotels.length', () => {
  assert.strictEqual(U.hotelCountValue({ hotelCount: '待核实', hotels: [1, 2, 3] }), 3);
  assert.strictEqual(U.hotelCountValue({ hotelCount: '多家温泉酒店+特色民宿', hotels: [] }), 0);
});
test('缺 hotelCount 回退 hotels.length', () => {
  assert.strictEqual(U.hotelCountValue({ hotels: [1, 2] }), 2);
});

console.log('hotelCountText');
test('含民宿原样返回', () => assert.strictEqual(U.hotelCountText({ hotelCount: '148家温泉酒店/民宿' }), '148家温泉酒店/民宿'));
test('纯数字加「家」', () => assert.strictEqual(U.hotelCountText({ hotelCount: '1+' }), '1+家'));
test('缺 hotelCount 返回待补充', () => assert.strictEqual(U.hotelCountText({}), '待补充'));

console.log('project');
test('左下角映射到 (0,640)', () => {
  const p = U.project(21.8, 111.3);
  assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.y - 640) < 1e-6, `实际 (${p.x},${p.y})`);
});
test('右上角映射到 (800,0)', () => {
  const p = U.project(24.1, 115.3);
  assert.ok(Math.abs(p.x - 800) < 1e-6 && Math.abs(p.y) < 1e-6, `实际 (${p.x},${p.y})`);
});

console.log('shortRegionName');
test('去括号、去「镇/村」', () => {
  assert.strictEqual(U.shortRegionName('龙门永汉镇（南昆山脚）'), '龙门永汉');
});
test('最多保留 8 字', () => {
  assert.ok(U.shortRegionName('惠东稔平半岛（平海·巽寮）').length <= 8);
});

console.log('haversine');
test('同点为 0', () => assert.ok(U.haversine(23, 113, 23, 113) < 1e-9));
test('纬度 1 度约 111km', () => {
  const km = U.haversine(0, 0, 1, 0);
  assert.ok(km > 110 && km < 112, `应为约111km，实际 ${km}`);
});

console.log('formatDistance');
test('小于 10km 保留一位小数', () => assert.strictEqual(U.formatDistance(5.43), '5.4 km'));
test('大于等于 10km 取整', () => assert.strictEqual(U.formatDistance(15.6), '16 km'));

console.log(`\n${pass} 项通过${process.exitCode ? '，存在失败项' : ''}`);
