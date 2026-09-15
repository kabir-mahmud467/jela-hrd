document.documentElement.classList.add('js');

// PWA: service worker (offline + installable). /sw.js scope = whole site.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// PWA content download — শুধু ইনস্টল করা অ্যাপের ভেতরে (standalone) দেখায়।
// ইনস্টলে শুধু basic shell (home + css/js + icons) আসে; এই কার্ড থেকে
// "ডাউনলোড" চাপলে /offline-manifest.json-এর সব URL প্রগ্রেস বারসহ নামে।
// নেট থাকলে অসমাপ্ত ডাউনলোড resume হয়; নতুন কনটেন্ট এলে "অ্যাপ আপডেট" আসে।
(function () {
  const banner = document.getElementById('dlBanner');
  if (!banner) return;
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (!isStandalone() || !('serviceWorker' in navigator)) return;

  const btn = document.getElementById('dlBtn');
  const title = banner.querySelector('[data-dl-title]');
  const sub = banner.querySelector('[data-dl-sub]');
  const barWrap = banner.querySelector('[data-dl-barwrap]');
  const fill = banner.querySelector('[data-dl-fill]');
  const pct = banner.querySelector('[data-dl-pct]');
  if (!btn || !title || !barWrap || !fill || !pct) return;

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

  const show = () => {
    banner.hidden = false;
  };
  const hide = () => {
    banner.hidden = true;
  };
  function setProgress(done, total) {
    const p = total ? Math.round((done / total) * 100) : 0;
    barWrap.hidden = false;
    pct.hidden = false;
    fill.style.width = p + '%';
    barWrap.setAttribute('aria-valuenow', String(p));
    pct.textContent = 'ডাউনলোড হচ্ছে… ' + done + '/' + total + ' (' + p + '%)';
  }
  function resetBar() {
    barWrap.hidden = true;
    pct.hidden = true;
    fill.style.width = '0%';
    barWrap.setAttribute('aria-valuenow', '0');
  }

  function download(manifest) {
    if (busy) return;
    busy = true;
    show();
    btn.hidden = true;
    title.textContent = 'ডাউনলোড হচ্ছে…';
    if (sub) sub.textContent = 'অ্যাপ বন্ধ করবেন না';
    setProgress(0, manifest.urls.length);
    write({ started: true, done: false, at: Date.now() });
    navigator.serviceWorker.ready.then((reg) => {
      const sw = reg.active;
      if (!sw) {
        busy = false;
        btn.hidden = false;
        return;
      }
      const onMsg = (e) => {
        const d = (e && e.data) || {};
        if (d.type === 'JELA_PROGRESS') {
          setProgress(d.done, d.total);
        } else if (d.type === 'JELA_DONE') {
          navigator.serviceWorker.removeEventListener('message', onMsg);
          busy = false;
          if (d.failed === 0) {
            write({ started: true, done: true, version: manifest.version, total: d.total, at: Date.now() });
            hide(); // সব নেমেছে — কার্ড লুকাও; আপডেট এলে আবার আসবে
          } else {
            // কিছু বাকি — নেট ফিরলে resume হবে
            btn.hidden = false;
            btn.textContent = 'আবার চেষ্টা করুন';
            title.textContent = 'কিছু কনটেন্ট বাকি রয়ে গেছে';
            if (sub) sub.textContent = 'ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন';
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', onMsg);
      sw.postMessage({ type: 'JELA_PREFETCH', urls: manifest.urls });
    }).catch(() => {
      busy = false;
      btn.hidden = false;
    });
  }

  async function fetchManifest() {
    const res = await fetch('/offline-manifest.json', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('manifest ' + res.status);
    return res.json();
  }

  // auto=true: শুধু resume / আপডেট-নোটিশ; auto=false (ক্লিক): সবসময় ডাউনলোড
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
      hide();
      return;
    }
    if (st.done && st.version !== manifest.version) {
      // নতুন কনটেন্ট: আসল অ্যাপের মতো "অ্যাপ আপডেট" কার্ড
      write({ ...st, updateAvailable: true });
      show();
      resetBar();
      title.textContent = 'নতুন কনটেন্ট এসেছে';
      if (sub) sub.textContent = 'আপডেট করলে অফলাইনেও নতুন সব পাবেন';
      btn.hidden = false;
      btn.textContent = 'অ্যাপ আপডেট';
      if (!auto) download(manifest);
      return;
    }
    const needsResume = st.started && !st.done;
    if (auto && !needsResume) return;
    // প্রথমবার বা resume: কার্ড দেখিয়ে ডাউনলোড
    show();
    resetBar();
    title.textContent = 'সম্পূর্ণ কনটেন্ট ডাউনলোড করুন';
    if (sub) sub.textContent = 'একবার ডাউনলোড করলে ইন্টারনেট ছাড়াই সব পড়া যাবে';
    btn.hidden = false;
    btn.textContent = st.started ? 'ডাউনলোড চালিয়ে যান' : 'ডাউনলোড';
    if (!auto || needsResume) download(manifest);
  }

  btn.addEventListener('click', () => checkAndDownload(false));
  window.addEventListener('online', () => checkAndDownload(true));

  const st = read();
  if (st.done && st.updateAvailable) {
    checkAndDownload(true);
  } else if (!st.done && navigator.onLine) {
    // ডাউনলোড হয়নি / অসমাপ্ত — কার্ড দেখাও (ডাউনলোড বাটনসহ)
    show();
    resetBar();
    title.textContent = 'সম্পূর্ণ কনটেন্ট ডাউনলোড করুন';
    btn.hidden = false;
    btn.textContent = st.started ? 'ডাউনলোড চালিয়ে যান' : 'ডাউনলোড';
  }
  let lastCheck = 0;
  try {
    lastCheck = +(localStorage.getItem(CHECK_KEY) || 0);
  } catch {
    // ignore
  }
  if (Date.now() - lastCheck > DAY && navigator.onLine) {
    try {
      localStorage.setItem(CHECK_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    checkAndDownload(true);
  }
})();

// PWA install button: beforeinstallprompt পেলে "অ্যাপ ইনস্টল" বাটন দেখাও।
// ইনস্টল করা ডিভাইসে (standalone) বাটন কখনো দেখায় না। iOS-এ prompt নেই,
// তাই সেখানে বাটন /install নির্দেশনায় নিয়ে যায়।
(function () {
  const btn = document.getElementById('installBtn');
  const pageBtn = document.getElementById('installPageBtn');
  const pop = document.getElementById('installPop');
  const popGo = document.getElementById('installPopGo');
  const popLater = document.getElementById('installPopLater');
  if (!btn && !pageBtn && !pop) return;
  const doneNote = document.getElementById('installDone');
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const POP_KEY = 'jelaInstallPop';
  const POP_DAYS = 7;
  let deferred = null;

  const hideAll = () => {
    if (btn) btn.hidden = true;
    if (pageBtn) pageBtn.hidden = true;
    if (doneNote) doneNote.hidden = false;
  };
  if (isStandalone()) {
    hideAll();
    if (pop) pop.hidden = true;
    return;
  }

  const popSnoozed = () => {
    try {
      return Date.now() - (+(localStorage.getItem(POP_KEY) || 0)) < POP_DAYS * 86400000;
    } catch {
      return true;
    }
  };
  const popSnooze = () => {
    try {
      localStorage.setItem(POP_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };
  const showPop = () => {
    if (pop && !popSnoozed()) pop.hidden = false;
  };
  const hidePop = () => {
    if (pop) pop.hidden = true;
  };

  async function doInstall(fromPop) {
    if (deferred) {
      if (fromPop) hidePop();
      popSnooze();
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

  // iOS: manual নির্দেশনা পেজেই মূল ভরসা — nav বাটন + auto popup দেখাও
  if (isIOS) {
    if (btn) btn.hidden = false;
    window.addEventListener('load', () => {
      setTimeout(showPop, 2500);
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    if (btn) btn.hidden = false;
    if (pageBtn) pageBtn.hidden = false;
    // auto popup: prompt তৈরি হলেই একবার দেখাও (snooze সম্মান করে)
    setTimeout(showPop, 2500);
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    popSnooze();
    hidePop();
    hideAll();
  });

  if (btn) btn.addEventListener('click', () => doInstall(false));
  if (pageBtn) pageBtn.addEventListener('click', () => doInstall(false));
  if (popGo) popGo.addEventListener('click', () => doInstall(true));
  if (popLater) popLater.addEventListener('click', () => {
    hidePop();
    popSnooze();
  });
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
