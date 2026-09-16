/* Jela HRD service worker — offline support for the PWA.
 * Install = offline shell only (offline page + icons); '/' is NOT
 * precached (it requires DB and cache.addAll would fail atomically).
 * Navigations: network-first, cache fallback, then offline page.
 * Static (css/js/icons): stale-while-revalidate.
 * Admin, healthz, non-GET are never cached.
 *
 * ES5 ONLY (var/function/Promise) — old Android Chrome must parse.
 */
var CACHE = 'jela-hrd-v5';
var OFFLINE_URL = '/offline.html';
var PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Precaching must NOT fail the install — cache each separately.
      return Promise.all(PRECACHE.map(function (url) {
        return fetch(url, { cache: 'reload' }).then(function (res) {
          if (res && res.ok) return cache.put(url, res);
        }).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      var old = keys.filter(function (k) { return k !== CACHE; });
      return Promise.all(old.map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isStaticAsset(path) {
  return (
    path.indexOf('/css/') === 0 ||
    path.indexOf('/js/') === 0 ||
    path.indexOf('/icons/') === 0
  );
}

function cacheable(req, url) {
  if (req.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.indexOf('/admin') === 0) return false;
  if (url.pathname === '/healthz') return false;
  return true;
}

function isNavigation(req) {
  if (req.mode === 'navigate') return true;
  if (req.method !== 'GET') return false;
  try {
    var accept = req.headers.get('Accept') || '';
    return accept.indexOf('text/html') !== -1;
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);
  if (!cacheable(req, url)) return;

  if (isNavigation(req)) {
    event.respondWith(
      fetch(req).then(function (res) {
        // Cache only 200 HTML; if server sent 500/404, show cached/offline instead.
        var ct = res && res.headers && res.headers.get('content-type');
        if (res && res.ok && ct && ct.indexOf('text/html') !== -1) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          return res;
        }
        if (res && !res.ok) {
          return caches.match(req).then(function (hit) {
            return hit || caches.match(OFFLINE_URL);
          });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          return caches.match('/').then(function (home) {
            return home || caches.match(OFFLINE_URL);
          });
        });
      })
    );
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      })
    );
  }
});

// Messages from page: SKIP_WAITING + full offline pack JELA_PREFETCH.
self.addEventListener('message', function (event) {
  var msg = event.data;
  if (!msg || !msg.type) return;
  if (msg.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (msg.type !== 'JELA_PREFETCH' || !Array.isArray(msg.urls)) return;
  event.waitUntil(prefetchAll(msg.urls));
});

function prefetchAll(urls) {
  return caches.open(CACHE).then(function (cache) {
    var done = 0;
    var failed = 0;
    var total = urls.length;

    function report(type) {
      return self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          list[i].postMessage({ type: type, done: done, total: total, failed: failed });
        }
      });
    }

    function fetchOne(u) {
      var req = u;
      try {
        req = new Request(u, { credentials: 'same-origin' });
      } catch (e) {
        req = u;
      }
      return cache.match(req).then(function (hit) {
        if (hit) return true;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            return cache.put(req, res).then(function () { return true; });
          }
          return false;
        });
      }).then(function (ok) {
        if (!ok) failed += 1;
        done += 1;
      }, function () {
        failed += 1;
        done += 1;
      });
    }

    var i = 0;
    function nextBatch() {
      if (i >= urls.length) return report('JELA_DONE');
      var batch = urls.slice(i, i + 6);
      i += 6;
      return Promise.all(batch.map(fetchOne)).then(function () {
        return report('JELA_PROGRESS');
      }).then(nextBatch);
    }
    return nextBatch();
  });
}
