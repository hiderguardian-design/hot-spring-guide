#!/usr/bin/env node
/**
 * 大湾区温泉大全 - 数据校验脚本
 * 用法: node scripts/validate.js [data.json]
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, '..', 'data', 'regions-gd.json');
const CITIES = new Set(['广州', '深圳', '珠海', '佛山', '惠州', '东莞', '中山', '江门', '肇庆']);
const STATUSES = new Set(['operating', 'needs_review', 'closed_or_recruiting', 'resource_only']);
const AUTHENTICITY = new Set(['true', 'mixed', 'uncertain']);
const errors = [];
const warnings = [];
let data = null;

function error(message) { errors.push(message); }
function warning(message) { warnings.push(message); }
function isNonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function isFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
function hasOwn(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }

function main() {
  if (!fs.existsSync(file)) {
    console.error(`✗ 找不到数据文件: ${file}`);
    process.exit(1);
  }

  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (exception) {
    console.error(`✗ JSON 解析失败: ${exception.message}`);
    process.exit(1);
  }

  validateMeta();
  validateRegions();
  finish();
}

function validateMeta() {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    error('数据根节点必须是对象');
    return;
  }
  if (!data.meta || typeof data.meta !== 'object' || Array.isArray(data.meta)) {
    error('缺少 meta 对象');
    return;
  }
  ['title', 'version', 'updated', 'license'].forEach(key => {
    if (!isNonEmptyString(data.meta[key])) error(`meta.${key} 缺失或不是非空字符串`);
  });
  if (data.meta.license !== 'ODbL-1.0') warning(`meta.license 建议为 ODbL-1.0（当前: ${data.meta.license}）`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.meta.updated)) warning('meta.updated 建议使用 YYYY-MM-DD 格式');
  if (!Array.isArray(data.meta.dataSources) || data.meta.dataSources.length === 0) warning('meta.dataSources 建议至少包含一个来源');
}

function validateRegions() {
  if (!Array.isArray(data?.regions) || data.regions.length === 0) {
    error('regions 必须是非空数组');
    return;
  }

  const regionIds = new Set();
  data.regions.forEach((region, index) => {
    const label = `regions[${index}] (${region?.name || '未命名'})`;
    if (!region || typeof region !== 'object' || Array.isArray(region)) {
      error(`${label}: 必须是对象`);
      return;
    }

    ['id', 'name', 'city', 'district', 'intro', 'hotelCount', 'source', 'status', 'checkedAt'].forEach(key => {
      if (!isNonEmptyString(region[key])) error(`${label}: ${key} 缺失或不是非空字符串`);
    });
    if (region.status && !STATUSES.has(region.status)) error(`${label}: status 不在允许值列表`);
    if (region.sourceUrl && !/^https?:\/\//.test(region.sourceUrl)) error(`${label}: sourceUrl 必须是 http(s) URL`);
    if (region.checkedAt && !/^\d{4}-\d{2}-\d{2}$/.test(region.checkedAt)) error(`${label}: checkedAt 必须使用 YYYY-MM-DD`);
    if (!hasOwn(region, 'lat') || !isFiniteNumber(region.lat) || region.lat < 21.5 || region.lat > 24.5) {
      error(`${label}: lat 必须是 21.5~24.5 范围内的数字`);
    }
    if (!hasOwn(region, 'lng') || !isFiniteNumber(region.lng) || region.lng < 111 || region.lng > 116) {
      error(`${label}: lng 必须是 111~116 范围内的数字`);
    }
    if (!hasOwn(region, 'temp') || (region.temp !== null && (!isFiniteNumber(region.temp) || region.temp < 0 || region.temp > 120))) {
      error(`${label}: temp 必须是 0~120 范围内的数字，未知时为 null`);
    }
    if (!Array.isArray(region.springType)) error(`${label}: springType 必须是数组`);
    if (!Array.isArray(region.tags)) error(`${label}: tags 必须是数组`);
    if (typeof region.approx !== 'boolean') error(`${label}: approx 必须是 boolean`);
    if (typeof region.verified !== 'boolean') error(`${label}: verified 必须是 boolean`);
    if (!hasOwn(region, 'springAuthenticity') || !AUTHENTICITY.has(region.springAuthenticity)) error(`${label}: springAuthenticity 必须是 true/mixed/uncertain`);
    if (hasOwn(region, 'poi')) {
      if (!region.poi || typeof region.poi !== 'object' || Array.isArray(region.poi)) {
        error(`${label}: poi 必须是对象`);
      } else {
        if (!isNonEmptyString(region.poi.name)) error(`${label}: poi.name 缺失或不是非空字符串`);
        if (!isFiniteNumber(region.poi.lat) || !isFiniteNumber(region.poi.lng)) error(`${label}: poi.lat/lng 必须是数字`);
        if (typeof region.poi.approx !== 'boolean') error(`${label}: poi.approx 必须是 boolean`);
      }
    }

    if (region.id) {
      if (regionIds.has(region.id)) error(`${label}: id "${region.id}" 重复`);
      regionIds.add(region.id);
      if (!/^gd-[a-z]+(-[a-z0-9]+)+$/.test(region.id)) warning(`${label}: id "${region.id}" 不符合推荐格式`);
    }
    if (region.city && !CITIES.has(region.city)) error(`${label}: city "${region.city}" 不在大湾区 9 市列表`);

    if (!Array.isArray(region.hotels)) {
      error(`${label}: hotels 必须是数组`);
      return;
    }
    const hotelNames = new Set();
    region.hotels.forEach((hotel, hotelIndex) => validateHotel(hotel, `${label}.hotels[${hotelIndex}]` , hotelNames));
  });
}

function validateHotel(hotel, label, hotelNames) {
  if (!hotel || typeof hotel !== 'object' || Array.isArray(hotel)) {
    error(`${label}: 必须是对象`);
    return;
  }
  ['name', 'price', 'desc', 'source', 'checkedAt'].forEach(key => {
    if (!isNonEmptyString(hotel[key])) error(`${label}: ${key} 缺失或不是非空字符串`);
  });
  if (hotel.sourceUrl && !/^https?:\/\//.test(hotel.sourceUrl)) error(`${label}: sourceUrl 必须是 http(s) URL`);
  if (hotel.checkedAt && !/^\d{4}-\d{2}-\d{2}$/.test(hotel.checkedAt)) error(`${label}: checkedAt 必须使用 YYYY-MM-DD`);
  if (!hasOwn(hotel, 'cert')) error(`${label}: 缺少 cert（未知时请明确写 null）`);
  if (typeof hotel.cert !== 'string' && hotel.cert !== null) error(`${label}: cert 必须是字符串或 null`);
  if (typeof hotel.verified !== 'boolean') error(`${label}: verified 必须是 boolean`);
  if (hasOwn(hotel, 'authenticity') && !['true', 'false', 'unknown'].includes(hotel.authenticity)) error(`${label}: authenticity 必须是 true/false/unknown（可选）`);
  if (hotel.name && hotelNames.has(hotel.name)) error(`${label}: 区域内酒店名重复 "${hotel.name}"`);
  if (hotel.name) hotelNames.add(hotel.name);
}

function finish() {
  const regions = Array.isArray(data?.regions) ? data.regions : [];
  const hotels = regions.reduce((total, region) => total + (Array.isArray(region.hotels) ? region.hotels.length : 0), 0);
  console.log(`✔ 数据文件: ${path.basename(file)}`);
  console.log(`✔ 温泉区域: ${regions.length} 个`);
  console.log(`✔ 区域内酒店: ${hotels} 家`);
  if (warnings.length) {
    console.log(`\n⚠ ${warnings.length} 条警告:`);
    warnings.forEach(item => console.log(`  ⚠ ${item}`));
  }
  if (errors.length) {
    console.log(`\n✗ ${errors.length} 条错误:`);
    errors.forEach(item => console.log(`  ✗ ${item}`));
    process.exit(1);
  }
  console.log('\n✓ 校验通过');
}

main();
