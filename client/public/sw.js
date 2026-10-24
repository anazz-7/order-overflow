/**
 * OrderFlow Pro — Progressive Web App Service Worker
 * Version: 1.0.0
 */

const CACHE_NAME = 'orderflow-pro-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png'
];

// Install: Precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[PWA SW] Precache partial error (ignored):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[PWA SW] Purging obsolete cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Skip non-GET requests (POST, PUT, DELETE, etc.)
  if (req.method !== 'GET') {
    return;
  }

  // 2. Navigation requests (HTML SPA pages): Network first, falling back to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cachedApp = await caches.match('/index.html') || await caches.match('/');
          if (cachedApp) return cachedApp;
          return new Response(
            '<!doctype html><html><body style="font-family:sans-serif;padding:40px;background:#090d16;color:#fff;text-align:center;"><h2>OrderFlow Pro — Offline</h2><p>You appear to be offline. Please reconnect to access live data.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // 3. API requests (Supabase or local /api/): Network first with clean error handling
  if (url.pathname.startsWith('/api') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(req).catch(async () => {
        // Check if there is an existing cached response for this exact read
        const cachedRes = await caches.match(req);
        if (cachedRes) return cachedRes;
        return new Response(
          JSON.stringify({ success: false, offline: true, error: 'Network unavailable. Offline mode.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 4. Static assets (JS, CSS, images, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => null);

      return cachedRes || fetchPromise;
    })
  );
});

// Allow client app to trigger instant update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
