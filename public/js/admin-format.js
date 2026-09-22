/* Admin WYSIWYG editor — bold shows as bold while typing (no **markers**).
 * Target long-text fields become contenteditable editors (execCommand based,
 * ES5, no dependencies). Saved HTML is sanitized server-side; legacy
 * plain/markdown content is upgraded to formatted view on first edit.
 * Static toolbar above each field — SAME on desktop and mobile.
 * Paste keeps formatting (bold/lists/headings/links) via a tag allowlist
 * matching the server sanitizer; Word/span junk is unwrapped. Bijoy text
 * in the paste is auto-converted; marker-less Bijoy uses the বি button.
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

  /* selection restore (static bar taps blur the editor, esp. on touch) */
  var savedRange = null;
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
    table: function () {
      var dims = null;
      try { dims = window.prompt('টেবিলের সারি ও কলাম দিন (যেমন ৩x২)', '৩x২'); } catch (e) {}
      if (dims === null || dims === undefined) return;
      insertTable(dims);
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
    { act: 'table', label: '▦', title: 'টেবিল যোগ করুন (সারি×কলাম)', cls: '' },
    { act: 'indent', label: '⇥', title: 'ভেতরে সরান (indent)', cls: '' },
    { act: 'outdent', label: '⇤', title: 'বাইরে আনুন (outdent)', cls: '' },
    { act: 'link', label: 'লিংক', title: 'লিংক যোগ করুন', cls: '' },
    { act: 'bijoy', label: 'বি', title: 'বিজয় থেকে ইউনিকোডে রূপান্তর (পুরো লেখা — চেনা না গেলে চাপুন)', cls: '' },
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

  /* ---------- formatted paste (allowlist mirrors lib/rich-html.js) ---------- */
  var PASTE_KEEP = { P: 1, H3: 1, BR: 1, STRONG: 1, EM: 1, U: 1, S: 1, STRIKE: 1, DEL: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, A: 1, TABLE: 1, CAPTION: 1, THEAD: 1, TBODY: 1, TFOOT: 1, TR: 1, TH: 1, TD: 1 };
  var PASTE_TOP = { DIV: 'P', SECTION: 'P', ARTICLE: 'P', HEADER: 'P', FOOTER: 'P', MAIN: 'P', NAV: 'P', ASIDE: 'P', H1: 'H3', H2: 'H3', H4: 'H3', H5: 'H3', H6: 'H3', B: 'STRONG', I: 'EM' };
  var PASTE_DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, FORM: 1, INPUT: 1, BUTTON: 1, SELECT: 1, TEXTAREA: 1, IMG: 1, VIDEO: 1, AUDIO: 1, META: 1, LINK: 1 };

  function pasteRename(node, tag) {
    var fresh = document.createElement(tag);
    while (node.firstChild) fresh.appendChild(node.firstChild);
    node.parentNode.replaceChild(fresh, node);
    return fresh;
  }
  /* Inline-style spans (Google Docs / Word / most sites mark bold/italic/
     underline with style="", not <b>/<i>) -> semantic tags the server keeps.
     Without this, pasted bold/italic silently unwraps to plain text. */
  function styleWraps(el) {
    var out = [];
    var st = '';
    try { st = (el.getAttribute('style') || '').toLowerCase(); } catch (e) {}
    if (!st && !el.style) return out;
    var css = st;
    try {
      if (el.style && el.style.cssText) css += ';' + String(el.style.cssText).toLowerCase();
    } catch (e2) {}
    if (/(^|;)[\s]*font-weight[\s]*:[\s]*(bold|[7-9]\d\d)/.test(css)) out.push('STRONG');
    if (/(^|;)[\s]*font-style[\s]*:[\s]*(italic|oblique)/.test(css)) out.push('EM');
    if (/text-decoration[^;]*underline/.test(css)) out.push('U');
    if (/text-decoration[^;]*line-through/.test(css)) out.push('S');
    return out;
  }
  function pasteWrapInline(node, tags) {
    var inner = node;
    var i, fresh;
    for (i = tags.length - 1; i >= 0; i--) {
      fresh = document.createElement(tags[i]);
      while (inner.firstChild) fresh.appendChild(inner.firstChild);
      inner.appendChild(fresh);
      inner = fresh;
    }
    pasteUnwrap(node);
  }
  function pasteUnwrap(node) {
    var parent = node.parentNode;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
  }
  function pasteClean(node) {
    var kids = node.childNodes;
    var i, n, tag, href;
    for (i = kids.length - 1; i >= 0; i--) {
      n = kids[i];
      if (n.nodeType === 8) { node.removeChild(n); continue; } /* comment */
      if (n.nodeType !== 1) continue; /* text stays */
      tag = n.tagName;
      if (PASTE_DROP[tag]) { node.removeChild(n); continue; }
      if (tag === 'A') {
        href = n.getAttribute('href');
        while (n.attributes.length) n.removeAttribute(n.attributes[0].name);
        href = normalizeUrl(href);
        /* server keeps http(s) links only — other schemes become plain text */
        if (href && !/^https?:\/\//i.test(href)) href = null;
        if (href) n.setAttribute('href', href);
        else {
          pasteClean(n);
          pasteUnwrap(n);
          continue;
        }
        pasteClean(n);
        continue;
      }
      if (PASTE_KEEP[tag]) {
        while (n.attributes.length) n.removeAttribute(n.attributes[0].name);
        pasteClean(n);
        continue;
      }
      if (PASTE_TOP[tag]) {
        while (n.attributes.length) n.removeAttribute(n.attributes[0].name);
        n = pasteRename(n, PASTE_TOP[tag]);
        pasteClean(n);
        continue;
      }
      /* Word spans, font tags, o:p, unknown tags: convert inline styles
         (bold/italic/underline/strike) to semantic tags, keep the text */
      var wraps = (tag === 'SPAN' || tag === 'FONT') ? styleWraps(n) : [];
      pasteClean(n);
      if (wraps.length) pasteWrapInline(n, wraps);
      else pasteUnwrap(n);
    }
  }
  function sanitizePasteHtml(html) {
    var tmp = null;
    try {
      tmp = document.createElement('div');
      tmp.innerHTML = html;
      pasteClean(tmp);
      return tmp.innerHTML.replace(/^\s+|\s+$/g, '');
    } catch (e) {
      return '';
    }
  }
  function insertHtmlAtCaret(html) {
    try {
      if (document.execCommand('insertHTML', false, html)) return;
    } catch (e) {}
    try {
      var sel = window.getSelection();
      if (sel && sel.rangeCount) {
        var r = sel.getRangeAt(0);
        r.deleteContents();
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        var frag = document.createDocumentFragment();
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        r.insertNode(frag);
        r.collapse(false);
      }
    } catch (e2) {}
  }

  /* ---------- table builder (toolbar ▦ button) ---------- */
  function bnToEnDigits(s) {
    return String(s == null ? '' : s).replace(/[০-৯]/g, function (d) {
      return String('০১২৩৪৫৬৭৮৯'.indexOf(d));
    });
  }
  function insertTable(dims) {
    var parts = bnToEnDigits(dims).split(/[^0-9]+/);
    var nums = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] !== '') nums.push(parseInt(parts[i], 10));
    }
    var rows = nums.length > 0 && !isNaN(nums[0]) ? nums[0] : 0;
    var cols = nums.length > 1 && !isNaN(nums[1]) ? nums[1] : 0;
    if (!rows || !cols) return;
    rows = Math.max(1, Math.min(10, rows));
    cols = Math.max(1, Math.min(6, cols));
    var h = '<table><thead><tr>';
    var r, c;
    for (c = 0; c < cols; c++) h += '<th>শিরোনাম</th>';
    h += '</tr></thead><tbody>';
    for (r = 1; r < rows; r++) {
      h += '<tr>';
      for (c = 0; c < cols; c++) h += '<td></td>';
      h += '</tr>';
    }
    h += '</tbody></table><p><br></p>';
    insertHtmlAtCaret(h);
  }

  /* ---------- manual Bijoy button (pure-ASCII has no markers to detect) ---------- */
  function forceBijoy(ed) {
    if (!window.BijoyConverter || !window.BijoyConverter.forceHtmlMixed) return;
    try {
      ed.focus();
      var html = window.BijoyConverter.forceHtmlMixed(ed.innerHTML);
      if (!html || html === ed.innerHTML) return;
      try {
        if (document.execCommand('selectAll', false, null) &&
            document.execCommand('insertHTML', false, html)) return;
      } catch (e) {}
      ed.innerHTML = html;
    } catch (e2) {}
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
      var cd = null;
      try { cd = e.clipboardData || window.clipboardData; } catch (err) {}
      if (!cd || !cd.getData) return;
      var html = '';
      try { html = cd.getData('text/html'); } catch (err1) {}
      if (html) {
        /* formatted paste: allowlist close to server sanitizer, then Bijoy */
        var clean = sanitizePasteHtml(html);
        if (clean) {
          if (window.BijoyConverter && window.BijoyConverter.convertHtmlMixed) {
            try { clean = window.BijoyConverter.convertHtmlMixed(clean); } catch (err2) {}
          }
          e.preventDefault();
          insertHtmlAtCaret(clean);
          return;
        }
      }
      var text = '';
      try { text = cd.getData('text/plain'); } catch (err3) {}
      if (!text) return;
      e.preventDefault();
      try {
        if (document.execCommand('insertText', false, text)) return;
      } catch (err4) {}
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
      } catch (err5) {}
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
      if (act === 'bijoy') {
        forceBijoy(ed);
        saveRange();
        try { ed.focus(); } catch (e) {}
        return;
      }
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

  /* Static toolbar above every editor — desktop + mobile, same system.
     (Floating selection-bar on touch proved flaky: tapping it lost the
     selection/keyboard. Static bar + saved-range restore works on both.) */
  function editorOf(node) {
    while (node && node !== document) {
      if (node.className && String(node.className).indexOf('rich-editor') >= 0) return node;
      node = node.parentNode;
    }
    return null;
  }

  /* Touch keyboards rarely fire keyup/mouseup — keep the range fresh on
     every selection change, but only when it sits inside an editor. */
  document.addEventListener('selectionchange', function () {
    try {
      var sel = window.getSelection();
      if (sel && sel.rangeCount && !sel.getRangeAt(0).collapsed) {
        if (editorOf(sel.anchorNode)) saveRange();
      }
    } catch (e) {}
  });

  /* editors first (all devices) */
  forEachTarget(setupEditor);

  /* ---- static toolbar above each editor (all devices) ---- */
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
