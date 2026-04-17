// ─────────────────────────────────────────────────────────────────
//  CheezyHub Service Worker — Phase 12
//  Caching strategy:
//    - Menu API  → stale-while-revalidate (fresh but instant)
//    - JS/CSS    → cache-first (performance)
//    - Images    → cache-first with 7-day expiry
//    - HTML nav  → network-first with offline fallback
//    - /api/counter/sync → network-only (never cache mutations)
// ─────────────────────────────────────────────────────────────────

const CACHE_VERSION  = 'ch-v2';
const STATIC_CACHE   = `${CACHE_VERSION}-static`;
const MENU_CACHE     = `${CACHE_VERSION}-menu`;
const IMAGE_CACHE    = `${CACHE_VERSION}-images`;

const MENU_URL_PATTERN   = /\/api\/counter\/menu/;
const STATIC_EXTENSIONS  = /\.(js|css|woff2?|ttf|eot)$/;
const IMAGE_EXTENSIONS   = /\.(png|jpg|jpeg|webp|svg|gif|ico)$/;
const NEVER_CACHE        = /\/(api\/counter\/sync|api\/auth|api\/orders|counter\/shift)/;

// ─── Install: pre-cache offline fallback ─────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(['/offline.html']).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('ch-') && !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch handler ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept non-GET or mutations
  if (request.method !== 'GET') return;
  if (NEVER_CACHE.test(url.pathname)) return;
  if (!url.origin.startsWith(self.location.origin) && !url.hostname.includes('api')) return;

  // Menu → stale-while-revalidate
  if (MENU_URL_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, MENU_CACHE));
    return;
  }

  // Static assets → stale-while-revalidate
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // Images → cache-first (7 days)
  if (IMAGE_EXTENSIONS.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 7 * 24 * 3600));
    return;
  }

  // HTML navigations → network-first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }
});

// ─── Strategy implementations ─────────────────────────────────────

async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cached = await caches.match(request);
  if (cached) {
    if (maxAgeSeconds) {
      const date = cached.headers.get('sw-cached-at');
      if (date && (Date.now() - Number(date)) > maxAgeSeconds * 1000) {
        // Expired — fall through to network
      } else {
        return cached;
      }
    } else {
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone   = response.clone();
      const cache   = await caches.open(cacheName);
      const headers = new Headers(clone.headers);
      headers.set('sw-cached-at', String(Date.now()));
      const cachedResponse = new Response(await clone.blob(), { status: clone.status, headers });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    return cached ?? new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached ?? (await networkPromise) ?? new Response('{}', { status: 503 });
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match('/offline.html');
    return offline ?? new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
  }
}
