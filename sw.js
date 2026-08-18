// Personal AI Lab · Service Worker
const CACHE = 'pail-v1';
const ASSETS = [
  './',
  './index.html',
  './m00.html',
  './m01.html',
  './m02.html',
  './m03.html',
  './m04.html',
  './m05.html',
  './m06.html',
  './m07.html',
  './m08.html',
  './m09.html',
  './m10.html',
  './m11.html',
  './m12.html',
  './m13.html',
  './m14.html',
  './m15.html',
  './m16.html',
  './glossary.html',
  './30-day-lab.html',
  './assets/style.css',
  './assets/app.js',
  './assets/auth.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API 请求走网络
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 静态文件 cache-first
  if (e.request.method === 'GET' && (url.origin === location.origin)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          // 只缓存同源 GET
          if (res.ok && e.request.method === 'GET') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => {
          // 离线时导航请求回退到首页
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});
