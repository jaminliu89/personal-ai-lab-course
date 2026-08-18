// Personal AI Lab · Service Worker
// 策略：HTML network-first, 静态资源 stale-while-revalidate
const CACHE = 'pail-v2';

const STATIC_EXT = ['.css', '.js', '.png', '.jpg', '.svg', '.ico', '.woff', '.woff2', '.ttf'];

self.addEventListener('install', e => {
  self.skipWaiting();
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

  // 只处理同源 GET
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // API 请求：network-only
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  const isHTML = e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  const isStatic = STATIC_EXT.some(ext => url.pathname.endsWith(ext));

  if (isHTML) {
    // HTML: network-first，失败回退缓存
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // 成功了就更新缓存
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
    );
  } else if (isStatic) {
    // 静态资源: stale-while-revalidate
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  } else {
    // 其他：stale-while-revalidate
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
  }
});
