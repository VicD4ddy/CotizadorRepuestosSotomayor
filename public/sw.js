const CACHE_NAME = 'sotomayor-offline-v1';
const PRECACHE_URLS = ['/offline.html', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode !== 'navigate') return;

  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedOffline = await caches.match('/offline.html');
      return cachedOffline || Response.error();
    })
  );
});
