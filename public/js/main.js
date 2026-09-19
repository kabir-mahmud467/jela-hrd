/* Jela HRD main.js — CSP-safe (no inline handlers), ES5 ONLY. */
document.documentElement.classList.add('js');

// PWA removed — unregister any previously installed service workers
if ('serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      for (var i = 0; i < regs.length; i++) regs[i].unregister().catch(function(){});
    }).catch(function(){});
    if (window.caches && caches.keys) caches.keys().then(function (keys) {
      for (var j = 0; j < keys.length; j++) if (keys[j].indexOf('jela-hrd') === 0) caches.delete(keys[j]);
    }).catch(function(){});
  } catch (e) {}
}

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

// Checklist: homepage localStorage progress handled in /js/checklist.js (index.ejs only)

// Category dropdowns (bibidh/note): CSP-safe auto-submit on change
// (inline onchange not allowed) — URL বদলায়, তাই সঠিক তালিকা দেখায়।
// দেখুন বাটন no-JS fallback হিসেবে থাকে।
(function () {
  var ids = ['bibidh-cat', 'note-cat'];
  for (var i = 0; i < ids.length; i++) {
    (function (id) {
      var sel = document.getElementById(id);
      if (sel && sel.form) {
        sel.addEventListener('change', function () {
          sel.form.submit();
        });
      }
    })(ids[i]);
  }
})();

// Reveal on scroll — fade + rise 24px (CSS handles motion; JS only adds .in)
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
  }, { threshold: 0.12 });
  for (var k = 0; k < els.length; k++) io.observe(els[k]);
})();

// Scroll cue — fades once the user leaves the opening title (film cue language)
(function () {
  var cue = document.getElementById('scrollCue');
  if (!cue) return;
  function onScroll() {
    if (window.scrollY > 120) cue.classList.add('gone');
    else cue.classList.remove('gone');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
