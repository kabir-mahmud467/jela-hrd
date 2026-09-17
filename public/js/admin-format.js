/* Admin WYSIWYG editor — bold shows as bold while typing (no **markers**).
 * Target long-text fields become contenteditable editors (execCommand based,
 * ES5, no dependencies). Saved HTML is sanitized server-side; legacy
 * plain/markdown content is upgraded to formatted view on first edit.
 * Desktop: static toolbar above each field.
 * Touch/mobile: NO static toolbar — floating bar only while text selected.
 * Paste is forced to plain text (keeps DB clean, Bijoy-safe).
 * Browser spellcheck (lang="bn") on editors + plain fields.
 * ES5 ONLY, CSP-safe (no inline handlers).
 */
(function () {
  var CONTENT_RE = /^\/admin\/(books|notes|dars|duas|ayathadith|surah|bibidh)(\/|$)/;
  var TARGET_SEL = 'textarea[name="content"], textarea[name="description"], textarea[name="translation"]';

  function exec(name, val) {
    try {
      return document.execCommand(name, false, (val === undefined || val === null) ? null : val);
    } catch (e) {
      return false;
    }
  }

  /* mobile selection restore */
  var savedRange = null;
  var lastEditor = null;
  function saveRange() {
    try {
      var sel = window.getSelection();
      if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
    } catch (e) {}
  }
  function restoreRange(ed) {
    try {
      ed.focus();
      if (savedRange) {
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    } catch (e) {
      try { ed.focus(); } catch (e2) {}
    }
  }

  function normalizeUrl(u) {
    u = String(u == null ? '' : u).replace(/^\s+|\s+$/g, '');
    if (!u) return null;
    if (/^(https?:\/\/|mailto:|tel:|#)/i.test(u)) return u;
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u)) return 'https://' + u;
    if (/^\//.test(u)) return u;
    return null;
  }

  var ACTIONS = {
    bold: function () { exec('bold'); },
    italic: function () { exec('italic'); },
    underline: function () { exec('underline'); },
    strike: function () { exec('strikeThrough'); },
    heading: function () { exec('formatBlock', 'h3'); },
    para: function () { exec('formatBlock', 'p'); },
    list: function () { exec('insertUnorderedList'); },
    ordered: function () { exec('insertOrderedList'); },
    indent: function () { exec('indent'); },
    outdent: function () { exec('outdent'); },
    link: function () {
      var u = null;
      try { u = window.prompt('লিংকের ঠিকানা দিন (https://…)', 'https://'); } catch (e) {}
      if (u === null || u === undefined) return;
      u = normalizeUrl(u);
      if (!u) return;
      exec('createLink', u);
    },
    clear: function () { exec('removeFormat'); }
  };

  var BUTTONS = [
    { act: 'bold', label: 'B', title: 'গাঢ় (bold)', cls: 'b' },
    { act: 'italic', label: 'I', title: 'তির্যক (italic)', cls: 'i' },
    { act: 'underline', label: 'U', title: 'নিচে দাগ (underline)', cls: 'u' },
    { act: 'strike', label: 'S', title: 'কাটা দাগ (strikethrough)', cls: 's' },
    { act: 'heading', label: 'H', title: 'শিরোনাম', cls: '' },
    { act: 'para', label: 'P', title: 'সাধারণ প্যারা', cls: '' },
    { act: 'list', label: '•', title: 'বুলেট তালিকা', cls: '' },
    { act: 'ordered', label: '1.', title: 'নম্বর তালিকা (auto numbering)', cls: '' },
    { act: 'indent', label: '⇥', title: 'ভেতরে সরান (indent)', cls: '' },
    { act: 'outdent', label: '⇤', title: 'বাইরে আনুন (outdent)', cls: '' },
    { act: 'link', label: 'লিংক', title: 'লিংক যোগ করুন', cls: '' },
    { act: 'clear', label: '✕', title: 'ফরম্যাট মুছুন', cls: '' }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Legacy plain/markdown -> formatted HTML for the editing view. */
  function seedHtml(raw) {
    raw = String(raw == null ? '' : raw);
    if (/<\/?[a-zA-Z][^<>]*>/.test(raw)) return raw;
    if (window.BnFormat && window.BnFormat.renderHtml) {
      try {
        return window.BnFormat.renderHtml(raw);
      } catch (e) {}
    }
    return esc(raw).replace(/\n/g, '<br>');
  }

  function setupEditor(area) {
    if (area.getAttribute('data-rich') === '1') return area._richEditor || null;
    area.setAttribute('data-rich', '1');
    /* native required + display:none = unsubmittable form; server validates */
    area.removeAttribute('required');
    area.style.display = 'none';
    var ed = document.createElement('div');
    ed.className = 'rich-editor';
    ed.contentEditable = 'true';
    ed.setAttribute('spellcheck', 'true');
    ed.setAttribute('lang', 'bn');
    ed.setAttribute('role', 'textbox');
    ed.setAttribute('aria-multiline', 'true');
    ed.setAttribute('data-placeholder', 'এখানে লিখুন…');
    ed.innerHTML = seedHtml(area.value);
    area.parentNode.insertBefore(ed, area);
    ed.addEventListener('paste', function (e) {
      var text = '';
      try {
        text = ((e.clipboardData || window.clipboardData) || {}).getData
          ? (e.clipboardData || window.clipboardData).getData('text/plain') : '';
      } catch (err) {}
      if (!text) return;
      e.preventDefault();
      try {
        if (document.execCommand('insertText', false, text)) return;
      } catch (err2) {}
      try {
        var sel = window.getSelection();
        if (sel && sel.rangeCount) {
          var r = sel.getRangeAt(0);
          r.deleteContents();
          r.insertNode(document.createTextNode(text));
          r.collapse(false);
        } else {
          ed.appendChild(document.createTextNode(text));
        }
      } catch (err3) {}
    });
    ed.addEventListener('keyup', saveRange);
    ed.addEventListener('mouseup', saveRange);
    area._richEditor = ed;
    ed._textarea = area;
    return ed;
  }

  function syncAll(form) {
    var eds = form.querySelectorAll('.rich-editor');
    for (var i = 0; i < eds.length; i++) {
      if (eds[i]._textarea) eds[i]._textarea.value = eds[i].innerHTML;
    }
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

  function buildBar(getEd, barClass) {
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
    var lastTouchFire = 0;
    function fire(btn) {
      var ed = getEd();
      if (!ed) return;
      restoreRange(ed);
      var act = btn.getAttribute('data-act');
      if (ACTIONS[act]) ACTIONS[act]();
      saveRange();
      try { ed.focus(); } catch (e) {}
    }
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('mousedown', function (ev) { ev.preventDefault(); });
      btns[j].addEventListener('touchstart', function (ev) { ev.preventDefault(); }, { passive: false });
      /* iOS cancels click after prevented touchstart — act on touchend */
      btns[j].addEventListener('touchend', function (ev) {
        ev.preventDefault();
        lastTouchFire = Date.now();
        fire(this);
      }, { passive: false });
      btns[j].addEventListener('click', function (ev) {
        ev.preventDefault();
        if (Date.now() - lastTouchFire < 800) return;
        fire(this);
      });
    }
    return bar;
  }

  /* Touch = coarse pointer ONLY (phones/tablets). */
  function coarsePointerOnly() {
    try {
      if (!window.matchMedia) return false;
      return window.matchMedia('(pointer: coarse)').matches &&
        !window.matchMedia('(pointer: fine)').matches;
    } catch (e) {
      return false;
    }
  }
  var isTouch = window.matchMedia ? coarsePointerOnly()
    : (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));

  /* editors first (all devices) */
  forEachTarget(setupEditor);

  if (isTouch) {
    /* ---- mobile: floating bar, selection-এই শুধু দেখায় ----
       activeElement-এর উপর নির্ভর নয় — iOS-এ selection থাকলেও focus
       body-তে থাকতে পারে, তাই anchorNode থেকে editor খুঁজি। */
    var floatBar = buildBar(function () { return lastEditor; }, 'fmt-bar fmt-float');
    floatBar.style.display = 'none';
    document.body.appendChild(floatBar);
    function editorOf(node) {
      while (node && node !== document) {
        if (node.className && String(node.className).indexOf('rich-editor') >= 0) return node;
        node = node.parentNode;
      }
      return null;
    }
    function currentEditor() {
      try {
        var sel = window.getSelection();
        if (sel && sel.rangeCount && !sel.getRangeAt(0).collapsed) {
          var ed = editorOf(sel.anchorNode);
          if (ed) return ed;
        }
      } catch (e) {}
      return null;
    }
    var rafId = null;
    function evalSel() {
      rafId = null;
      var ed = currentEditor();
      if (ed) {
        lastEditor = ed;
        floatBar.style.display = 'flex';
      } else {
        floatBar.style.display = 'none';
      }
    }
    function schedule() {
      if (rafId != null) return;
      if ('requestAnimationFrame' in window) rafId = requestAnimationFrame(evalSel);
      else evalSel();
    }
    /* iOS selection দেরিতে settle হয় — touch-এর পরেও মূল্যায়ন */
    function scheduleLate() {
      schedule();
      setTimeout(schedule, 120);
      setTimeout(schedule, 400);
    }
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('touchend', scheduleLate, { passive: true });
    var scrollT = null;
    document.addEventListener('scroll', function () {
      floatBar.style.display = 'none';
      if (scrollT) clearTimeout(scrollT);
      scrollT = setTimeout(schedule, 250);
    }, { passive: true });
    document.addEventListener('submit', function () {
      floatBar.style.display = 'none';
    }, true);
  } else {
    /* ---- desktop: static toolbar above each editor ---- */
    forEachTarget(function (area) {
      var ed = area._richEditor;
      if (!ed) return;
      if (ed.previousElementSibling && ed.previousElementSibling.className &&
          String(ed.previousElementSibling.className).indexOf('fmt-bar') >= 0) return;
      (function (editor) {
        var bar = buildBar(function () { return editor; }, 'fmt-bar');
        editor.parentNode.insertBefore(bar, editor);
      })(ed);
    });
  }

  /* submit: editors -> textareas FIRST (admin-bijoy converts after) */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    var action = f.getAttribute('action') || '';
    if (!CONTENT_RE.test(action)) return;
    syncAll(f);
  }, true);

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
