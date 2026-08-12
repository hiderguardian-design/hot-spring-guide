const VERSION = 'bay-hot-springs-v0.2.0';
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;
const SCOPE_URL = new URL(self.registration.scope);
const asset = path => new URL(path.replace(/^\//, ''), SCOPE_URL).toString();
const STATIC_ASSETS = [
  asset(''),
  asset('index.html'),
  asset('app/index.html'),
  asset('app/app.js'),
  asset('app/map/gd-map.svg'),
  asset('app/icon.svg'),
  asset('manifest.webmanifest'),
  asset('data/regions-gd.json'),
  asset('data/transit-gd.json')
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => ![STATIC_CACHE, DATA_CACHE].includes(key)).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (_) {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/regions-gd.json')) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) caches.open(STATIC_CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }))
  );
});
