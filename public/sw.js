/* Jela HRD service worker — offline support for the PWA.
 * Navigations: network-first, then cache, then offline page.
 * Static (css/js/icons): stale-while-revalidate.
 * Admin pages, healthz and non-GET requests are never cached.
 */
const CACHE = 'jela-hrd-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(path) {
  return (
    path.startsWith('/css/') || path.startsWith('/js/') || path.startsWith('/icons/')
  );
}

function cacheable(req, url) {
  if (req.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/admin')) return false;
  if (url.pathname === '/healthz') return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (!cacheable(req, url)) return;

  // Page navigations: try network, fall back to cache, then offline page
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Versioned static assets (?v= changes on deploy): serve cache, refresh behind
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        });
        return hit || net;
      })
    );
  }
});

// Full offline pack: page sends { type:'JELA_PREFETCH', urls:[...] }.
// Missing URLs are fetched in small batches and cached; progress is
// posted back so the download button can show done/total.
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.type !== 'JELA_PREFETCH' || !Array.isArray(msg.urls)) return;
  event.waitUntil(prefetchAll(msg.urls));
});

async function prefetchAll(urls) {
  const cache = await caches.open(CACHE);
  let done = 0;
  let failed = 0;
  const total = urls.length;
  const report = async (type) => {
    const list = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    list.forEach((c) => c.postMessage({ type, done, total, failed }));
  };
  const BATCH = 6;
  for (let i = 0; i < urls.length; i += BATCH) {
    await Promise.all(
      urls.slice(i, i + BATCH).map(async (u) => {
        try {
          const req = new Request(u, { credentials: 'same-origin' });
          const hit = await cache.match(req);
          if (!hit) {
            const res = await fetch(req);
            if (res && res.ok) await cache.put(req, res);
            else failed += 1;
          }
        } catch {
          failed += 1;
        }
        done += 1;
      })
    );
    await report('JELA_PROGRESS');
  }
  await report('JELA_DONE');
}
