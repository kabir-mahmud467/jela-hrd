/* Jela HRD main.js — CSP-safe (no inline handlers), ES5 ONLY.
 * Very old Android Chrome must parse this file, otherwise install +
 * offline UI break on those devices. No arrows, const/let, async/await,
 * template literals, optional chaining, includes/startsWith, or
 * classList.toggle with force flag.
 */
document.documentElement.classList.add('js');

// PWA: service worker (offline + installable). /sw.js scope = whole site.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    try {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    } catch (e) {
      // ignore
    }
  });
}

// PWA content download — শুধু ইনস্টল করা অ্যাপের ভেতরে (standalone) দেখায়।
// ইনস্টলে শুধু basic shell আসে; এই কার্ড থেকে "ডাউনলোড" চাপলে
// /offline-manifest.json-এর সব URL প্রগ্রেস বারসহ নামে।
(function () {
  var banner = document.getElementById('dlBanner');
  if (!banner) return;
  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }
  if (!isStandalone() || !('serviceWorker' in navigator)) return;

  var btn = document.getElementById('dlBtn');
  var title = banner.querySelector('[data-dl-title]');
  var sub = banner.querySelector('[data-dl-sub]');
  var barWrap = banner.querySelector('[data-dl-barwrap]');
  var fill = banner.querySelector('[data-dl-fill]');
  var pct = banner.querySelector('[data-dl-pct]');
  if (!btn || !title || !barWrap || !fill || !pct) return;

  var LS = 'jelaOffline';
  var CHECK_KEY = 'jelaOfflineCheck';
  var DAY = 86400000;
  function read() {
    try {
      return JSON.parse(localStorage.getItem(LS) || '{}');
    } catch (e) {
      return {};
    }
  }
  function write(o) {
    try {
      localStorage.setItem(LS, JSON.stringify(o));
    } catch (e) {
      // ignore
    }
  }
  var busy = false;

  function show() {
    banner.hidden = false;
  }
  function hide() {
    banner.hidden = true;
  }
  function setProgress(done, total) {
    var p = total ? Math.round((done / total) * 100) : 0;
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
    navigator.serviceWorker.ready.then(function (reg) {
      var sw = reg.active;
      if (!sw) {
        busy = false;
        btn.hidden = false;
        return;
      }
      var onMsg = function (e) {
        var d = (e && e.data) || {};
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
    }).catch(function () {
      busy = false;
      btn.hidden = false;
    });
  }

  function fetchManifest() {
    return fetch('/offline-manifest.json', { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('manifest ' + res.status);
      return res.json();
    });
  }

  // auto=true: শুধু resume / আপডেট-নোটিশ; auto=false (ক্লিক): সবসময় ডাউনলোড
  function checkAndDownload(auto, manifest) {
    if (busy || !navigator.onLine) return;
    function go(m) {
      var st = read();
      if (st.done && st.version === m.version) {
        hide();
        return;
      }
      if (st.done && st.version !== m.version) {
        // নতুন কনটেন্ট: আসল অ্যাপের মতো "অ্যাপ আপডেট" কার্ড
        var upd = { started: st.started, done: st.done, version: st.version, total: st.total, at: st.at, updateAvailable: true };
        write(upd);
        show();
        resetBar();
        title.textContent = 'নতুন কনটেন্ট এসেছে';
        if (sub) sub.textContent = 'আপডেট করলে অফলাইনেও নতুন সব পাবেন';
        btn.hidden = false;
        btn.textContent = 'অ্যাপ আপডেট';
        if (!auto) download(m);
        return;
      }
      var needsResume = st.started && !st.done;
      if (auto && !needsResume) return;
      show();
      resetBar();
      title.textContent = 'সম্পূর্ণ কনটেন্ট ডাউনলোড করুন';
      if (sub) sub.textContent = 'একবার ডাউনলোড করলে ইন্টারনেট ছাড়াই সব পড়া যাবে';
      btn.hidden = false;
      btn.textContent = st.started ? 'ডাউনলোড চালিয়ে যান' : 'ডাউনলোড';
      if (!auto || needsResume) download(m);
    }
    if (manifest) {
      go(manifest);
      return;
    }
    fetchManifest().then(go).catch(function () {});
  }

  btn.addEventListener('click', function () {
    fetchManifest().then(function (m) {
      checkAndDownload(false, m);
    }).catch(function () {});
  });
  window.addEventListener('online', function () {
    checkAndDownload(true);
  });

  var st = read();
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
  var lastCheck = 0;
  try {
    lastCheck = +(localStorage.getItem(CHECK_KEY) || 0);
  } catch (e) {
    // ignore
  }
  if (Date.now() - lastCheck > DAY && navigator.onLine) {
    try {
      localStorage.setItem(CHECK_KEY, String(Date.now()));
    } catch (e) {
      // ignore
    }
    checkAndDownload(true);
  }
})();

// PWA install message: ইনস্টল না থাকলে পেজের ভেতরে মেসেজ কার্ড দেখাও
// (browser popup নয় — block হয় না)। ইনস্টল করা ডিভাইসে কখনো দেখায় না।
// ইনস্টল শেষ হলে "ইনস্টল হয়েছে" বার্তা দেখায়।
(function () {
  var btn = document.getElementById('installBtn');
  var pageBtn = document.getElementById('installPageBtn');
  var msg = document.getElementById('installMsg');
  var msgGo = document.getElementById('installMsgGo');
  var msgLater = document.getElementById('installMsgLater');
  var msgTitle = msg ? msg.querySelector('[data-msg-title]') : null;
  var msgSub = msg ? msg.querySelector('[data-msg-sub]') : null;
  var msgProg = msg ? msg.querySelector('[data-msg-prog]') : null;
  var msgBtns = msg ? msg.querySelector('[data-msg-btns]') : null;
  if (!btn && !pageBtn && !msg) return;
  var doneNote = document.getElementById('installDone');
  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }
  var ua = navigator.userAgent || '';
  var isIOS = ua.indexOf('iPhone') !== -1 || ua.indexOf('iPad') !== -1 || ua.indexOf('iPod') !== -1;
  var MSG_KEY = 'jelaInstallMsg';
  var MSG_DAYS = 7;
  var deferred = null;

  function hideAll() {
    if (btn) btn.hidden = true;
    if (pageBtn) pageBtn.hidden = true;
    if (doneNote) doneNote.hidden = false;
  }
  if (isStandalone()) {
    hideAll();
    if (msg) msg.hidden = true;
    return;
  }

  function msgSnoozed() {
    try {
      return Date.now() - (+(localStorage.getItem(MSG_KEY) || 0)) < MSG_DAYS * 86400000;
    } catch (e) {
      return true;
    }
  }
  function msgSnooze() {
    try {
      localStorage.setItem(MSG_KEY, String(Date.now()));
    } catch (e) {
      // ignore
    }
  }
  function defaultMsg() {
    if (msgTitle) msgTitle.textContent = 'অ্যাপ ইনস্টল করুন';
    if (msgSub) msgSub.textContent = 'হোম স্ক্রিন থেকে এক ট্যাপে খুলুন, অফলাইনেও পড়ুন';
    if (msgProg) msgProg.hidden = true;
    if (msgBtns) msgBtns.hidden = false;
    if (msgGo) msgGo.hidden = false;
    if (msgLater) msgLater.textContent = 'পরে';
  }
  function showMsg() {
    if (msg && !msgSnoozed()) {
      defaultMsg();
      msg.hidden = false;
    }
  }
  function hideMsg() {
    if (msg) msg.hidden = true;
  }
  function setInstalling(on) {
    if (msgTitle) msgTitle.textContent = on ? 'ইনস্টল হচ্ছে…' : 'অ্যাপ ইনস্টল করুন';
    if (msgSub) msgSub.textContent = on ? 'শেষ হলে হোম স্ক্রিনে আইকন পাবেন' : 'হোম স্ক্রিন থেকে এক ট্যাপে খুলুন, অফলাইনেও পড়ুন';
    if (msgProg) msgProg.hidden = !on;
    if (msgBtns) msgBtns.hidden = on;
  }
  // ইনস্টল শেষ: "ইনস্টল হয়েছে" বার্তা
  function setInstalled() {
    if (msgTitle) msgTitle.textContent = 'ইনস্টল হয়েছে!';
    if (msgSub) msgSub.textContent = 'হোম স্ক্রিন থেকে অ্যাপ খুলুন';
    if (msgProg) msgProg.hidden = true;
    if (msgGo) msgGo.hidden = true;
    if (msgLater) msgLater.textContent = 'ঠিক আছে';
    if (msgBtns) msgBtns.hidden = false;
    if (msg) msg.hidden = false;
  }

  function waitInstalled(timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) {
        if (!done) {
          done = true;
          resolve(v);
        }
      }
      window.addEventListener('appinstalled', function () { finish(true); });
      setTimeout(function () { finish(false); }, timeoutMs);
    });
  }
  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(null); }, ms); });
  }

  function doInstall(fromMsg) {
    if (deferred) {
      if (fromMsg) setInstalling(true);
      var p = deferred;
      deferred = null;
      try {
        p.prompt();
        // userChoice কিছু ব্রাউজারে ঝুলে থাকতে পারে — 30s পর UI ফেরত দাও
        Promise.race([p.userChoice, delay(30000)]).then(function (choice) {
          if (choice && choice.outcome === 'accepted') {
            // ইনস্টল চলছে — appinstalled না আসা পর্যন্ত প্রগ্রেস দেখাও
            waitInstalled(15000).then(function () {
              msgSnooze();
              setInstalled();
              hideAll();
            });
          } else {
            // বাতিল/সময় শেষ — মেসেজ আগের অবস্থায় ফেরত
            defaultMsg();
          }
        }).catch(function () {
          defaultMsg();
        });
      } catch (e) {
        defaultMsg();
      }
      return;
    }
    if (!isStandalone() && window.location.pathname !== '/install') {
      window.location.href = '/install';
    }
  }

  // iOS: manual নির্দেশনা পেজেই মূল ভরসা — nav বাটন + মেসেজ দেখাও
  if (isIOS) {
    if (btn) btn.hidden = false;
    window.addEventListener('load', function () {
      setTimeout(showMsg, 2500);
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (btn) btn.hidden = false;
    if (pageBtn) pageBtn.hidden = false;
    // prompt তৈরি হলেই মেসেজ দেখাও (snooze সম্মান করে)
    setTimeout(showMsg, 2500);
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    msgSnooze();
    setInstalled();
    hideAll();
  });

  if (btn) btn.addEventListener('click', function () { doInstall(false); });
  if (pageBtn) pageBtn.addEventListener('click', function () { doInstall(false); });
  if (msgGo) msgGo.addEventListener('click', function () { doInstall(true); });
  if (msgLater) msgLater.addEventListener('click', function () {
    hideMsg();
    msgSnooze();
  });
})();

// CSP-friendly accordion: data-toggle-target ব্যবহার করে, smooth animation CSS-এ
document.addEventListener('click', function (e) {
  var t = e.target;
  if (t.closest) {
    t = t.closest('[data-toggle-target]');
  } else {
    while (t && t !== document && !(t.getAttribute && t.getAttribute('data-toggle-target'))) {
      t = t.parentNode;
    }
    if (!t || t === document) return;
  }
  if (!t) return;
  var el = document.getElementById(t.getAttribute('data-toggle-target'));
  if (!el) return;
  el.classList.toggle('hidden');
  var open = !el.classList.contains('hidden');
  if (open) t.classList.add('open');
  else t.classList.remove('open');
  t.setAttribute('aria-expanded', String(open));
});

// CSP-friendly confirm for delete/unban forms (inline onsubmit সরানো হয়েছে)
document.addEventListener('submit', function (e) {
  var f = e.target;
  if (f.closest) {
    f = f.closest('form[data-confirm]');
  } else {
    while (f && f !== document && !(f.getAttribute && f.getAttribute('data-confirm'))) {
      f = f.parentNode;
    }
    if (!f || f === document) return;
  }
  if (!f) return;
  if (!window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
});

// Backward-compat (পুরনো onclick থাকলে)
function toggleAnswer(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden');
  var btn = el.previousElementSibling;
  if (!btn) return;
  if (el.classList.contains('hidden')) btn.classList.remove('open');
  else btn.classList.add('open');
}

// Navbar shadow + active link + back-to-top + mobile menu (CSP-safe, no inline handlers)
(function () {
  var nav = document.getElementById('navbar');
  var toTop = document.getElementById('toTop');
  var navToggle = document.getElementById('navToggle');
  var mainnav = document.getElementById('mainnav');
  var path = window.location.pathname;
  var links = document.querySelectorAll('#mainnav a');
  for (var i = 0; i < links.length; i++) {
    (function (a) {
      var href = a.getAttribute('href');
      if (href === '/admin') return;
      if ((href === '/' && path === '/') || (href !== '/' && path.indexOf(href) === 0)) {
        a.classList.add('active');
      }
    })(links[i]);
  }
  var ticking = false;
  function onScroll() {
    if (nav) {
      if (window.scrollY > 8) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    }
    if (toTop) {
      if (window.scrollY > 500) toTop.classList.add('show');
      else toTop.classList.remove('show');
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      if ('requestAnimationFrame' in window) requestAnimationFrame(onScroll);
      else onScroll();
    }
  }, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener('click', function () {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
  });
  // Mobile menu toggle
  if (navToggle && mainnav) {
    navToggle.addEventListener('click', function () {
      var isOpen = mainnav.classList.contains('open');
      if (isOpen) {
        mainnav.classList.remove('open');
        navToggle.classList.remove('open');
      } else {
        mainnav.classList.add('open');
        navToggle.classList.add('open');
      }
      navToggle.setAttribute('aria-expanded', String(!isOpen));
    });
    mainnav.addEventListener('click', function (e) {
      var a = e.target;
      if (a.closest) a = a.closest('a');
      else {
        while (a && a !== document) {
          if (a.tagName === 'A') break;
          a = a.parentNode;
        }
        if (!a || a === document) return;
      }
      if (a) {
        mainnav.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();

// Reveal on scroll
(function () {
  var els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (!('IntersectionObserver' in window)) {
    for (var i = 0; i < els.length; i++) els[i].classList.add('in');
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].isIntersecting) {
        entries[j].target.classList.add('in');
        io.unobserve(entries[j].target);
      }
    }
  }, { threshold: 0.08 });
  for (var k = 0; k < els.length; k++) io.observe(els[k]);
})();
