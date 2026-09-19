/* Jela HRD book3d.js — scroll-scrubbed 3D book opening (scroll-film pattern), ES5 ONLY.
   Tall .book-film track + sticky stage; cover angle lerps toward scroll
   target (1 - exp(-dt*8)) so fast flicks glide. No-JS fallback: closed book. */
(function () {
  var film = document.getElementById('bookFilm');
  if (!film) return;
  var wrap = document.getElementById('bookWrap');
  var book = document.getElementById('book3d');
  var cover = document.getElementById('bookCover');
  var s1 = document.getElementById('bSheet1');
  var s2 = document.getElementById('bSheet2');
  if (!book || !cover) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp01(x) {
    return x < 0 ? 0 : (x > 1 ? 1 : x);
  }

  function progress() {
    var r = film.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    if (total <= 0) return 1;
    return clamp01(-r.top / total);
  }

  // Loose sheets flip AHEAD of the cover (lead factors) so they never lie
  // on top of the right-page text mid-scroll; clamped to rest near the cover.
  function leadAngle(a, f) {
    var x = a * f;
    return x > 160 ? 160 : x;
  }
  // Spread-aware framing: closed book is W units wide; opening adds C units
  // to the LEFT. Scale fits the whole spread in the stage (zooms out as it
  // opens on phones) and the wrap shifts right to keep the spread centered —
  // otherwise the left page swings past the stage edge and clips.
  var BOOK_W = 300;
  var COVER_W = 262;
  function draw(p) {
    var t = clamp01((p - 0.08) / 0.67);
    var e = t * t * (3 - 2 * t);
    var angle = e * 150;
    // Phones: face the viewer more directly (less tilt = less spread + clearer text)
    var narrow = window.innerWidth <= 640;
    var tilt = narrow ? (-14 + p * 8) : (-28 + p * 16);
    var stageW = film.clientWidth || window.innerWidth;
    var fit = stageW / (BOOK_W + COVER_W * e);
    if (fit > 1) fit = 1;
    if (fit < 0.45) fit = 0.45;
    var sc = ' scale(' + fit.toFixed(3) + ')';
    book.style.transform = 'rotateX(6deg) rotateY(' + tilt + 'deg)' + sc;
    if (wrap) wrap.style.transform = 'translateX(' + (e * COVER_W * fit / 2).toFixed(1) + 'px)';
    cover.style.transform = 'rotateY(' + (-angle) + 'deg)';
    if (s1) s1.style.transform = 'translateZ(8px) rotateY(' + (-leadAngle(angle, 1.2)) + 'deg)';
    if (s2) s2.style.transform = 'translateZ(2px) rotateY(' + (-leadAngle(angle, 1.45)) + 'deg)';
  }

  if (reduce) {
    draw(1);
    return;
  }

  var cur = progress();
  var tgt = cur;
  var last = 0;
  var running = true;
  draw(cur);

  function frame(now) {
    if (!running) return;
    if (!last) last = now;
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    var diff = tgt - cur;
    if (diff > 0.0004 || diff < -0.0004) {
      cur += diff * (1 - Math.exp(-dt * 8));
      draw(cur);
    }
    if ('requestAnimationFrame' in window) requestAnimationFrame(frame);
    else running = false;
  }

  var ticking = false;
  function onScroll() {
    tgt = progress();
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    // NOTE: no ticking gate here — tgt must refresh on EVERY scroll event,
    // otherwise the cover freezes after the first scroll.
    tgt = progress();
    if (!('requestAnimationFrame' in window)) draw(tgt);
  }, { passive: true });
  window.addEventListener('resize', function () {
    tgt = progress();
    draw(tgt);
  });
  onScroll();
  if ('requestAnimationFrame' in window) requestAnimationFrame(frame);
})();
