const CACHE_NAME = 'iptv-premium-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/ui.js',
  './js/m3u-parser.js',
  './js/epg-parser.js',
  './js/player.js',
  './js/tv-navigation.js',
  './js/tmdb-api.js',
  './js/profiles.js',
  './js/license-manager.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Icons+Outlined',
  'https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.7.11/shaka-player.compiled.js'
];

// Install Event: Cache App Shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Stale-while-revalidate for assets, Network-first for API
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip video streams, M3U lists, and EPG from Service Worker cache
  // We manage them via IndexedDB (for lists) or let browser handle media
  if (
    url.pathname.endsWith('.m3u') || 
    url.pathname.endsWith('.m3u8') || 
    url.pathname.endsWith('.ts') ||
    url.pathname.includes('/api/proxy')
  ) {
    return;
  }

  // Stale-while-revalidate for static assets
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Update cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(err => {
        // Offline fallback
      });

      return cachedResponse || fetchPromise;
    })
  );
});
