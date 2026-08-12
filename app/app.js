/*
 * 湾区温泉大全 · 小程序风格网页版
 * 纯静态前端：数据来自 ../data/regions-gd.json
 */
(() => {
  'use strict';

  // 纯工具函数来自 app/utils.js（浏览器全局 HotSpring）
  const { esc, numberText, hotelCountValue, hotelCountText, project, shortRegionName, haversine, formatDistance } = window.HotSpring;

  const DATA_URL = '../data/regions-gd.json';
  const MAP_URL = 'map/gd-map.svg';
  const TRANSIT_URL = '../data/transit-gd.json';
  const TRANSIT_TYPES = {
    highspeed: { label: '高铁', color: '#E64545' },
    intercity: { label: '城轨', color: '#3E8EC9' },
    metro: { label: '地铁', color: '#3DA35D' }
  };
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const STORAGE = {
    favorites: 'bay-hot-springs.favorites.v1',
    visited: 'bay-hot-springs.visited.v1'
  };
  const CITIES = ['全部', '广州', '深圳', '珠海', '佛山', '惠州', '东莞', '中山', '江门', '肇庆'];
  const STATUS_FILTERS = [
    { id: 'all', label: '全部状态' },
    { id: 'operating', label: '当前可泡' },
    { id: 'needs_review', label: '待核实' },
    { id: 'closed_or_recruiting', label: '停业/招商' },
    { id: 'resource_only', label: '资源记录' }
  ];
  const STATUS_LABELS = {
    operating: '当前可泡',
    needs_review: '待核实',
    closed_or_recruiting: '停业/招商',
    resource_only: '资源记录'
  };
  const AUTH_FILTERS = [
    { id: 'all', label: '全部泉水' },
    { id: 'true', label: '真温泉' },
    { id: 'mixed', label: '真假混合' },
    { id: 'uncertain', label: '待核实' }
  ];
  const AUTH_LABELS = {
    true: '真温泉',
    mixed: '真假混合',
    uncertain: '待核实'
  };
  const state = {
    data: null,
    mapLoaded: false,
    mapMode: 'illustration',
    leaflet: null,
    leafletMarkers: [],
    transit: null,
    showTransit: true,
    leafletTransit: null,
    tab: 'map',
    city: '全部',
    status: 'all',
    auth: 'all',
    sort: 'default',
    search: '',
    favorites: readSet(STORAGE.favorites),
    visited: readSet(STORAGE.visited),
    favoriteTab: 'fav',
    userLocation: null,
    distances: new Map(),
    toastTimer: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function readSet(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return new Set(Array.isArray(value) ? value.filter(v => typeof v === 'string') : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveSet(key, set) {
    try {
      localStorage.setItem(key, JSON.stringify([...set]));
    } catch (_) {
      showToast('浏览器未允许保存本地数据');
    }
  }

  function regionById(id) {
    return state.data?.regions.find(r => r.id === id) || null;
  }

  function regionMatches(r) {
    if (state.city !== '全部' && r.city !== state.city) return false;
    if (state.status !== 'all' && r.status !== state.status) return false;
    if (state.auth !== 'all' && r.springAuthenticity !== state.auth) return false;
    const q = state.search.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
      r.name, r.city, r.district, r.intro, ...(r.springType || []), ...(r.tags || []),
      ...(r.hotels || []).flatMap(h => [h.name, h.desc, h.cert || ''])
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  }

  function visibleRegions() {
    const list = state.data?.regions.filter(regionMatches) || [];
    return list.sort((a, b) => {
      if (state.sort === 'temp') return (b.temp ?? -Infinity) - (a.temp ?? -Infinity);
      if (state.sort === 'hotel') return hotelCountValue(b) - hotelCountValue(a);
      if (state.sort === 'distance') return (state.distances.get(a.id) ?? Infinity) - (state.distances.get(b.id) ?? Infinity);
      return 0;
    });
  }

  function showToast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function setTab(tab) {
    state.tab = tab;
    $$('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    $$('.page').forEach(el => el.classList.toggle('active', el.id === `page-${tab}`));
    if (tab === 'map') {
      loadIllustrationMap();
    } else if (tab === 'list') {
      renderList();
    } else if (tab === 'fav') {
      renderFavorites();
    }
  }

  async function loadIllustrationMap() {
    if (state.mapLoaded) {
      if (state.mapMode === 'illustration') renderMapMarkers();
      return;
    }
    const host = $('#mapSvg');
    try {
      const response = await fetch(MAP_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`地图加载失败 ${response.status}`);
      host.innerHTML = await response.text();
      state.mapLoaded = true;
      renderMapMarkers();
    } catch (error) {
      host.innerHTML = '<div class="empty"><div class="big">🗺️</div>插画地图加载失败，请通过本地服务器打开项目</div>';
      console.error(error);
    }
  }

  function renderMapMarkers() {
    if (!state.mapLoaded || state.mapMode !== 'illustration') return;
    const layer = $('#regionLayer', $('#mapSvg'));
    if (!layer) return;
    layer.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    const fragment = document.createDocumentFragment();

    visibleMapRegions().forEach(region => {
      const { x, y } = project(region.lat, region.lng);
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('class', 'r-marker');
      group.dataset.id = region.id;
      group.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      const bubble = document.createElementNS(ns, 'g');
      bubble.setAttribute('class', 'bubble');
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('r', '11');
      circle.setAttribute('fill', '#E86A33');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '2');
      const inner = document.createElementNS(ns, 'circle');
      inner.setAttribute('r', '4');
      inner.setAttribute('fill', '#fff');
      inner.setAttribute('opacity', '.92');
      const tail = document.createElementNS(ns, 'path');
      tail.setAttribute('d', 'M-5,8 L0,16 L5,8 Z');
      tail.setAttribute('fill', '#E86A33');
      bubble.append(circle, inner, tail);
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('class', 'r-label');
      label.setAttribute('y', '30');
      label.textContent = shortRegionName(region.name);
      group.append(bubble, label);
      group.addEventListener('click', () => openDetail(region.id));
      fragment.appendChild(group);
    });
    layer.appendChild(fragment);
    renderTransitMarkers();
  }

  function visibleMapRegions() {
    // 地图默认显示全部区域；搜索/城市筛选只影响列表，不让地图意外消失。
    return state.data?.regions || [];
  }

  function renderTransitMarkers() {
    if (!state.mapLoaded || state.mapMode !== 'illustration') return;
    const layer = $('#transitLayer', $('#mapSvg'));
    if (!layer) return;
    layer.replaceChildren();
    if (!state.showTransit || !state.transit?.length) return;
    const ns = 'http://www.w3.org/2000/svg';
    const fragment = document.createDocumentFragment();
    state.transit.forEach(station => {
      const { x, y } = project(station.lat, station.lng);
      const group = document.createElementNS(ns, 'g');
      group.setAttribute('class', 't-marker');
      group.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', '-4');
      rect.setAttribute('y', '-4');
      rect.setAttribute('width', '8');
      rect.setAttribute('height', '8');
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', TRANSIT_TYPES[station.type]?.color || '#888888');
      rect.setAttribute('stroke', '#ffffff');
      rect.setAttribute('stroke-width', '1.5');
      const label = document.createElementNS(ns, 'text');
      label.setAttribute('class', 't-label');
      label.setAttribute('y', '-8');
      label.textContent = station.name;
      group.append(rect, label);
      fragment.appendChild(group);
    });
    layer.appendChild(fragment);
  }

  function renderCityChips() {
    const host = $('#cityChips');
    if (!host || !state.data) return;
    const counts = Object.fromEntries(CITIES.slice(1).map(city => [city, state.data.regions.filter(r => r.city === city).length]));
    host.innerHTML = CITIES.map(city => {
      const count = city === '全部' ? state.data.regions.length : counts[city];
      return `<button class="chip ${state.city === city ? 'active' : ''}" data-city="${esc(city)}" type="button">${esc(city)} <small>${count}</small></button>`;
    }).join('');
    $$('.chip', host).forEach(el => el.addEventListener('click', () => {
      state.city = el.dataset.city;
      renderCityChips();
      renderList();
    }));
  }

  function renderStatusChips() {
    const host = $('#statusChips');
    if (!host || !state.data) return;
    const counts = Object.fromEntries(STATUS_FILTERS.map(item => [item.id, item.id === 'all'
      ? state.data.regions.length
      : state.data.regions.filter(r => r.status === item.id).length]));
    host.innerHTML = STATUS_FILTERS.map(item => `<button class="chip ${state.status === item.id ? 'active' : ''}" data-status="${item.id}" type="button">${item.label} <small>${counts[item.id]}</small></button>`).join('');
    $$('.chip', host).forEach(el => el.addEventListener('click', () => {
      state.status = el.dataset.status;
      renderStatusChips();
      renderList();
    }));
  }

  function renderAuthChips() {
    const host = $('#authChips');
    if (!host || !state.data) return;
    const counts = Object.fromEntries(AUTH_FILTERS.map(item => [item.id, item.id === 'all'
      ? state.data.regions.length
      : state.data.regions.filter(r => r.springAuthenticity === item.id).length]));
    host.innerHTML = AUTH_FILTERS.map(item => `<button class="chip ${state.auth === item.id ? 'active' : ''}" data-auth="${item.id}" type="button">${item.label} <small>${counts[item.id]}</small></button>`).join('');
    $$('.chip', host).forEach(el => el.addEventListener('click', () => {
      state.auth = el.dataset.auth;
      renderAuthChips();
      renderList();
    }));
  }

  function renderSortButtons() {
    $$('.sort-btn').forEach(el => el.classList.toggle('active', el.dataset.sort === state.sort));
  }

  function renderList() {
    if (!state.data) return;
    renderCityChips();
    renderStatusChips();
    renderAuthChips();
    renderSortButtons();
    const host = $('#regionList');
    const list = visibleRegions();
    if (!list.length) {
      host.innerHTML = '<div class="empty"><div class="big">🫧</div>没有找到匹配的温泉区域<br><small>可以换个关键词或城市试试</small></div>';
      return;
    }
    host.innerHTML = list.map(regionCard).join('');
  }

  function regionCard(r) {
    const cert = (r.hotels || []).some(h => h.cert && h.cert.includes('真温泉'));
    const dist = state.distances.get(r.id);
    const distance = typeof dist === 'number' ? ` · ${formatDistance(dist)}` : '';
    const tags = (r.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const statusClass = r.status === 'operating' ? '' : r.status === 'closed_or_recruiting' ? 'closed' : r.status === 'resource_only' ? 'resource' : 'pending';
    const status = r.status && r.status !== 'operating' ? `<span class="tag ${statusClass}">${esc(STATUS_LABELS[r.status] || r.status)}</span>` : '';
    const authTag = r.springAuthenticity && r.springAuthenticity !== 'true'
      ? `<span class="tag auth-${r.springAuthenticity}">${esc(AUTH_LABELS[r.springAuthenticity] || '待核实')}</span>` : '';
    return `<article class="r-card" data-region-id="${esc(r.id)}" tabindex="0" aria-label="打开${esc(r.name)}">
      <div class="top"><div class="ico-box">♨️</div><div class="info">
        <div class="name">${esc(r.name)} ${cert ? '<span class="hot">真温泉</span>' : ''}</div>
        <div class="meta">${esc(r.city)} · ${esc(r.district)}${distance} · ${esc(hotelCountText(r))}酒店/民宿</div>
        <div class="tags">${tags}${status}${authTag}<span class="tag">${esc(numberText(r.temp, '℃'))}</span></div>
      </div><button class="fav" data-fav-id="${esc(r.id)}" type="button" aria-label="收藏">${state.favorites.has(r.id) ? '⭐' : '☆'}</button></div>
    </article>`;
  }

  function renderFavorites() {
    const host = $('#favList');
    if (!host || !state.data) return;
    $$('#favSeg [data-favtab]').forEach(el => el.classList.toggle('active', el.dataset.favtab === state.favoriteTab));
    const ids = state.favoriteTab === 'fav' ? state.favorites : state.visited;
    const list = state.data.regions.filter(r => ids.has(r.id));
    if (!list.length) {
      host.innerHTML = `<div class="empty"><div class="big">${state.favoriteTab === 'fav' ? '⭐' : '🧳'}</div>${state.favoriteTab === 'fav' ? '还没有收藏区域' : '还没有去过的温泉'}<br><small>打开区域详情就可以记录</small></div>`;
      return;
    }
    host.innerHTML = list.map(regionCard).join('');
  }

  function renderGuide() {
    const host = $('#guideBox');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    const tips = [
      ['🧼', '先洗澡，再泡汤', '先沐浴洁身，让身体适应水温，也能保持温泉水卫生。'],
      ['⏱️', '从温到热，分段泡', '每次浸泡约15分钟；高温池建议不超过10分钟，中间上岸休息、补水。'],
      ['🚫', '这些时候不要泡', '避免空腹、饭后立即、酒后泡汤；饭后至少间隔1小时。心脏病、高血压、孕期等情况先咨询医生。'],
      ['💍', '摘掉金属饰品', '硫化物等成分可能让银饰、金属饰品变色，入池前先取下。'],
      ['👶', '儿童要控制时长', '不建议带0—3岁婴幼儿泡温泉；3岁以上儿童每次不宜超过15分钟，并由成人陪同。'],
      ['🚗', '泡完不要马上开车', '泡汤后身体放松、注意力可能下降，建议休息充分后再驾驶。'],
      ['💧', '泡后及时补水', '若出现头晕、胸闷、心慌、恶心等不适，立即上岸、补水并寻求帮助。']
    ];
    host.innerHTML = `<h2>♨️ 泡汤前后</h2>${tips.map(([ico, title, text]) => `<div class="g-card"><div class="g-ico">${ico}</div><div><div class="g-title">${title}</div><div class="g-text">${text}</div></div></div>`).join('')}
      <h2>📌 数据说明</h2><div class="tip-note">本项目优先收录“温泉区域/温泉小镇”，再挂区域内的酒店和民宿。价格、开放状态会变化，出发前请向门店确认；泉质认证和地热信息均应以公开来源及最新检测为准。</div>`;
  }

  function openDetail(id) {
    const r = regionById(id);
    if (!r) return;
    const body = $('#sheetBody');
    const springTypes = (r.springType || []).map(t => `<span class="s-badge">${esc(t)}</span>`).join('');
    const certs = [...new Set((r.hotels || []).map(h => h.cert).filter(Boolean))];
    const certHtml = certs.map(c => `<span class="s-badge cert">${esc(c)}</span>`).join('');
    const statusClass = r.status === 'operating' ? '' : r.status === 'closed_or_recruiting' ? 'closed' : r.status === 'resource_only' ? 'resource' : 'pending';
    const statusHtml = `<span class="s-badge ${statusClass}">${esc(STATUS_LABELS[r.status] || '状态待补')}</span>`;
    const authBadge = r.springAuthenticity && r.springAuthenticity !== 'true'
      ? `<span class="s-badge auth-${r.springAuthenticity}">泉水·${esc(AUTH_LABELS[r.springAuthenticity] || '待核实')}</span>` : '';
    const sourceLink = /^https?:\/\//.test(r.sourceUrl || '') ? `<a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看来源</a>` : '';
    const hotels = r.hotels?.length ? r.hotels.map(h => `<div class="s-hotel">
      <div class="h-name">${esc(h.name)} <span class="h-cert ${h.cert ? '' : 'none'}">${esc(h.cert || '认证待补')}</span>${h.authenticity === 'false' ? '<span class="h-cert fake">疑似假温泉</span>' : h.authenticity === 'unknown' ? '<span class="h-cert pending">泉水待核实</span>' : ''}</div>
      <div class="h-price">参考门票：${esc(h.price || '待补充')} 元</div>
      <div class="h-desc">${esc(h.desc || '')}</div>
    </div>`).join('') : '<div class="s-intro">该区域已知有温泉经营点，酒店清单待社区补充。</div>';
    body.dataset.regionId = r.id;
    const nav = navLink(r);
    const navHtml = nav ? `<div class="s-nav"><a href="${esc(nav)}" target="_blank" rel="noopener noreferrer">📍 高德地图导航 · ${esc(r.poi?.name || r.name)}</a></div>` : '';
    body.innerHTML = `<div class="s-head"><div class="s-ico">♨️</div><div><div class="s-title">${esc(r.name)}</div><div class="s-sub">${esc(r.city)} · ${esc(r.district)} · ${esc(hotelCountText(r))}酒店/民宿</div></div></div>
      <div class="s-badges"><span class="s-badge temp">泉口约 ${esc(numberText(r.temp, '℃'))}</span>${statusHtml}${authBadge}${springTypes}${certHtml}</div>
      <div class="s-intro">${esc(r.intro)}</div>
      ${r.notes ? `<div class="s-note">${esc(r.notes)}</div>` : ''}
      <div class="s-hotels"><h3>🏨 区域内温泉酒店 / 民宿</h3>${hotels}</div>
      <div class="s-actions"><button class="btn-fav ${state.favorites.has(r.id) ? 'on' : ''}" data-action="favorite">${state.favorites.has(r.id) ? '⭐ 已收藏' : '☆ 收藏区域'}</button><button class="btn-go ${state.visited.has(r.id) ? 'on' : ''}" data-action="visited">${state.visited.has(r.id) ? '✅ 去过了' : '○ 标记去过'}</button></div>
      ${navHtml}
      <div class="s-src">来源：${esc(r.source || '待补充')} · ${esc(r.checkedAt || '核实日期待补')} · 坐标为区域级近似值<br>${sourceLink} · 数据仅供参考，出发前请向门店确认</div>`;
    $('#sheetMask').classList.add('show');
    $('#detailSheet').classList.add('show');
  }

  function closeDetail() {
    $('#sheetMask').classList.remove('show');
    $('#detailSheet').classList.remove('show');
  }

  function navLink(r) {
    const poi = r?.poi;
    if (!poi) return null;
    const name = encodeURIComponent(poi.name);
    if (poi.approx === false) {
      return `https://uri.amap.com/marker?position=${poi.lng},${poi.lat}&name=${name}&coordinate=gaode&callnative=1`;
    }
    const city = encodeURIComponent(r.city);
    return `https://uri.amap.com/search?keyword=${name}&city=${city}&coordinate=gaode&callnative=1`;
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    saveSet(STORAGE.favorites, state.favorites);
    showToast(state.favorites.has(id) ? '已收藏这个温泉区域' : '已取消收藏');
    const body = $('#sheetBody');
    if ($('#detailSheet').classList.contains('show') && body.dataset.regionId === id) openDetail(id);
  }

  function toggleVisited(id) {
    if (state.visited.has(id)) state.visited.delete(id);
    else state.visited.add(id);
    saveSet(STORAGE.visited, state.visited);
    showToast(state.visited.has(id) ? '已记录去过' : '已取消记录');
    const body = $('#sheetBody');
    if ($('#detailSheet').classList.contains('show') && body.dataset.regionId === id) openDetail(id);
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      showToast('当前浏览器不支持定位');
      return;
    }
    showToast('正在获取位置…');
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      state.userLocation = { lat: latitude, lng: longitude };
      state.distances = new Map(state.data.regions.map(r => [r.id, haversine(latitude, longitude, r.lat, r.lng)]));
      state.sort = 'distance';
      setTab('list');
      showToast('已按距离排序');
    }, error => {
      const message = error.code === 1 ? '请允许定位权限后重试' : '定位失败，请检查网络或系统定位';
      showToast(message);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  }

  function updateSearch(value) {
    state.search = value;
    $('#clearSearch').classList.toggle('show', Boolean(value));
    renderList();
  }

  function setupEvents() {
    $$('.tab').forEach(el => el.addEventListener('click', () => setTab(el.dataset.tab)));
    $('#sheetMask').addEventListener('click', closeDetail);
    $('#sheetClose').addEventListener('click', closeDetail);
    $('#btnLocate').addEventListener('click', requestLocation);
    $('#btnLocateList').addEventListener('click', requestLocation);
    $('#favSeg').addEventListener('click', event => {
      const tab = event.target.closest('[data-favtab]');
      if (!tab) return;
      state.favoriteTab = tab.dataset.favtab;
      renderFavorites();
    });
    $('#regionList').addEventListener('click', event => {
      const card = event.target.closest('[data-region-id]');
      if (card && !event.target.closest('[data-fav-id]')) openDetail(card.dataset.regionId);
      const fav = event.target.closest('[data-fav-id]');
      if (fav) {
        toggleFavorite(fav.dataset.favId);
        renderList();
        renderFavorites();
      }
    });
    $('#favList').addEventListener('click', event => {
      const card = event.target.closest('[data-region-id]');
      if (card && !event.target.closest('[data-fav-id]')) openDetail(card.dataset.regionId);
      const fav = event.target.closest('[data-fav-id]');
      if (fav) {
        toggleFavorite(fav.dataset.favId);
        renderFavorites();
      }
    });
    ['#regionList', '#favList'].forEach(selector => $(selector).addEventListener('keydown', event => {
      const card = event.target.closest('[data-region-id]');
      if (!card || event.target.closest('[data-fav-id]')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetail(card.dataset.regionId);
      }
    }));
    $('#sheetBody').addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      const id = $('#sheetBody').dataset.regionId;
      if (!action || !id) return;
      if (action === 'favorite') toggleFavorite(id);
      if (action === 'visited') toggleVisited(id);
    });
    $$('.sort-btn').forEach(el => el.addEventListener('click', () => {
      if (el.dataset.sort === 'distance' && !state.userLocation) {
        requestLocation();
        return;
      }
      state.sort = el.dataset.sort;
      renderList();
    }));
    $('#searchInput').addEventListener('input', event => updateSearch(event.target.value));
    $('#clearSearch').addEventListener('click', () => {
      $('#searchInput').value = '';
      updateSearch('');
      $('#searchInput').focus();
    });
    $('#btnMapMode').addEventListener('click', toggleMapMode);
    $('#btnTransit').addEventListener('click', toggleTransit);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeDetail();
    });
  }

  function toggleTransit() {
    state.showTransit = !state.showTransit;
    const btn = $('#btnTransit');
    if (btn) btn.textContent = state.showTransit ? '🚉 交通站' : '🚉 交通站·关';
    renderTransitMarkers();
    renderLeafletTransit();
  }

  async function toggleMapMode() {
    if (state.mapMode === 'illustration') {
      const leafletBox = $('#leafletBox');
      const mapSvg = $('#mapSvg');
      leafletBox.classList.add('show');
      mapSvg.style.display = 'none';
      try {
        await showLeafletMap();
        state.mapMode = 'online';
        $('#btnMapMode').textContent = '🎨 插画地图';
      } catch (error) {
        leafletBox.classList.remove('show');
        mapSvg.style.display = '';
        console.error(error);
        showToast('在线地图加载失败，继续使用插画地图');
      }
    } else {
      state.mapMode = 'illustration';
      $('#leafletBox').classList.remove('show');
      $('#mapSvg').style.display = '';
      $('#btnMapMode').textContent = '🗺️ 在线地图';
      renderMapMarkers();
    }
  }

  const assetPromises = new Map();
  function loadAsset(url, type, id) {
    if (assetPromises.has(id)) return assetPromises.get(id);
    const promise = new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (type === 'script' && window.L) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const el = document.createElement(type);
      el.id = id;
      if (type === 'link') {
        el.rel = 'stylesheet'; el.href = url;
      } else {
        el.src = url; el.async = true;
      }
      el.onload = resolve;
      el.onerror = () => reject(new Error(`资源加载失败: ${url}`));
      document.head.appendChild(el);
    });
    assetPromises.set(id, promise);
    promise.catch(() => assetPromises.delete(id));
    return promise;
  }

  async function showLeafletMap() {
    await loadAsset(LEAFLET_CSS, 'link', 'leaflet-css');
    await loadAsset(LEAFLET_JS, 'script', 'leaflet-js');
    if (!window.L) throw new Error('Leaflet 未加载');
    if (!state.leaflet) {
      state.leaflet = L.map('leafletBox', { zoomControl: false }).setView([23.2, 113.5], 8);
      L.control.zoom({ position: 'bottomright' }).addTo(state.leaflet);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(state.leaflet);
      state.data.regions.forEach(region => {
        const marker = L.marker([region.lat, region.lng]).addTo(state.leaflet);
        marker.bindPopup(`<strong>${esc(region.name)}</strong><br>${esc(region.city)} · ${esc(hotelCountText(region))}酒店/民宿`);
        marker.on('click', () => openDetail(region.id));
        state.leafletMarkers.push(marker);
      });
      setTimeout(() => state.leaflet.invalidateSize(), 100);
    } else {
      setTimeout(() => state.leaflet.invalidateSize(), 100);
    }
    renderLeafletTransit();
  }

  async function loadTransit() {
    try {
      const response = await fetch(TRANSIT_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`交通数据加载失败 ${response.status}`);
      const data = await response.json();
      state.transit = Array.isArray(data.stations) ? data.stations : [];
      renderTransitMarkers();
      renderLeafletTransit();
    } catch (error) {
      console.warn('公共交通站数据加载失败（可忽略）', error);
    }
  }

  function renderLeafletTransit() {
    if (!state.leaflet || !state.transit) return;
    if (state.leafletTransit) {
      state.leaflet.removeLayer(state.leafletTransit);
      state.leafletTransit = null;
    }
    if (!state.showTransit) return;
    state.leafletTransit = L.layerGroup();
    state.transit.forEach(station => {
      const circle = L.circleMarker([station.lat, station.lng], {
        radius: 5, color: '#ffffff', weight: 1.5,
        fillColor: TRANSIT_TYPES[station.type]?.color || '#888888', fillOpacity: 1
      });
      circle.bindPopup(`<strong>${esc(station.name)}</strong><br><small>${esc(TRANSIT_TYPES[station.type]?.label || '')} · ${esc(station.line || '')}</small>`);
      state.leafletTransit.addLayer(circle);
    });
    state.leafletTransit.addTo(state.leaflet);
  }

  async function loadData() {
    try {
      const response = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`数据加载失败 ${response.status}`);
      state.data = await response.json();
      if (!state.data || !Array.isArray(state.data.regions)) throw new Error('数据格式不正确');
      // 清理已经不在数据集里的旧收藏，避免收藏页出现脏数据。
      const validIds = new Set(state.data.regions.map(r => r.id));
      state.favorites = new Set([...state.favorites].filter(id => validIds.has(id)));
      state.visited = new Set([...state.visited].filter(id => validIds.has(id)));
      saveSet(STORAGE.favorites, state.favorites);
      saveSet(STORAGE.visited, state.visited);
      $('#navCount').textContent = `${state.data.regions.length}区`;
      renderCityChips();
      renderStatusChips();
      renderList();
      renderFavorites();
      renderGuide();
      loadTransit();
      await loadIllustrationMap();
    } catch (error) {
      console.error(error);
      $('#regionList').innerHTML = '<div class="empty"><div class="big">⚠️</div>数据加载失败<br><small>请用 start-server.sh 启动后访问 app/index.html</small></div>';
      showToast('数据加载失败');
    }
  }

  // 让页面在 GitHub Pages / 本地静态服务器上可直接使用。
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register('../sw.js').catch(error => console.warn('Service Worker 注册失败', error));
  }

  setupEvents();
  loadData();
  registerServiceWorker();
})();
