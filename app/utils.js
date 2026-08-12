/*
 * 湾区温泉大全 · 纯工具函数
 * 无 DOM 依赖，浏览器挂到 window.HotSpring，Node 通过 require 使用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.HotSpring = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 插画地图投影范围（大湾区 9 市）
  const PROJECTION = { minLng: 111.3, maxLng: 115.3, minLat: 21.8, maxLat: 24.1, width: 800, height: 640 };

  // 所有来自数据文件的文字进入 innerHTML 前都经过转义。
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function numberText(value, suffix = '') {
    return typeof value === 'number' && Number.isFinite(value) ? `${value}${suffix}` : '待补充';
  }

  // 从 hotelCount 文案中提取用于排序的"规模数字"。
  // 1) 去掉「4A/5A」等级标记，避免把等级数字误当数量；
  // 2) 复合表述（如「8家+139家民宿」）取最大数字，更贴近真实规模；
  // 3) 无数字时回退到 hotels 数组长度。
  function hotelCountValue(region) {
    const text = String(region && region.hotelCount ? region.hotelCount : '');
    const cleaned = text.replace(/\d+\s*[Aa]级?/g, '');
    const nums = (cleaned.match(/\d+/g) || []).map(Number);
    if (nums.length) return Math.max(...nums);
    return (region && Array.isArray(region.hotels) ? region.hotels.length : 0);
  }

  function hotelCountText(region) {
    const value = String(region && region.hotelCount ? region.hotelCount : '待补充');
    return /民宿|待核实|待补充/.test(value) ? value : `${value}家`;
  }

  function project(lat, lng) {
    const x = ((lng - PROJECTION.minLng) / (PROJECTION.maxLng - PROJECTION.minLng)) * PROJECTION.width;
    const y = ((PROJECTION.maxLat - lat) / (PROJECTION.maxLat - PROJECTION.minLat)) * PROJECTION.height;
    return { x, y };
  }

  function shortRegionName(name) {
    return String(name).replace(/（.*?）/g, '').replace(/镇|村/g, '').slice(0, 8);
  }

  function haversine(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(km) {
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  }

  return {
    PROJECTION,
    esc,
    numberText,
    hotelCountValue,
    hotelCountText,
    project,
    shortRegionName,
    haversine,
    formatDistance
  };
}));
