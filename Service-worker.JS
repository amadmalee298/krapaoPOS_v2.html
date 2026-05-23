// ============================================================
//  กะเพรา POS — Service Worker
//  Cache-first strategy + offline fallback
// ============================================================

const CACHE_NAME   = 'krapaoPOS-v3';
const CACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ── Install: pre-cache all assets ──
self.addEventListener('install', event => {
  console.log('[SW] Installing cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache addAll failed:', err))
  );
});

// ── Activate: delete old caches ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating, clearing old caches');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-first, fallback to network ──
self.addEventListener('fetch', event => {
  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) {
          // Serve from cache, update in background (stale-while-revalidate)
          const fetchUpdate = fetch(event.request)
            .then(response => {
              if (response && response.status === 200 && response.type !== 'opaque') {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, response.clone()));
              }
              return response;
            })
            .catch(() => {/* offline — already serving from cache */});
          return cached;
        }

        // Not in cache — fetch from network and cache it
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'opaque') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));
            return response;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// ── Push: handle background sync (optional future feature) ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
