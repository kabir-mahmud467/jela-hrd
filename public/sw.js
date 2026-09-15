/* Jela HRD service worker — offline support for the PWA.
 * Install = basic shell only (home + offline page + icons); full content
 * comes later via the in-app download card (JELA_PREFETCH).
 * Navigations: network-first, then cache, then offline page.
 * Static (css/js/icons): stale-while-revalidate.
 * Admin pages, healthz and non-GET requests are never cached.
 *
 * ES5 ONLY (var/function/Promise chains) — very old Android Chrome must
 * parse this, otherwise install fails on those devices.
 */
var CACHE = 'jela-hrd-v4';
var OFFLINE_URL = '/offline.html';
var PRECACHE = ['/', OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
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

// Old browsers lack request.mode — fall back to the Accept header.
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

  // Page navigations: try network, fall back to cache, then offline page
  if (isNavigation(req)) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match(OFFLINE_URL);
        });
      })
    );
    return;
  }

  // Versioned static assets (?v= changes on deploy): serve cache, refresh behind
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
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
// posted back so the download card can show done/total.
self.addEventListener('message', function (event) {
  var msg = event.data;
  if (!msg || msg.type !== 'JELA_PREFETCH' || !Array.isArray(msg.urls)) return;
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
        req = u; // very old Chrome: plain URL works with cache.match/put/fetch
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
