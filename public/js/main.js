document.documentElement.classList.add('js');

// PWA: service worker (offline + installable). /sw.js scope = whole site.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// PWA full-offline pack: "অফলাইন ডাউনলোড" বাটন — /offline-manifest.json থেকে
// সব public পেজের URL এনে service worker দিয়ে cache-এ ভরে। নেট থাকলে
// অসমাপ্ত ডাউনলোড resume হয় ও নতুন কনটেন্ট এলে (দিনে একবার চেক) আপডেট হয়।
(function () {
  const btn = document.getElementById('offlineBtn');
  if (!btn) return;
  if (!('serviceWorker' in navigator)) {
    btn.hidden = true;
    return;
  }
  const label = btn.querySelector('[data-label]');
  const setLabel = (t) => {
    if (label) label.textContent = t;
  };
  const LS = 'jelaOffline';
  const CHECK_KEY = 'jelaOfflineCheck';
  const DAY = 86400000;
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(LS) || '{}');
    } catch {
      return {};
    }
  };
  const write = (o) => {
    try {
      localStorage.setItem(LS, JSON.stringify(o));
    } catch {
      // ignore
    }
  };
  let busy = false;

  function download(manifest) {
    if (busy) return;
    busy = true;
    btn.classList.add('busy');
    btn.classList.remove('done');
    btn.classList.remove('update');
    write({ started: true, done: false, at: Date.now() });
    setLabel('ডাউনলোড হচ্ছে… 0/' + manifest.urls.length);
    navigator.serviceWorker.ready.then((reg) => {
      const sw = reg.active;
      if (!sw) {
        busy = false;
        btn.classList.remove('busy');
        return;
      }
      const onMsg = (e) => {
        const d = (e && e.data) || {};
        if (d.type === 'JELA_PROGRESS') {
          setLabel('ডাউনলোড হচ্ছে… ' + d.done + '/' + d.total);
        } else if (d.type === 'JELA_DONE') {
          navigator.serviceWorker.removeEventListener('message', onMsg);
          busy = false;
          btn.classList.remove('busy');
          if (d.failed === 0) {
            write({ started: true, done: true, version: manifest.version, total: d.total, at: Date.now() });
            btn.classList.add('done');
            setLabel('অফলাইন রেডি');
          } else {
            // কিছু বাকি থাকলে started-ই থাকে — নেট ফিরলে resume হবে
            setLabel('অফলাইন ডাউনলোড');
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', onMsg);
      sw.postMessage({ type: 'JELA_PREFETCH', urls: manifest.urls });
    }).catch(() => {
      busy = false;
      btn.classList.remove('busy');
    });
  }

  async function fetchManifest() {
    const res = await fetch('/offline-manifest.json', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('manifest ' + res.status);
    return res.json();
  }

  // auto=true: শুধু resume / নতুন-কনটেন্ট আপডেট; auto=false (ক্লিক): সবসময় চেষ্টা
  async function checkAndDownload(auto) {
    if (busy || !navigator.onLine) return;
    let manifest;
    try {
      manifest = await fetchManifest();
    } catch {
      return;
    }
    if (!manifest || !Array.isArray(manifest.urls)) return;
    const st = read();
    if (st.done && st.version === manifest.version) {
      btn.classList.add('done');
      setLabel('অফলাইন রেডি');
      return;
    }
    // নতুন কনটেন্ট এসেছে: আসল অ্যাপের মতো "আপডেট" দেখাও, চাপ দিলে ডাউনলোড হবে
    if (st.done && st.version !== manifest.version) {
      if (auto) {
        write({ ...st, updateAvailable: true });
        btn.classList.remove('done');
        btn.classList.add('update');
        setLabel('অ্যাপ আপডেট');
        return;
      }
      download(manifest);
      return;
    }
    if (auto && !(st.started && !st.done)) return;
    download(manifest);
  }

  btn.addEventListener('click', () => checkAndDownload(false));
  window.addEventListener('online', () => checkAndDownload(true));

  const st = read();
  if (st.done && st.updateAvailable) {
    btn.classList.add('update');
    setLabel('অ্যাপ আপডেট');
  } else if (st.done) {
    btn.classList.add('done');
    setLabel('অফলাইন রেডি');
  }
  let lastCheck = 0;
  try {
    lastCheck = +(localStorage.getItem(CHECK_KEY) || 0);
  } catch {
    // ignore
  }
  if (Date.now() - lastCheck > DAY) {
    try {
      localStorage.setItem(CHECK_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    if (navigator.onLine) checkAndDownload(true);
  } else if (st.started && !st.done && navigator.onLine) {
    checkAndDownload(true);
  }
})();

// PWA install button: beforeinstallprompt পেলে "অ্যাপ ইনস্টল" বাটন দেখাও।
// ইনস্টল করা ডিভাইসে (standalone) বাটন কখনো দেখায় না। iOS-এ prompt নেই,
// তাই সেখানে বাটন /install নির্দেশনায় নিয়ে যায়।
(function () {
  const btn = document.getElementById('installBtn');
  const pageBtn = document.getElementById('installPageBtn');
  if (!btn && !pageBtn) return;
  const doneNote = document.getElementById('installDone');
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  let deferred = null;

  const hideAll = () => {
    if (btn) btn.hidden = true;
    if (pageBtn) pageBtn.hidden = true;
    if (doneNote) doneNote.hidden = false;
  };
  if (isStandalone()) {
    hideAll();
    return;
  }
  // iOS: manual নির্দেশনা পেজেই মূল ভরসা — nav বাটন দেখাও
  if (isIOS && btn) btn.hidden = false;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    if (btn) btn.hidden = false;
    if (pageBtn) pageBtn.hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    hideAll();
  });

  async function doInstall() {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        // ignore
      }
      deferred = null;
      return;
    }
    if (!isStandalone() && window.location.pathname !== '/install') {
      window.location.href = '/install';
    }
  }
  if (btn) btn.addEventListener('click', doInstall);
  if (pageBtn) pageBtn.addEventListener('click', doInstall);
})();

// CSP-friendly accordion: data-toggle-target ব্যবহার করে, smooth animation CSS-এ
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-toggle-target]');
  if (!btn) return;
  const el = document.getElementById(btn.getAttribute('data-toggle-target'));
  if (!el) return;
  el.classList.toggle('hidden');
  const open = !el.classList.contains('hidden');
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
});

// CSP-friendly confirm for delete/unban forms (inline onsubmit সরানো হয়েছে)
document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-confirm]');
  if (!form) return;
  if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
});

// Backward-compat (পুরনো onclick থাকলে)
function toggleAnswer(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden');
  const btn = el.previousElementSibling;
  if (btn) btn.classList.toggle('open', !el.classList.contains('hidden'));
}

// Navbar shadow + active link + back-to-top + mobile menu (CSP-safe, no inline handlers)
(function () {
  const nav = document.getElementById('navbar');
  const toTop = document.getElementById('toTop');
  const navToggle = document.getElementById('navToggle');
  const mainnav = document.getElementById('mainnav');
  const path = window.location.pathname;
  document.querySelectorAll('#mainnav a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === '/admin') return;
    if ((href === '/' && path === '/') || (href !== '/' && path.startsWith(href))) {
      a.classList.add('active');
    }
  });
  const onScroll = () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 8);
    if (toTop) toTop.classList.toggle('show', window.scrollY > 500);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  // Mobile menu toggle
  if (navToggle && mainnav) {
    navToggle.addEventListener('click', () => {
      const open = mainnav.classList.toggle('open');
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
    });
    mainnav.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        mainnav.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();

// Reveal on scroll
(function () {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    }),
    { threshold: 0.08 }
  );
  els.forEach((el) => io.observe(el));
})();
