document.documentElement.classList.add('js');

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

// Navbar shadow + active link + back-to-top
(function () {
  const nav = document.getElementById('navbar');
  const toTop = document.getElementById('toTop');
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
