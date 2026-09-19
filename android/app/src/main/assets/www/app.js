/* Hrd offline reader — ES5 only (Android 6 WebView safe). No network calls;
   data arrives via App.setData(base64) from native code. Hash routing. */
(function () {
  'use strict';
  var DATA = null;
  var LS_CHECK = 'hrd_check_v1';

  var PHASES = {
    'abedonpotrer-purbe': 'আবেদনপত্রের পূর্বে',
    'proshnopotrer-purbe': 'প্রশ্নপত্রের পূর্বে',
    'shopother-purbe': 'শপথের পূর্বে'
  };
  var NOTE_CATS = { 'alochona': 'আলোচনা নোট', 'boi': 'বই নোট' };
  var BIBIDH_CATS = {
    'ilmul-quran': 'ইলমূল কুরআন', 'ilmul-hadis': 'ইলমূল হাদিস',
    'ilmut-tajbid': 'ইলমুত তাজবীদ', 'masala-masayel': 'মাসআলা-মাসায়েল',
    'shane-nuzul': 'শানে নুযুল', 'jiboni': 'জীবনী', 'dibosh': 'দিবস',
    'motobad': 'মতবাদ', 'guruttopurno-ghotonaboli': 'গুরুত্বপূর্ণ ঘটনাবলী',
    'jatiyo-antorjatik': 'জাতীয় ও আন্তর্জাতিক', 'onnanno-proshno': 'অন্যান্য প্রশ্ন',
    'samprotik-proshno': 'সাম্প্রতিক প্রশ্ন',
    'likhito-porikkhar-proshno': 'লিখিত পরীক্ষার প্রশ্ন'
  };
  var SECTIONS = [
    { id: 'books', name: 'বই', fields: ['title', 'author', 'description'] },
    { id: 'notes', name: 'নোট', fields: ['title', 'subject', 'content'], cats: NOTE_CATS, phases: ['abedonpotrer-purbe', 'proshnopotrer-purbe'] },
    { id: 'dars', name: 'দারস', fields: ['title', 'content', 'reference'] },
    { id: 'duas', name: 'মাসনুন দুআ', fields: ['title', 'arabic', 'transliteration', 'content', 'reference'] },
    { id: 'ayathadith', name: 'আয়াত-হাদিস', fields: ['title', 'arabic', 'transliteration', 'translation', 'reference', 'topic'] },
    { id: 'surah', name: 'সূরা', fields: ['title', 'arabic', 'transliteration', 'translation', 'reference'] },
    { id: 'bibidh', name: 'বিবিধ', fields: ['title', 'content', 'reference'], cats: BIBIDH_CATS }
  ];
  var BN_DIG = '০১২৩৪৫৬৭৮৯';
  function bn(n) {
    return String(n).split('').map(function (c) { return BN_DIG[c] || c; }).join('');
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function $(id) { return document.getElementById(id); }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i]._id) === String(id)) return list[i];
    }
    return null;
  }
  function phaseName(p) { return PHASES[p] || p || ''; }

  /* ---------- data channel (native -> JS) ---------- */
  function utf8Decode(arr) {
    var out = '', i = 0;
    while (i < arr.length) {
      var c = arr[i++];
      if (c < 128) { out += String.fromCharCode(c); continue; }
      if ((c & 0xE0) === 0xC0 && i < arr.length) {
        var c2 = arr[i++];
        out += String.fromCharCode(((c & 0x1F) << 6) | (c2 & 0x3F));
        continue;
      }
      if ((c & 0xF0) === 0xE0 && i + 1 < arr.length) {
        var d2 = arr[i++], d3 = arr[i++];
        out += String.fromCharCode(((c & 0x0F) << 12) | ((d2 & 0x3F) << 6) | (d3 & 0x3F));
        continue;
      }
      i += 2; out += '�';
    }
    return out;
  }
  window.App = {
    setData: function (b64) {
      try {
        var bin = atob(String(b64).replace(/\s/g, ''));
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var obj = JSON.parse(utf8Decode(arr));
        applyData(obj);
      } catch (e) {
        setSync('ডাটা পড়া যায়নি।');
      }
    },
    setSync: function (msg) { setSync(msg); }
  };
  function applyData(obj) {
    if (!obj || !obj.version) return;
    if (DATA && DATA.version === obj.version) { paintSync(); return; }
    DATA = obj;
    state.f = {}; state.q = {};
    renderTabs();
    route();
    paintSync();
  }
  function paintSync() {
    if (!DATA) return;
    var total = 0, k;
    if (DATA.counts) for (k in DATA.counts) total += DATA.counts[k];
    var when = '';
    try { when = new Date(DATA.exportedAt).toLocaleDateString('bn-BD'); } catch (e) {}
    setSync('সব কন্টেন্ট ফোনেই আছে (' + bn(total) + 'টি)' + (when ? ' • আপডেট ' + when : ''));
  }
  function setSync(msg) {
    var el = $('syncLine');
    if (el) el.textContent = msg;
  }

  /* ---------- checklist (localStorage, offline) ---------- */
  function loadCheck() {
    try { return JSON.parse(localStorage.getItem(LS_CHECK) || '{}'); } catch (e) { return {}; }
  }
  function saveCheck(m) {
    try { localStorage.setItem(LS_CHECK, JSON.stringify(m)); } catch (e) {}
  }

  /* ---------- list state ---------- */
  var state = { f: {}, q: {} };

  function secOf(id) {
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === id) return SECTIONS[i];
    return null;
  }
  /* website parity: notes + bibidh always have one ধরন/বিষয় selected */
  function catOf(sec) {
    var f = state.f[sec.id] || {};
    if (f.c) return f.c;
    if (sec.id === 'notes') return 'alochona';
    if (sec.id === 'bibidh') return 'ilmul-quran';
    return null;
  }
  function matchPhase(sec, it) {
    var f = state.f[sec.id] || {};
    if (!f) return true;
    if (f.p && it.phase !== f.p) return false;
    var c = catOf(sec);
    if (c && it.category !== c) return false;
    if (f.k && it.kind !== f.k) return false;
    return true;
  }
  function matchQuery(sec, it) {
    var q = (state.q[sec.id] || '').toLowerCase();
    if (!q) return true;
    for (var i = 0; i < sec.fields.length; i++) {
      var v = String(it[sec.fields[i]] || '').toLowerCase();
      if (v.indexOf(q) >= 0) return true;
    }
    return false;
  }

  function metaLine(sec, it) {
    var h = '';
    if (sec.id === 'books' && it.author) h += '<div class="muted">' + esc(it.author) + '</div>';
    if (sec.id === 'notes') {
      h += '<div><span class="badge">' + esc(NOTE_CATS[it.category] || 'আলোচনা নোট') + '</span>' +
        (it.phase ? '<span class="badge">' + esc(phaseName(it.phase)) + '</span>' : '') +
        (it.subject ? '<span class="badge">' + esc(it.subject) + '</span>' : '') + '</div>';
    } else if (sec.id === 'ayathadith') {
      h += '<div><span class="badge">' + (it.kind === 'ayat' ? 'আয়াত' : 'হাদিস') + '</span>' +
        (it.topic ? '<span class="badge">' + esc(it.topic) + '</span>' : '') +
        (it.phase ? '<span class="badge">' + esc(phaseName(it.phase)) + '</span>' : '') + '</div>';
    } else if (sec.id === 'bibidh') {
      h += '<div><span class="badge">' + esc(BIBIDH_CATS[it.category] || it.category || '') + '</span></div>';
    } else if (sec.id === 'surah') {
      h += '<div>' + (it.ayahCount ? '<span class="badge">' + bn(it.ayahCount) + ' আয়াত</span>' : '') +
        (it.phase ? '<span class="badge">' + esc(phaseName(it.phase)) + '</span>' : '') + '</div>';
    } else if (it.phase) {
      h += '<div><span class="badge">' + esc(phaseName(it.phase)) + '</span>' +
        (it.reference ? '<span class="badge">' + esc(it.reference) + '</span>' : '') + '</div>';
    }
    return h;
  }

  function detailBody(sec, it) {
    var h = '<h3>' + esc(it.title) + '</h3>' + metaLine(sec, it);
    if (sec.id === 'surah') {
      /* site parity (surah.ejs): ayat-by-ayat arabic + উচ্চারণ + অর্থ */
      h += surahAyatHtml(it);
    } else {
      if (it.arabic) h += '<div class="arabic">' + esc(it.arabic) + '</div>';
      if (it.transliteration) h += '<div class="uchcharon"><strong>উচ্চারণ:</strong> ' + esc(it.transliteration) + '</div>';
      var body = it.content || it.translation || it.description || '';
      if (body) h += '<div class="content"><strong>অর্থ:</strong> ' + body + '</div>';
    }
    if (sec.id === 'books' && it.link) {
      var ok = /^https?:\/\//i.test(it.link);
      h += '<div style="margin-top:10px">' +
        (ok ? '<a class="btn" href="' + esc(it.link) + '">পড়ুন / ডাউনলোড</a>'
            : '<span class="muted">লিংক নেই</span>') + '</div>';
    }
    return h;
  }

  /* ---------- site parity: surah ayat-by-ayat (surah.ejs lines 38-47) ---------- */
  function splitLines(s) {
    return String(s == null ? '' : s).split(/\r?\n/);
  }
  function surahAyatHtml(it) {
    var h = '';
    var aRaw = splitLines(it.arabic);
    var aLines = [];
    for (var i = 0; i < aRaw.length; i++) {
      if (aRaw[i].replace(/^\s+|\s+$/g, '')) aLines.push(aRaw[i]);
    }
    if (!aLines.length) {
      if (it.transliteration) h += '<div class="uchcharon"><strong>উচ্চারণ:</strong> ' + esc(it.transliteration) + '</div>';
      if (it.translation) h += '<div class="content"><strong>অর্থ:</strong> ' + it.translation + '</div>';
      return h;
    }
    var tLines = splitLines(it.transliteration);
    var mLines = splitLines(it.translation);
    for (var j = 0; j < aLines.length; j++) {
      h += '<div class="ayat-card"><div class="ayat-head"><span class="badge">' + bn(j + 1) +
        '</span> <span class="muted">আয়াত ' + bn(j + 1) + '</span></div>' +
        '<div class="arabic">' + esc(aLines[j]) + '</div>';
      if (tLines[j] && tLines[j].replace(/^\s+|\s+$/g, '')) {
        h += '<div class="uchcharon"><strong>উচ্চারণ:</strong> ' + esc(tLines[j]) + '</div>';
      }
      if (mLines[j] && mLines[j].replace(/^\s+|\s+$/g, '')) {
        h += '<div class="ayat-meaning"><strong>অর্থ:</strong> ' + esc(mLines[j]) + '</div>';
      }
      h += '</div>';
    }
    return h;
  }

  /* ---------- site parity: ayat-hadith grouped by topic (ayathadith.js renderList) ---------- */
  function groupAyatHadith(list) {
    var groups = [], byTopic = {};
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var t = it.topic || 'সাধারণ';
      if (!byTopic[t]) {
        var g = { topic: t, ayat: [], hadis: [] };
        byTopic[t] = g;
        groups.push(g);
      }
      if (it.kind === 'hadis') byTopic[t].hadis.push(it);
      else byTopic[t].ayat.push(it);
    }
    return groups;
  }
  function ahItemHtml(it, tid, no, kindLabel) {
    var h = '<div class="card ah-item"><button class="ah-q" data-t="' + tid + '">' +
      '<span>' + bn(no) + '. ' + esc(it.title) + '</span><span class="chev">›</span></button>' +
      '<div id="' + tid + '" class="ah-a" style="display:none">' +
      '<div><span class="badge">' + kindLabel + '</span>' +
      (it.reference ? '<span class="muted">' + esc(it.reference) + '</span>' : '') + '</div>';
    if (it.arabic) h += '<div class="arabic">' + esc(it.arabic) + '</div>';
    if (it.transliteration) h += '<div class="uchcharon"><strong>উচ্চারণ:</strong> ' + esc(it.transliteration) + '</div>';
    if (it.translation) h += '<div class="content"><strong>অর্থ:</strong> ' + it.translation + '</div>';
    h += '<div style="margin-top:8px"><a class="back" href="#/ayathadith/' + it._id + '">স্থায়ী লিংক ›</a></div>';
    h += '</div></div>';
    return h;
  }

  /* ---------- views ---------- */
  function renderTabs() {
    var t = $('tabs'), h = '<button class="tab" data-r="#/">চেকলিস্ট</button>';
    for (var i = 0; i < SECTIONS.length; i++) {
      var n = DATA && DATA[SECTIONS[i].id] ? DATA[SECTIONS[i].id].length : 0;
      h += '<button class="tab" data-r="#/' + SECTIONS[i].id + '">' +
        esc(SECTIONS[i].name) + ' (' + bn(n) + ')</button>';
    }
    t.innerHTML = h;
    var btns = t.querySelectorAll('button');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function () {
        window.location.hash = this.getAttribute('data-r');
      });
    }
  }

  function markTabs(hash) {
    var t = $('tabs').querySelectorAll('button');
    for (var i = 0; i < t.length; i++) {
      var r = t[i].getAttribute('data-r');
      var on = (hash === '#/' || hash === '' || hash === '#') ? (r === '#/')
        : (r !== '#/' && hash.indexOf(r) === 0);
      if (on) t[i].className = 'tab on';
      else t[i].className = 'tab';
    }
  }

  function viewHome() {
    var v = $('view');
    if (!DATA || !DATA.checklist) { v.innerHTML = '<p class="empty">ডাটা লোড হচ্ছে…</p>'; return; }
    var phases = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    var cur = state.f.home || 'abedonpotrer-purbe';
    var h = '<div class="row">';
    for (var p = 0; p < phases.length; p++) {
      h += '<button class="chip' + (cur === phases[p] ? ' on' : '') + '" data-p="' + phases[p] + '">' +
        esc(PHASES[phases[p]]) + '</button>';
    }
    h += '</div>';
    var list = DATA.checklist[cur] || [];
    var saved = loadCheck()[cur] || {};
    var done = 0;
    for (var i = 0; i < list.length; i++) if (saved[i]) done++;
    var pct = list.length ? Math.round(done * 100 / list.length) : 0;
    h += '<div class="card"><div class="prog"><div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<span class="muted">' + bn(pct) + '%</span>' +
      '<button class="btn ghost" id="ckReset" style="padding:4px 12px;font-size:12.5px">রিসেট</button></div>' +
      '<div class="muted">' + bn(done) + '/' + bn(list.length) + ' সম্পন্ন</div></div>';
    h += '<div id="ckList">';
    var last = '', n = 0;
    for (var j = 0; j < list.length; j++) {
      if (list[j].c !== last) { n = 1; h += '<div class="check-cat">' + esc(list[j].c) + '</div>'; last = list[j].c; }
      else n++;
      h += '<label class="check-item"><input type="checkbox" data-i="' + j + '"' +
        (saved[j] ? ' checked' : '') + '> <span>' + bn(n) + '. ' + esc(list[j].t) + '</span></label>';
    }
    h += '</div>';
    v.innerHTML = h;
    var chips = v.querySelectorAll('[data-p]');
    for (var c = 0; c < chips.length; c++) {
      chips[c].addEventListener('click', function () {
        state.f.home = this.getAttribute('data-p');
        viewHome();
      });
    }
    var boxes = v.querySelectorAll('#ckList input');
    for (var b = 0; b < boxes.length; b++) {
      boxes[b].addEventListener('change', function () {
        var m = loadCheck();
        m[cur] = m[cur] || {};
        if (this.checked) m[cur][this.getAttribute('data-i')] = 1;
        else delete m[cur][this.getAttribute('data-i')];
        saveCheck(m);
        viewHome();
      });
    }
    $('ckReset').addEventListener('click', function () {
      var m = loadCheck();
      delete m[cur];
      saveCheck(m);
      viewHome();
    });
  }

  function filterChips(sec) {
    var h = '';
    var f = state.f[sec.id] || {};
    var phases = sec.phases || ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    if (sec.id !== 'bibidh') {
      h += '<div class="row"><button class="chip' + (!f.p ? ' on' : '') + '" data-fp="">সব পর্ব</button>';
      for (var i = 0; i < phases.length; i++) {
        h += '<button class="chip' + (f.p === phases[i] ? ' on' : '') + '" data-fp="' + phases[i] + '">' +
          esc(PHASES[phases[i]]) + '</button>';
      }
      h += '</div>';
    }
    /* website parity: notes ধরন + bibidh বিষয় use <select> dropdowns (note.ejs/bibidh.ejs) */
    if (sec.cats) {
      if (sec.id === 'notes' || sec.id === 'bibidh') {
        var cur = catOf(sec);
        var lab = sec.id === 'notes' ? 'ধরন নির্বাচন:' : 'বিষয় নির্বাচন:';
        h += '<div class="sel-row"><label class="sel-label" for="catSel">' + lab + '</label>' +
          '<select id="catSel" class="sel">';
        for (var c in sec.cats) {
          h += '<option value="' + c + '"' + (cur === c ? ' selected' : '') + '>' +
            esc(sec.cats[c]) + '</option>';
        }
        h += '</select></div>';
      } else {
        h += '<div class="row"><button class="chip' + (!f.c ? ' on' : '') + '" data-fc="">সব ধরন</button>';
        for (var c2 in sec.cats) {
          h += '<button class="chip' + (f.c === c2 ? ' on' : '') + '" data-fc="' + c2 + '">' +
            esc(sec.cats[c2]) + '</button>';
        }
        h += '</div>';
      }
    }
    if (sec.id === 'ayathadith') {
      h += '<div class="row"><button class="chip' + (!f.k ? ' on' : '') + '" data-fk="">সব</button>' +
        '<button class="chip' + (f.k === 'ayat' ? ' on' : '') + '" data-fk="ayat">আয়াত</button>' +
        '<button class="chip' + (f.k === 'hadis' ? ' on' : '') + '" data-fk="hadis">হাদিস</button></div>';
    }
    return h;
  }

  function viewList(sec) {
    var v = $('view');
    var list = DATA ? (DATA[sec.id] || []) : [];
    var h = '<input id="q" class="search" placeholder="খুঁজুন…" value="' + esc(state.q[sec.id] || '') + '">';
    h += filterChips(sec);
    if (sec.id === 'surah') { h += viewSurahList(list, sec); }
    else if (sec.id === 'ayathadith') { h += viewAyatHadithList(list, sec); }
    else {
      h += '<div id="rows">';
      var shown = 0;
      for (var i = 0; i < list.length; i++) {
        if (!matchPhase(sec, list[i]) || !matchQuery(sec, list[i])) continue;
        shown++;
        h += '<div class="card"><a class="t" href="#/' + sec.id + '/' + list[i]._id + '"><h3>' +
          bn(shown) + '. ' + esc(list[i].title) + '</h3></a>' + metaLine(sec, list[i]) + '</div>';
        if (shown >= 300) break;
      }
      if (!shown) h += '<p class="empty">কিছু পাওয়া যায়নি।</p>';
      h += '</div>';
    }
    v.innerHTML = h;
    wireChips(sec);
    wireAccordion(v);
    var catSel = document.getElementById('catSel');
    if (catSel) {
      catSel.addEventListener('change', function () {
        state.f[sec.id] = state.f[sec.id] || {};
        state.f[sec.id].c = this.value;
        viewList(sec);
      });
    }
    $('q').addEventListener('input', function () {
      state.q[sec.id] = this.value;
      var pos = this.selectionStart;
      viewList(sec);
      var q2 = $('q');
      q2.focus();
      try { q2.setSelectionRange(pos, pos); } catch (e) {}
    });
  }

  /* site parity: surah list = accordion, open = ayat-by-ayat cards (surah.ejs) */
  function viewSurahList(list, sec) {
    var h = '<div id="rows">';
    var shown = 0;
    for (var i = 0; i < list.length; i++) {
      if (!matchPhase(sec, list[i]) || !matchQuery(sec, list[i])) continue;
      shown++;
      var tid = 'surah-' + shown;
      h += '<div class="card ah-item"><button class="ah-q" data-t="' + tid + '">' +
        '<span>' + bn(shown) + '. ' + esc(list[i].title) + '</span><span class="chev">›</span></button>' +
        '<div id="' + tid + '" class="ah-a" style="display:none">' + metaLine(sec, list[i]) +
        surahAyatHtml(list[i]) +
        '<div style="margin-top:8px"><a class="back" href="#/surah/' + list[i]._id + '">স্থায়ী লিংক ›</a></div>' +
        '</div></div>';
      if (shown >= 300) break;
    }
    if (!shown) h += '<p class="empty">কোনো সূরা পাওয়া যায়নি।</p>';
    h += '</div>';
    return h;
  }

  /* site parity: ayat-hadith list = topic panels, ayat ১,২… then hadis ১,২… (ayat-hadith.ejs) */
  function viewAyatHadithList(list, sec) {
    var kept = [];
    for (var i = 0; i < list.length; i++) {
      if (matchPhase(sec, list[i]) && matchQuery(sec, list[i])) kept.push(list[i]);
    }
    var groups = groupAyatHadith(kept);
    var h = '<div id="rows">';
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi];
      h += '<div class="card topic"><h3>' + esc(g.topic) +
        ' <span class="badge">' + bn(g.ayat.length + g.hadis.length) + '</span></h3></div>';
      for (var a = 0; a < g.ayat.length; a++) {
        h += ahItemHtml(g.ayat[a], 'g' + gi + 'a' + a, a + 1, 'আয়াত');
      }
      for (var d = 0; d < g.hadis.length; d++) {
        h += ahItemHtml(g.hadis[d], 'g' + gi + 'h' + d, d + 1, 'হাদিস');
      }
    }
    if (!kept.length) h += '<p class="empty">কোনো আয়াত/হাদিস পাওয়া যায়নি। অন্য পর্ব বা ধরন চেষ্টা করুন।</p>';
    h += '</div>';
    return h;
  }

  function wireAccordion(v) {
    var btns = v.querySelectorAll('[data-t]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var el = document.getElementById(this.getAttribute('data-t'));
        if (!el) return;
        el.style.display = (el.style.display === 'none') ? 'block' : 'none';
      });
    }
  }

  function wireChips(sec) {
    function each(sel, attr, key) {
      var els = $('view').querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) {
        els[i].addEventListener('click', function () {
          state.f[sec.id] = state.f[sec.id] || {};
          var val = this.getAttribute(attr);
          if (!val) delete state.f[sec.id][key];
          else state.f[sec.id][key] = val;
          viewList(sec);
        });
      }
    }
    each('[data-fp]', 'data-fp', 'p');
    each('[data-fc]', 'data-fc', 'c');
    each('[data-fk]', 'data-fk', 'k');
  }

  function viewDetail(sec, id) {
    var v = $('view');
    var it = DATA ? byId(DATA[sec.id] || [], id) : null;
    if (!it) { v.innerHTML = '<p class="empty">পাওয়া যায়নি।</p>'; return; }
    v.innerHTML = '<a class="back" href="#/' + sec.id + '">← ' + esc(sec.name) + '</a>' +
      '<div class="card">' + detailBody(sec, it) + '</div>';
  }

  function route() {
    var hash = window.location.hash || '#/';
    markTabs(hash);
    var m = hash.match(/^#\/([a-z-]+)(?:\/([a-f0-9]+))?/);
    if (!m) { viewHome(); return; }
    var sec = secOf(m[1]);
    if (!sec) { viewHome(); return; }
    if (m[2]) viewDetail(sec, m[2]);
    else viewList(sec);
  }

  /* ---------- boot ---------- */
  window.addEventListener('hashchange', route);
  $('refreshBtn').addEventListener('click', function () {
    if (window.Android && window.Android.refresh) {
      try { window.Android.refresh(); return; } catch (e) {}
    }
    setSync('অ্যাপ থেকে রিফ্রেশ করুন।');
  });
  renderTabs();
  route();
})();
