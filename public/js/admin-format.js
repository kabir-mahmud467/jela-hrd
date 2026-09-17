/* Admin formatting: **bold** *italic* ## heading - list [text](url).
 * Desktop: static toolbar above each long-text field.
 * Touch/mobile: NO static toolbar — floating bar appears only while text
 * is selected inside a field (selectionchange driven).
 * Also enables browser spellcheck (lang="bn") on admin content fields.
 * ES5 ONLY, CSP-safe (no inline handlers).
 */
(function () {
  var CONTENT_RE = /^\/admin\/(books|notes|dars|duas|ayathadith|surah|bibidh)(\/|$)/;
  var TARGET_SEL = 'textarea[name="content"], textarea[name="description"], textarea[name="translation"]';

  function isTarget(el) {
    if (!el || el.tagName !== 'TEXTAREA') return false;
    try {
      return el.matches && el.matches(TARGET_SEL);
    } catch (e) {
      var n = (el.getAttribute('name') || '');
      return n === 'content' || n === 'description' || n === 'translation';
    }
  }

  /* ---------- edit actions ---------- */
  function surround(el, before, after, sample) {
    var v = el.value;
    var s = el.selectionStart;
    var e = el.selectionEnd;
    if (s == null) return;
    var sel = v.slice(s, e) || sample;
    el.value = v.slice(0, s) + before + sel + after + v.slice(e);
    el.focus();
    try {
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    } catch (err) {}
  }

  function lineAction(el, mode, sample) {
    var v = el.value;
    var s = el.selectionStart;
    var e = el.selectionEnd;
    if (s == null) return;
    var ls = v.lastIndexOf('\n', s - 1) + 1;
    var le = v.indexOf('\n', e);
    if (le < 0) le = v.length;
    var block = v.slice(ls, le);
    var lines = block.split('\n');
    var hasText = false;
    for (var i = 0; i < lines.length; i++) {
      if (!/^\s*$/.test(lines[i])) hasText = true;
    }
    if (!hasText) {
      var ins = (mode === 'h' ? '## ' : '- ') + sample;
      el.value = v.slice(0, ls) + ins + v.slice(le);
      el.focus();
      try {
        el.setSelectionRange(ls + (mode === 'h' ? 3 : 2), ls + ins.length);
      } catch (err) {}
      return;
    }
    for (var j = 0; j < lines.length; j++) {
      if (/^\s*$/.test(lines[j])) continue;
      var stripped = lines[j].replace(/^\s*(##\s+|-\s+)/, '').replace(/^\s+/, '');
      lines[j] = (mode === 'h' ? '## ' : '- ') + stripped;
    }
    var out = lines.join('\n');
    el.value = v.slice(0, ls) + out + v.slice(le);
    el.focus();
    try {
      el.setSelectionRange(ls, ls + out.length);
    } catch (err) {}
  }

  function clearFormat(el) {
    var v = el.value;
    var s = el.selectionStart;
    var e = el.selectionEnd;
    if (s == null || s === e) return;
    var sel = v.slice(s, e)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
      .replace(/\*\*/g, '')
      .replace(/^##\s+/gm, '')
      .replace(/^-\s+/gm, '');
    el.value = v.slice(0, s) + sel + v.slice(e);
    el.focus();
    try {
      el.setSelectionRange(s, s + sel.length);
    } catch (err) {}
  }

  var ACTIONS = {
    bold: function (el) { surround(el, '**', '**', 'গাঢ় পাঠ'); },
    italic: function (el) { surround(el, '*', '*', 'তির্যক পাঠ'); },
    heading: function (el) { lineAction(el, 'h', 'শিরোনাম'); },
    list: function (el) { lineAction(el, 'li', 'তালিকার আইটেম'); },
    link: function (el) { surround(el, '[', '](https://)', 'লিংকের পাঠ'); },
    clear: function (el) { clearFormat(el); }
  };

  var BUTTONS = [
    { act: 'bold', label: 'B', title: 'গাঢ় (bold)', cls: 'b' },
    { act: 'italic', label: 'I', title: 'তির্যক (italic)', cls: 'i' },
    { act: 'heading', label: 'H', title: 'শিরোনাম', cls: '' },
    { act: 'list', label: '•', title: 'বুলেট তালিকা', cls: '' },
    { act: 'link', label: 'লিংক', title: 'লিংক যোগ করুন', cls: '' },
    { act: 'clear', label: '✕', title: 'ফরম্যাট মুছুন', cls: '' }
  ];

  function buildBar(el, barClass) {
    var bar = document.createElement('div');
    bar.className = barClass;
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'পাঠ ফরম্যাট');
    var html = '';
    for (var i = 0; i < BUTTONS.length; i++) {
      var b = BUTTONS[i];
      html += '<button type="button" class="fmt-btn' + (b.cls ? ' fmt-' + b.cls : '') +
        '" data-act="' + b.act + '" title="' + b.title + '" tabindex="-1">' + b.label + '</button>';
    }
    bar.innerHTML = html;
    var btns = bar.querySelectorAll('button');
    for (var j = 0; j < btns.length; j++) {
      /* keep textarea focus + selection while tapping buttons */
      btns[j].addEventListener('mousedown', function (ev) { ev.preventDefault(); });
      btns[j].addEventListener('touchstart', function (ev) { ev.preventDefault(); }, { passive: false });
      btns[j].addEventListener('click', function (ev) {
        ev.preventDefault();
        var act = this.getAttribute('data-act');
        var target = el;
        /* floating bar: resolve the field holding the selection */
        if (!target) {
          var ae = document.activeElement;
          if (isTarget(ae)) target = ae;
        }
        if (target && ACTIONS[act]) ACTIONS[act](target);
      });
    }
    return bar;
  }

  function forEachTarget(fn) {
    var forms = document.querySelectorAll('form.form');
    for (var i = 0; i < forms.length; i++) {
      var action = forms[i].getAttribute('action') || '';
      if (!CONTENT_RE.test(action)) continue;
      var areas = forms[i].querySelectorAll(TARGET_SEL);
      for (var j = 0; j < areas.length; j++) fn(areas[j]);
    }
  }

  /* Touch = coarse pointer ONLY (phones/tablets). Touchscreen laptops have
     a fine pointer too — they get the desktop static toolbar. */
  function coarsePointerOnly() {
    try {
      if (!window.matchMedia) return false;
      return window.matchMedia('(pointer: coarse)').matches &&
        !window.matchMedia('(pointer: fine)').matches;
    } catch (e) {
      return false;
    }
  }
  function touchCapable() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }
  var isTouch;
  if (window.matchMedia) {
    isTouch = coarsePointerOnly();
  } else {
    isTouch = touchCapable(); /* very old browsers: best guess */
  }

  if (isTouch) {
    /* ---- mobile: floating bar, selection-এই শুধু দেখায় ---- */
    var floatBar = buildBar(null, 'fmt-bar fmt-float');
    floatBar.style.display = 'none';
    document.body.appendChild(floatBar);
    var rafId = null;
    function evalSel() {
      rafId = null;
      var ae = document.activeElement;
      var show = false;
      if (isTarget(ae)) {
        try {
          show = ae.selectionStart != null && ae.selectionStart !== ae.selectionEnd;
        } catch (e) {
          show = false;
        }
      }
      floatBar.style.display = show ? 'flex' : 'none';
    }
    function schedule() {
      if (rafId != null) return;
      if ('requestAnimationFrame' in window) rafId = requestAnimationFrame(evalSel);
      else evalSel();
    }
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('scroll', function () {
      floatBar.style.display = 'none';
    }, { passive: true });
    document.addEventListener('submit', function () {
      floatBar.style.display = 'none';
    }, true);
  } else {
    /* ---- desktop: static toolbar above each field ---- */
    forEachTarget(function (area) {
      if (area.previousElementSibling && area.previousElementSibling.className &&
          area.previousElementSibling.className.indexOf('fmt-bar') >= 0) return;
      var bar = buildBar(area, 'fmt-bar');
      area.parentNode.insertBefore(bar, area);
    });
  }

  /* ---------- spellcheck (browser-native, Bangla) ---------- */
  (function spellcheck() {
    var forms = document.querySelectorAll('form.form');
    for (var i = 0; i < forms.length; i++) {
      var action = forms[i].getAttribute('action') || '';
      if (!CONTENT_RE.test(action)) continue;
      var els = forms[i].querySelectorAll('input[type="text"], input:not([type]), textarea');
      for (var j = 0; j < els.length; j++) {
        els[j].setAttribute('spellcheck', 'true');
        els[j].setAttribute('lang', 'bn');
        els[j].setAttribute('autocapitalize', 'sentences');
      }
    }
  })();
})();
