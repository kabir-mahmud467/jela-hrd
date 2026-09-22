/* Hrd offline reader — ES5 only (Android 6 WebView safe). No network calls;
   data arrives via App.setData(base64) from native code. Hash routing. */
(function () {
  'use strict';
  var DATA = null;
  var LS_CHECK = 'hrd_check_v1';
  /* in-app panels: content offline, login/save/admin needs internet (no outside URL) */
  var SITE = 'https://hrd.kabirmahmud.xyz';
  var LS_AUTH = 'hrd_auth_v1';
  var LS_THEME = 'hrd_theme_v1';

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
    { id: 'audiobooks', name: 'অডিওবুক', fields: ['title', 'author'] },
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
    setSync: function (msg) { setSync(msg); },
    /* update prompt: native calls setUpdate('1') when server version is newer.
       Banner shows; tap pulls fresh content (no APK re-download). */
    setUpdate: function (on) {
      var bar = document.getElementById('updateBar');
      if (bar) bar.style.display = (String(on) === '1') ? 'flex' : 'none';
    }
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
    if (sec.id === 'books' || sec.id === 'audiobooks') {
      h += '<div>' +
        (it.author ? '<div class="muted">' + esc(it.author) + '</div>' : '') +
        (it.phase ? '<span class="badge">' + esc(phaseName(it.phase)) + '</span>' : '') + '</div>';
    }
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

  /* site parity: every list opens inline (dropdown) with FULL content —
     books.ejs / audiobooks.ejs / note.ejs / dua.ejs / bibidh.ejs show all
     inside the accordion; dars shows full text too (no excerpt link). */
  function extLink(url) {
    return /^https?:\/\//i.test(url || '');
  }
  function fullBody(sec, it) {
    var h = '';
    if (sec.id === 'books') {
      if (it.description) h += '<div class="content">' + it.description + '</div>';
      h += '<div class="row" style="margin-top:10px">' +
        (extLink(it.link) ? '<a class="btn" href="' + esc(it.link) + '">পড়ুন / ডাউনলোড</a>'
          : '<span class="muted">লিংক নেই</span>') + '</div>';
    } else if (sec.id === 'audiobooks') {
      h += '<div class="row" style="margin-top:10px">' +
        (extLink(it.audioLink) ? '<a class="btn" href="' + esc(it.audioLink) + '">অডিও শুনুন</a>'
          : '<span class="muted">লিংক নেই</span>') + '</div>';
    } else if (sec.id === 'notes' || sec.id === 'dars' || sec.id === 'bibidh') {
      if (it.content) h += '<div class="content">' + it.content + '</div>';
    } else if (sec.id === 'duas') {
      if (it.arabic) h += '<div class="arabic">' + esc(it.arabic) + '</div>';
      if (it.transliteration) h += '<div class="uchcharon"><strong>উচ্চারণ:</strong> ' + esc(it.transliteration) + '</div>';
      if (it.content) h += '<div class="content"><strong>অর্থ:</strong> ' + it.content + '</div>';
    } else if (sec.id === 'surah') {
      h += surahAyatHtml(it);
    } else if (sec.id === 'ayathadith') {
      if (it.arabic) h += '<div class="arabic">' + esc(it.arabic) + '</div>';
      if (it.transliteration) h += '<div class="uchcharon"><strong>উচ্চারণ:</strong> ' + esc(it.transliteration) + '</div>';
      if (it.translation) h += '<div class="content"><strong>অর্থ:</strong> ' + it.translation + '</div>';
    }
    return h;
  }

  function detailBody(sec, it) {
    return '<h3>' + esc(it.title) + '</h3>' + metaLine(sec, it) + fullBody(sec, it);
  }

  /* generic inline accordion card (dropdown like the site qa-item) */
  function accItem(sec, it, tid, no) {
    return '<div class="card ah-item"><button class="ah-q" data-t="' + tid + '">' +
      '<span>' + bn(no) + '. ' + esc(it.title) + '</span><span class="chev">›</span></button>' +
      '<div id="' + tid + '" class="ah-a" style="display:none">' +
      metaLine(sec, it) + fullBody(sec, it) + '</div></div>';
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
    /* single login nav (no extra admin nav): the credentials decide —
       user sees the account dashboard, admin sees the admin panel. */
    var au = loadAuth();
    var accLink = 'login', accName = 'লগিন';
    if (au && au.token && au.role === 'admin') { accLink = 'admin'; accName = 'অ্যাডমিন'; }
    else if (au && au.token) { accLink = 'account'; accName = 'অ্যাকাউন্ট'; }
    h += '<button class="tab" data-r="#/' + accLink + '">' + esc(accName) + '</button>';
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
    /* single auth tab covers login + account + admin hashes */
    var authHash = hash.indexOf('#/login') === 0 || hash.indexOf('#/account') === 0 || hash.indexOf('#/admin') === 0;
    for (var i = 0; i < t.length; i++) {
      var r = t[i].getAttribute('data-r');
      var on;
      if (authHash) on = (r === '#/login' || r === '#/account' || r === '#/admin');
      else on = (hash === '#/' || hash === '' || hash === '#') ? (r === '#/')
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
        h += accItem(sec, list[i], sec.id + '-' + shown, shown);
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
        surahAyatHtml(list[i]) + '</div></div>';
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
    if (hash.indexOf('#/login') === 0) { viewLogin(); return; }
    if (hash.indexOf('#/account') === 0) {
      var __au = loadAuth();
      if (__au && __au.role === 'admin') { window.location.hash = '#/admin'; return; }
      viewAccount();
      return;
    }
    if (hash.indexOf('#/admin') === 0) { viewAdminPanel(); return; }
    var m = hash.match(/^#\/([a-z-]+)(?:\/([a-f0-9]+))?/);
    if (!m) { viewHome(); return; }
    var sec = secOf(m[1]);
    if (!sec) { viewHome(); return; }
    if (m[2]) viewDetail(sec, m[2]);
    else viewList(sec);
  }

  /* ---------- in-app auth (needs internet; content stays offline) ---------- */
  function loadAuth() {
    try { return JSON.parse(localStorage.getItem(LS_AUTH) || 'null'); } catch (e) { return null; }
  }
  function saveAuth(a) {
    try {
      if (a) localStorage.setItem(LS_AUTH, JSON.stringify(a));
      else localStorage.removeItem(LS_AUTH);
    } catch (e) {}
  }
  /* ES5 XHR (Android 6 WebView safe — no fetch dependency) */
  function apiPost(path, body, cb) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', SITE + path, true);
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var obj = null;
        try { obj = JSON.parse(xhr.responseText); } catch (e) {}
        cb(xhr.status >= 200 && xhr.status < 300 ? null : (obj && obj.error) || ('http' + xhr.status), obj);
      };
      xhr.onerror = function () { cb('offline', null); };
      xhr.timeout = 25000;
      xhr.ontimeout = function () { cb('offline', null); };
      xhr.send(JSON.stringify(body || {}));
    } catch (e) {
      cb('offline', null);
    }
  }
  function apiGet(path, cb) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', SITE + path, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var obj = null;
        try { obj = JSON.parse(xhr.responseText); } catch (e) {}
        cb(xhr.status >= 200 && xhr.status < 300 ? null : (obj && obj.error) || ('http' + xhr.status), obj);
      };
      xhr.onerror = function () { cb('offline', null); };
      xhr.timeout = 25000;
      xhr.ontimeout = function () { cb('offline', null); };
      xhr.send();
    } catch (e) {
      cb('offline', null);
    }
  }
  function authFormHtml(title, sub, role) {
    return '<div class="card"><h3>' + esc(title) + '</h3>' +
      '<p class="muted">' + esc(sub) + '</p>' +
      '<div id="authErr" class="auth-err" style="display:none"></div>' +
      '<label class="fld">ইউজারনেম<input id="auUser" class="search" placeholder="ইউজারনেম" autocomplete="username"></label>' +
      '<label class="fld">পাসওয়ার্ড<input id="auPass" type="password" class="search" placeholder="পাসওয়ার্ড" autocomplete="current-password"></label>' +
      '<button id="auGo" class="btn">লগিন' + (role === 'both' ? '' : ' (' + esc(role === 'admin' ? 'অ্যাডমিন' : 'ইউজার') + ')') + '</button>' +
      '<p class="muted">লগিন/সেভ/অ্যাডমিনে ইন্টারনেট লাগবে — কন্টেন্ট অফলাইনেই থাকে।</p></div>';
  }
  function showAuthErr(m) {
    var el = $('authErr');
    if (el) { el.style.display = 'block'; el.textContent = m; }
  }
  /* Single login form: credentials decide the dashboard — a user gets
     the account page, an admin gets the admin panel. No separate nav. */
  function viewLogin() {
    var v = $('view');
    var au = loadAuth();
    if (au && au.token && au.role === 'admin') { window.location.hash = '#/admin'; return; }
    if (au && au.token) { window.location.hash = '#/account'; return; }
    v.innerHTML = authFormHtml('লগিন', 'ইউজারনেম ও পাসওয়ার্ড দিন — ইউজার হলে অ্যাকাউন্ট, অ্যাডমিন হলে প্যানেল খুলবে।', 'both');
    $('auGo').addEventListener('click', function () {
      var u = $('auUser').value, p = $('auPass').value;
      if (!u || !p) { showAuthErr('ইউজারনেম ও পাসওয়ার্ড দিন।'); return; }
      var btn = $('auGo');
      if (btn) btn.disabled = true;
      apiPost('/api/user/login', { username: u, password: p }, function (err, obj) {
        if (!err && obj && obj.token) {
          saveAuth({ role: 'user', token: obj.token, username: obj.user.username, name: obj.user.name || '' });
          /* server progress merges into local checklist */
          try {
            var m = JSON.parse(localStorage.getItem(LS_CHECK) || '{}');
            var sp = obj.user.progress || {};
            for (var ph in sp) {
              m[ph] = m[ph] || {};
              for (var k in sp[ph]) if (sp[ph][k]) m[ph][k] = 1;
            }
            localStorage.setItem(LS_CHECK, JSON.stringify(m));
          } catch (e) {}
          renderTabs();
          window.location.hash = '#/account';
          return;
        }
        if (err === 'offline') {
          if (btn) btn.disabled = false;
          showAuthErr('ইন্টারনেট নেই — সংযোগ চালু করে আবার চেষ্টা করুন।');
          return;
        }
        /* not a user — try admin credentials before giving up */
        apiPost('/api/admin/login', { username: u, password: p }, function (err2, obj2) {
          if (btn) btn.disabled = false;
          if (!err2 && obj2 && obj2.token) {
            saveAuth({ role: 'admin', token: obj2.token, username: obj2.username, name: obj2.username });
            renderTabs();
            window.location.hash = '#/admin';
            return;
          }
          showAuthErr((err2 === 'offline') ? 'ইন্টারনেট নেই — সংযোগ চালু করে আবার চেষ্টা করুন।' : 'ভুল ইউজারনেম বা পাসওয়ার্ড!');
        });
      });
    });
  }
  /* Account: profile (name/phone/username) + progress + password change.
     Stored passwords are hashed — they can never be shown, only changed. */
  function viewAccount() {
    var v = $('view');
    var au = loadAuth();
    if (!au || !au.token || au.role === 'admin') {
      window.location.hash = (au && au.role === 'admin') ? '#/admin' : '#/login';
      return;
    }
    v.innerHTML = '<div class="card"><h3>অ্যাকাউন্ট</h3>' +
      '<p class="muted" id="accSync">লোড হচ্ছে…</p></div><div id="accBody"></div>';
    apiGet('/api/user/me?token=' + encodeURIComponent(au.token), function (err, obj) {
      var body = $('accBody');
      if (!body) return;
      if (err || !obj || !obj.user) {
        body.innerHTML = '<div class="card"><p class="muted">' +
          (err === 'offline' ? 'ইন্টারনেট নেই — সংযোগ চালু করে আবার চেষ্টা করুন।' : 'সেশন শেষ — আবার লগিন করুন।') +
          '</p><div class="row"><button id="accOut2" class="btn ghost">লগআউট</button></div></div>';
        var o2 = $('accOut2');
        if (o2) o2.addEventListener('click', function () {
          saveAuth(null); renderTabs(); window.location.hash = '#/';
        });
        var s0 = $('accSync');
        if (s0) s0.textContent = 'লোড হয়নি।';
        return;
      }
      var u = obj.user;
      var local = {};
      try { local = JSON.parse(localStorage.getItem(LS_CHECK) || '{}'); } catch (e) { local = {}; }
      var phases = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
      var h = '<div class="card"><h3>' + esc(u.name || u.username) + '</h3>' +
        '<p class="muted">ইউজারনেম: <b>' + esc(u.username) + '</b></p>' +
        '<p class="muted">ফোন: <b>' + esc(u.phone || '—') + '</b></p><div class="adm-sec">';
      var grand = 0, grandTot = 0;
      for (var i = 0; i < phases.length; i++) {
        var ph = phases[i];
        var sp = (u.progress && u.progress[ph]) || {};
        var lp = local[ph] || {};
        var done = 0, k;
        for (k in sp) if (sp[k]) done++;
        for (k in lp) if (lp[k] && !sp[k]) done++;
        var tot = (DATA && DATA.checklist && DATA.checklist[ph]) ? DATA.checklist[ph].length : 0;
        grand += done; grandTot += tot;
        var pct = tot ? Math.round(done * 100 / tot) : 0;
        h += '<div class="prog" style="margin-top:6px"><div class="bar"><i style="width:' + pct + '%"></i></div>' +
          '<span class="muted">' + esc(PHASES[ph]) + ' ' + bn(done) + '/' + bn(tot) + '</span></div>';
      }
      h += '</div><p class="muted">মোট অগ্রগতি: ' + bn(grand) + '/' + bn(grandTot) + '</p>' +
        '<div class="row"><button id="accPush" class="btn">অগ্রগতি সেভ করুন</button>' +
        '<button id="accOut" class="btn ghost">লগআউট</button></div>' +
        '<p class="muted" id="accSync2">চেকলিস্ট টিক ফোনে থাকে; সেভ চাপলে সার্ভারে যায়।</p></div>';
      h += '<div class="card"><h3>পাসওয়ার্ড বদলান</h3>' +
        '<p class="muted">নিরাপত্তার জন্য পাসওয়ার্ড দেখানো হয় না — শুধু বদলানো যায়।</p>' +
        '<div id="pwErr" class="adm-err" style="display:none"></div>' +
        '<label class="fld">বর্তমান পাসওয়ার্ড<input id="pwCur" type="password" autocomplete="current-password"></label>' +
        '<label class="fld">নতুন পাসওয়ার্ড (কমপক্ষে ৪ অক্ষর)<input id="pwNew" type="password" autocomplete="new-password"></label>' +
        '<button id="pwGo" class="btn">পাসওয়ার্ড সেভ করুন</button></div>';
      body.innerHTML = h;
      var s = $('accSync');
      if (s) s.textContent = 'সার্ভারের সাথে যুক্ত।';
      $('accOut').addEventListener('click', function () {
        saveAuth(null); renderTabs(); window.location.hash = '#/';
      });
      $('accPush').addEventListener('click', function () {
        var m = {};
        try { m = JSON.parse(localStorage.getItem(LS_CHECK) || '{}'); } catch (e2) { m = {}; }
        apiPost('/api/user/progress', { token: au.token, progress: m }, function (err2) {
          var t = $('accSync2');
          if (t) t.textContent = err2 ? (err2 === 'offline' ? 'ইন্টারনেট নেই — ফোনে সংরক্ষিত আছে।' : 'সেভ হয়নি — আবার চেষ্টা করুন।') : 'সেভ হয়েছে।';
        });
      });
      $('pwGo').addEventListener('click', function () {
        var c = $('pwCur').value, nw = $('pwNew').value;
        var e = $('pwErr');
        if (!c || !nw) {
          e.style.display = 'block'; e.textContent = 'দুটো ঘরই পূরণ করুন।'; return;
        }
        apiPost('/api/user/password', { token: au.token, currentPassword: c, newPassword: nw }, function (err3, obj3) {
          if (err3 || !obj3 || !obj3.ok) {
            e.style.display = 'block';
            e.textContent = err3 === 'offline' ? 'ইন্টারনেট নেই।'
              : (typeof err3 === 'string' && err3.slice(0, 4) === 'http' ? 'বদলানো যায়নি — আবার চেষ্টা করুন।' : err3);
            return;
          }
          e.style.display = 'none';
          au.token = obj3.token; saveAuth(au);
          $('pwCur').value = ''; $('pwNew').value = '';
          var t2 = $('accSync2');
          if (t2) t2.textContent = 'পাসওয়ার্ড বদলে গেছে।';
        });
      });
    });
  }
  function viewAdminPanel() {
    var v = $('view');
    var au = loadAuth();
    /* No separate admin login — one login nav; credentials decide. */
    if (!au || au.role !== 'admin' || !au.token) {
      window.location.hash = '#/login';
      return;
    }
    admSec = '__home';
    admEdit = null;
    admListQuery = '';
    admUserCache = null;
    admUserSel = null;
    admUserQ = '';
    v.innerHTML = '<div class="adm-head"><div><div class="adm-head-t">অ্যাডমিন প্যানেল</div>' +
      '<div class="muted">' + esc(au.username) + ' · <span id="admSync">সার্ভারের সাথে যুক্ত</span></div></div>' +
      '<span class="row" style="margin:0"><button id="admSyncBtn" class="btn small">সিংক</button>' +
      '<button id="admOut" class="btn small ghost">লগআউট</button></span></div>' +
      '<div id="admNav" class="adm-nav"></div><div id="admBody"></div>';
    $('admOut').addEventListener('click', function () {
      saveAuth(null);
      renderTabs();
      window.location.hash = '#/';
    });
    var sb = $('admSyncBtn');
    if (sb) sb.addEventListener('click', function () { refreshContent(); });
    admRenderNav();
    admRenderSec();
  }

  /* ----- full admin panel: same sections as the site, full CRUD ----- */
  var ADM_SECS = [
    { type: '__home', name: 'সারসংক্ষেপ' },
    { type: 'books', name: 'বই' },
    { type: 'audiobooks', name: 'অডিওবুক' },
    { type: 'notes', name: 'নোট' },
    { type: 'dars', name: 'দারস' },
    { type: 'duas', name: 'মাসনুন দুআ' },
    { type: 'ayathadith', name: 'আয়াত-হাদিস' },
    { type: 'surah', name: 'সূরা' },
    { type: 'bibidh', name: 'বিবিধ' },
    { type: '__users', name: 'ইউজার' }
  ];
  var admSec = '__home';
  var admCache = {};
  var admEdit = null;
  var ADM_PHASE3 = [['abedonpotrer-purbe', 'আবেদনপত্রের পূর্বে'], ['proshnopotrer-purbe', 'প্রশ্নপত্রের পূর্বে'], ['shopother-purbe', 'শপথের পূর্বে']];
  var ADM_PHASE2 = [['abedonpotrer-purbe', 'আবেদনপত্রের পূর্বে'], ['proshnopotrer-purbe', 'প্রশ্নপত্রের পূর্বে']];
  var ADM_NOTE_CATS = [['alochona', 'আলোচনা নোট'], ['boi', 'বই নোট']];
  var ADM_BIBIDH_CATS = [['ilmul-quran', 'ইলমূল কুরআন'], ['ilmul-hadis', 'ইলমূল হাদিস'], ['ilmut-tajbid', 'ইলমুত তাজবীদ'], ['masala-masayel', 'মাসআলা-মাসায়েল'], ['shane-nuzul', 'শানে নুযুল'], ['jiboni', 'জীবনী'], ['dibosh', 'দিবস'], ['motobad', 'মতবাদ'], ['guruttopurno-ghotonaboli', 'গুরুত্বপূর্ণ ঘটনাবলী'], ['jatiyo-antorjatik', 'জাতীয় ও আন্তর্জাতিক'], ['onnanno-proshno', 'অন্যান্য প্রশ্ন'], ['samprotik-proshno', 'সাম্প্রতিক প্রশ্ন'], ['likhito-porikkhar-proshno', 'লিখিত পরীক্ষার প্রশ্ন']];
  var ADM_KINDS = [['ayat', 'আয়াত'], ['hadis', 'হাদিস']];
  /* t: text | area | sel — mirrors the site's validateBody requirements */
  var FIELD_DEFS = {
    books: [
      { k: 'title', label: 'শিরোনাম', t: 'text', req: 1 },
      { k: 'author', label: 'লেখক', t: 'text' },
      { k: 'link', label: 'লিংক (http/https)', t: 'text', req: 1 },
      { k: 'phase', label: 'পর্ব', t: 'sel', opts: 'P3' },
      { k: 'category', label: 'ক্যাটাগরি', t: 'text' },
      { k: 'description', label: 'বিস্তারিত', t: 'area' }
    ],
    audiobooks: [
      { k: 'title', label: 'শিরোনাম', t: 'text', req: 1 },
      { k: 'author', label: 'লেখক', t: 'text' },
      { k: 'audioLink', label: 'অডিও লিংক (http/https)', t: 'text', req: 1 },
      { k: 'phase', label: 'পর্ব', t: 'sel', opts: 'P3' }
    ],
    notes: [
      { k: 'title', label: 'শিরোনাম', t: 'text', req: 1 },
      { k: 'category', label: 'ধরন', t: 'sel', opts: 'NC' },
      { k: 'phase', label: 'পর্ব', t: 'sel', opts: 'P2' },
      { k: 'content', label: 'বিস্তারিত', t: 'area', req: 1 }
    ],
    dars: [
      { k: 'title', label: 'শিরোনাম', t: 'text', req: 1 },
      { k: 'content', label: 'বিস্তারিত', t: 'area', req: 1 },
      { k: 'reference', label: 'রেফারেন্স', t: 'text' },
      { k: 'phase', label: 'পর্ব', t: 'sel', opts: 'P3' }
    ],
    duas: [
      { k: 'title', label: 'শিরোনাম', t: 'text', req: 1 },
      { k: 'arabic', label: 'আরবি', t: 'area' },
      { k: 'transliteration', label: 'উচ্চারণ', t: 'area' },
      { k: 'content', label: 'অর্থ/ব্যাখ্যা', t: 'area', req: 1 },
      { k: 'reference', label: 'রেফারেন্স', t: 'text' },
      { k: 'phase', label: 'পর্ব', t: 'sel', opts: 'P3' }
    ],
    ayathadith: [
      { k: 'title', label: 'শিরোনাম', t: 'text', req: 1 },
      { k: 'kind', label: 'ধরন', t: 'sel', opts: 'K' },
      { k: 'topic', label: 'বিষয়', t: 'text' },
      { k: 'arabic', label: 'আরবি', t: 'area' },
      { k: 'transliteration', label: 'উচ্চারণ', t: 'area' },
      { k: 'translation', label: 'অর্থ', t: 'area', req: 1 },
      { k: 'reference', label: 'রেফারেন্স', t: 'text' },
      { k: 'phase', label: 'পর্ব', t: 'sel', opts: 'P3' }
    ],
    surah: [
      { k: 'title', label: 'শিরোনাম', t: 'text', req: 1 },
      { k: 'arabic', label: 'আরবি', t: 'area' },
      { k: 'transliteration', label: 'উচ্চারণ', t: 'area' },
      { k: 'translation', label: 'অর্থ', t: 'area', req: 1 },
      { k: 'reference', label: 'রেফারেন্স', t: 'text' },
      { k: 'phase', label: 'পর্ব', t: 'sel', opts: 'P3' }
    ],
    bibidh: [
      { k: 'title', label: 'শিরোনাম', t: 'text', req: 1 },
      { k: 'category', label: 'বিষয়', t: 'sel', opts: 'BC' },
      { k: 'content', label: 'বিস্তারিত', t: 'area', req: 1 },
      { k: 'reference', label: 'রেফারেন্স', t: 'text' }
    ]
  };
  function admOpts(name) {
    if (name === 'P3') return ADM_PHASE3;
    if (name === 'P2') return ADM_PHASE2;
    if (name === 'NC') return ADM_NOTE_CATS;
    if (name === 'BC') return ADM_BIBIDH_CATS;
    return ADM_KINDS;
  }
  function admSecName(type) {
    for (var i = 0; i < ADM_SECS.length; i++) if (ADM_SECS[i].type === type) return ADM_SECS[i].name;
    return type;
  }
  function admToken() {
    var au = loadAuth();
    return (au && au.token) || '';
  }
  function refreshContent() {
    try {
      if (window.Android && window.Android.refresh) { window.Android.refresh(); return; }
    } catch (e) {}
    setSync('সেভ হয়েছে — রিফ্রেশ করলে নতুন কন্টেন্ট আসবে।');
  }
  function admRenderNav() {
    var n = $('admNav');
    if (!n) return;
    var h = '';
    for (var i = 0; i < ADM_SECS.length; i++) {
      h += '<button class="chip' + (admSec === ADM_SECS[i].type ? ' on' : '') + '" data-as="' + ADM_SECS[i].type + '">' +
        esc(ADM_SECS[i].name) + '</button>';
    }
    n.innerHTML = h;
    var btns = n.querySelectorAll('[data-as]');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function () {
        admSec = this.getAttribute('data-as');
        admEdit = null;
        admListQuery = '';
        if (admSec !== '__users') admUserSel = null;
        admRenderNav();
        admRenderSec();
      });
    }
  }
  function admRenderSec() {
    if (!$('admBody')) return;
    if (admSec === '__home') admOverview();
    else if (admSec === '__users') admUsers();
    else if (admEdit) admForm(admEdit.type, admEdit.item || null);
    else admSection(admSec);
  }
  function admOverview() {
    var body = $('admBody');
    body.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে…</p></div>';
    apiGet('/api/admin/overview?token=' + encodeURIComponent(admToken()), function (err, obj) {
      var b = $('admBody');
      if (!b) return;
      if (err || !obj || !obj.counts) {
        b.innerHTML = '<div class="card"><p class="muted">' +
          (err === 'offline' ? 'ইন্টারনেট নেই — কন্টেন্ট অফলাইনে দেখুন।' : 'লোড হয়নি।') + '</p>' +
          '<div class="row"><button id="admRetry" class="btn">আবার চেষ্টা করুন</button></div></div>';
        var rt = $('admRetry');
        if (rt) rt.addEventListener('click', function () { admRenderSec(); });
        return;
      }
      var c = obj.counts;
      var total = c.books + c.audiobooks + c.notes + c.dars + c.duas + c.ayathadith + c.surah + c.bibidh;
      var cards = [
        ['books', 'বই', c.books], ['audiobooks', 'অডিও', c.audiobooks],
        ['notes', 'নোট', c.notes], ['dars', 'দারস', c.dars],
        ['duas', 'দুআ', c.duas], ['ayathadith', 'আয়াত', c.ayathadith],
        ['surah', 'সূরা', c.surah], ['bibidh', 'বিবিধ', c.bibidh]
      ];
      var h = '<div class="adm-hero"><div><div class="adm-hero-t">সারসংক্ষেপ</div>' +
        '<div class="adm-hero-n">' + bn(total) + 'টি কন্টেন্ট · ' + bn(c.users) + ' জন ইউজার</div></div>' +
        '<button id="admSyncNow" class="btn small">সিংক করুন</button></div>';
      h += '<div class="adm-grid">';
      for (var i = 0; i < cards.length; i++) {
        h += '<button class="adm-stat" data-go="' + cards[i][0] + '">' +
          '<span class="adm-stat-n">' + bn(cards[i][2]) + '</span>' +
          '<span class="adm-stat-l">' + esc(cards[i][1]) + '</span>' +
          '<span class="adm-stat-go">খুলুন ›</span></button>';
      }
      h += '<button class="adm-stat users" data-go="__users">' +
        '<span class="adm-stat-n">' + bn(c.users) + '</span>' +
        '<span class="adm-stat-l">ইউজার</span><span class="adm-stat-go">অগ্রগতি ›</span></button></div>';
      h += '<div class="card"><h3>দ্রুত কাজ</h3><div class="row">' +
        '<button class="btn small" data-go="__users">ইউজার দেখুন</button>' +
        '<button class="btn small ghost" data-go="books">বই যোগ করুন</button>' +
        '<button class="btn small ghost" data-go="notes">নোট যোগ করুন</button></div>' +
        '<p class="muted">কন্টেন্ট যোগ/এডিট/ডিলিট করলে সিংক চাপুন — ফোনের অফলাইন কপি আপডেট হবে। ইউজার এডিটে সিংকের দরকার নেই।</p></div>';
      b.innerHTML = h;
      var go = b.querySelectorAll('[data-go]');
      for (var j = 0; j < go.length; j++) {
        go[j].addEventListener('click', function () {
          admSec = this.getAttribute('data-go');
          admEdit = null;
          admRenderNav();
          admRenderSec();
        });
      }
      var sn = $('admSyncNow');
      if (sn) sn.addEventListener('click', function () { refreshContent(); });
    });
  }
  function admSection(type) {
    var body = $('admBody');
    var items = admCache[type];
    if (items) {
      body.innerHTML = admListHtml(type, items);
      admWireList(type);
      return;
    }
    body.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে…</p></div>';
    apiGet('/api/admin/content?token=' + encodeURIComponent(admToken()) + '&type=' + type, function (err, obj) {
      var b = $('admBody');
      if (!b) return;
      if (err || !obj || !obj.items) {
        b.innerHTML = '<div class="card"><p class="muted">' + (err === 'offline' ? 'ইন্টারনেট নেই।' : 'লোড হয়নি।') +
          '</p><div class="row"><button id="admRetry" class="btn">আবার চেষ্টা করুন</button></div></div>';
        $('admRetry').addEventListener('click', function () { admRenderSec(); });
        return;
      }
      admCache[type] = obj.items || [];
      b.innerHTML = admListHtml(type, admCache[type]);
      admWireList(type);
    });
  }
  var admListQuery = '';
  function admFilteredItems(type) {
    var items = admCache[type] || [];
    var q = (admListQuery || '').toLowerCase();
    if (!q) return items;
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var hay = String(it.title || '') + ' ' + String(it.author || '') + ' ' +
        String(it.topic || '') + ' ' + String(it.reference || '');
      if (hay.toLowerCase().indexOf(q) >= 0) out.push(it);
    }
    return out;
  }
  function admListHtml(type, items) {
    var shown = admFilteredItems(type);
    var h = '<div class="adm-bar"><span class="adm-count">' + bn(shown.length) + '/' + bn(items.length) + 'টি</span>' +
      '<input id="admSearch" class="adm-search" placeholder="খুঁজুন…" value="' + esc(admListQuery || '') + '">' +
      '<button class="btn small danger" data-ab="bulk">সিলেক্ট ডিলিট</button>' +
      '<button class="btn small" data-ab="add">+ নতুন</button></div><div class="card adm-list">';
    for (var i = 0; i < shown.length; i++) {
      var it = shown[i];
      var realIdx = (admCache[type] || []).indexOf(it);
      h += '<div class="adm-row"><input type="checkbox" class="adm-check" value="' + esc(it._id) + '" aria-label="সিলেক্ট">' +
        '<span class="adm-title">' + esc(it.title || '(শিরোনাম নেই)') +
        (it.author ? ' <span class="muted">· ' + esc(it.author) + '</span>' : '') + '</span>' +
        '<span class="adm-acts">' +
        '<button class="btn small ghost" data-ab="up" data-i="' + realIdx + '" title="উপরে">▲</button>' +
        '<button class="btn small ghost" data-ab="down" data-i="' + realIdx + '" title="নিচে">▼</button>' +
        '<button class="btn small" data-ab="edit" data-i="' + realIdx + '">এডিট</button>' +
        '<button class="btn small danger" data-ab="del" data-i="' + realIdx + '">ডিলিট</button></span></div>';
    }
    if (!shown.length) h += '<p class="muted">' + (items.length ? 'খুঁজে কিছু পাওয়া যায়নি।' : 'এখনো কিছু নেই — “+ নতুন” চাপুন।') + '</p>';
    return h + '</div>';
  }
  function admWireList(type) {
    var body = $('admBody');
    var s = $('admSearch');
    if (s) {
      s.addEventListener('input', function () {
        admListQuery = this.value;
        var pos = this.selectionStart;
        body.innerHTML = admListHtml(type, admCache[type] || []);
        admWireList(type);
        var s2 = $('admSearch');
        if (s2) {
          try { s2.focus(); s2.setSelectionRange(pos, pos); } catch (e) {}
        }
      });
    }
    var btns = body.querySelectorAll('[data-ab]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var act = this.getAttribute('data-ab');
        var idx = parseInt(this.getAttribute('data-i') || '-1', 10);
        if (act === 'add') { admEdit = { type: type, id: null, item: null }; admRenderSec(); }
        else if (act === 'edit') {
          var it = (admCache[type] || [])[idx];
          if (!it) return;
          admEdit = { type: type, id: it._id, item: it };
          admRenderSec();
        }
        else if (act === 'del') admDelete(type, idx);
        else if (act === 'bulk') admBulkDelete(type);
        else if (act === 'up') admMove(type, idx, -1);
        else if (act === 'down') admMove(type, idx, 1);
      });
    }
  }
  function admDelete(type, idx) {
    var items = admCache[type] || [];
    var it = items[idx];
    if (!it) return;
    if (!window.confirm('"' + (it.title || '') + '" ডিলিট করবেন?')) return;
    apiPost('/api/admin/content/delete', { token: admToken(), type: type, ids: [it._id] }, function (err) {
      if (err) {
        setSync(err === 'offline' ? 'ইন্টারনেট নেই।' : 'ডিলিট হয়নি।');
        return;
      }
      delete admCache[type];
      admRenderSec();
      refreshContent();
    });
  }
  function admBulkDelete(type) {
    var body = $('admBody');
    var boxes = body.querySelectorAll('.adm-check');
    var ids = [];
    for (var i = 0; i < boxes.length; i++) if (boxes[i].checked) ids.push(boxes[i].value);
    if (!ids.length) return;
    if (!window.confirm(ids.length + 'টি আইটেম ডিলিট করবেন?')) return;
    apiPost('/api/admin/content/delete', { token: admToken(), type: type, ids: ids }, function (err) {
      if (err) {
        setSync(err === 'offline' ? 'ইন্টারনেট নেই।' : 'ডিলিট হয়নি।');
        return;
      }
      delete admCache[type];
      admRenderSec();
      refreshContent();
    });
  }
  function admMove(type, idx, dir) {
    var items = admCache[type] || [];
    var j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    var tmp = items[idx];
    items[idx] = items[j];
    items[j] = tmp;
    $('admBody').innerHTML = admListHtml(type, items);
    admWireList(type);
    var ids = [];
    for (var i = 0; i < items.length; i++) ids.push(items[i]._id);
    apiPost('/api/admin/content/reorder', { token: admToken(), type: type, ids: ids }, function (err) {
      if (err) {
        delete admCache[type];
        admRenderSec();
        setSync('ক্রম সেভ হয়নি — আবার চেষ্টা করুন।');
      } else {
        refreshContent();
      }
    });
  }
  function admForm(type, item) {
    var body = $('admBody');
    var defs = FIELD_DEFS[type] || [];
    var h = '<button class="btn small ghost" id="afBack">‹ ' + esc(admSecName(type)) + ' তালিকা</button>' +
      '<div class="card adm-form"><h3>' + (item ? 'এডিট' : '+ নতুন') + ' — ' + esc(admSecName(type)) + '</h3>' +
      '<div id="admErr" class="adm-err" style="display:none"></div>';
    for (var f = 0; f < defs.length; f++) {
      var d = defs[f];
      var val = item ? (item[d.k] || '') : '';
      if (d.t === 'area') {
        h += '<label class="fld">' + esc(d.label) + '<textarea id="af-' + d.k + '">' + esc(val) + '</textarea></label>';
      } else if (d.t === 'sel') {
        var opts = admOpts(d.opts);
        if (!val && opts.length) val = opts[0][0];
        h += '<label class="fld">' + esc(d.label) + '<select id="af-' + d.k + '">';
        for (var o = 0; o < opts.length; o++) {
          h += '<option value="' + esc(opts[o][0]) + '"' + (val === opts[o][0] ? ' selected' : '') + '>' + esc(opts[o][1]) + '</option>';
        }
        h += '</select></label>';
      } else {
        h += '<label class="fld">' + esc(d.label) + '<input id="af-' + d.k + '" value="' + esc(val) + '"></label>';
      }
    }
    h += '<div class="row"><button id="afSave" class="btn">সংরক্ষণ করুন</button>' +
      '<button id="afCancel" class="btn ghost">বাতিল</button></div>' +
      '<p class="muted">সেভ হলে স্বয়ংক্রিয় সিংক চলবে — ফোনের অফলাইন কপি আপডেট হবে।</p></div>';
    body.innerHTML = h;
    $('afBack').addEventListener('click', function () {
      admEdit = null;
      admRenderSec();
    });
    $('afCancel').addEventListener('click', function () {
      admEdit = null;
      admRenderSec();
    });
    $('afSave').addEventListener('click', function () {
      var data = {};
      for (var i = 0; i < defs.length; i++) {
        var el = document.getElementById('af-' + defs[i].k);
        data[defs[i].k] = el ? el.value : '';
        if (defs[i].req && !String(data[defs[i].k] || '').replace(/^\s+|\s+$/g, '')) {
          var e0 = $('admErr');
          e0.style.display = 'block';
          e0.textContent = '“' + defs[i].label + '” আবশ্যক।';
          return;
        }
      }
      var isEdit = !!(item && item._id);
      var payload = isEdit
        ? { token: admToken(), type: type, id: item._id, data: data }
        : { token: admToken(), type: type, data: data };
      var path = isEdit ? '/api/admin/content/update' : '/api/admin/content';
      $('afSave').disabled = true;
      apiPost(path, payload, function (err2) {
        if (err2) {
          var e = $('admErr');
          e.style.display = 'block';
          e.textContent = err2 === 'offline' ? 'ইন্টারনেট নেই।'
            : (typeof err2 === 'string' && err2.slice(0, 4) === 'http' ? 'সেভ হয়নি।' : err2);
          $('afSave').disabled = false;
          return;
        }
        delete admCache[type];
        admEdit = null;
        admRenderSec();
        refreshContent();
      });
    });
  }
  var admUserCache = null;
  var admUserQ = '';
  var admUserSel = null;
  function admFindUser(id) {
    var list = admUserCache || [];
    for (var i = 0; i < list.length; i++) if (String(list[i]._id) === String(id)) return list[i];
    return null;
  }
  function admUserStats(u) {
    var done = 0, k, k2;
    try {
      for (k in (u.progress || {})) for (k2 in u.progress[k]) if (u.progress[k][k2]) done++;
    } catch (e) {}
    var tot = 0;
    var per = {};
    var phases = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    for (var i = 0; i < phases.length; i++) {
      var ph = phases[i];
      var sp = (u.progress && u.progress[ph]) || {};
      var d = 0;
      for (k2 in sp) if (sp[k2]) d++;
      var t = (DATA && DATA.checklist && DATA.checklist[ph]) ? DATA.checklist[ph].length : 0;
      tot += t;
      per[ph] = { done: d, total: t, pct: t ? Math.round(d * 100 / t) : 0 };
    }
    return { done: done, total: tot, per: per, pct: tot ? Math.round(done * 100 / tot) : 0 };
  }
  function admUsers() {
    var body = $('admBody');
    if (admUserCache) {
      body.innerHTML = admUsersHtml(admUserCache);
      admWireUsers();
      return;
    }
    body.innerHTML = '<div class="card"><p class="muted">লোড হচ্ছে…</p></div>';
    apiGet('/api/admin/users?token=' + encodeURIComponent(admToken()), function (err, obj) {
      var b = $('admBody');
      if (!b) return;
      if (err || !obj || !obj.users) {
        b.innerHTML = '<div class="card"><p class="muted">' + (err === 'offline' ? 'ইন্টারনেট নেই।' : 'লোড হয়নি।') + '</p>' +
          '<div class="row"><button id="admRetry" class="btn">আবার চেষ্টা করুন</button></div></div>';
        var rt = $('admRetry');
        if (rt) rt.addEventListener('click', function () { admUserCache = null; admRenderSec(); });
        return;
      }
      admUserCache = obj.users || [];
      b.innerHTML = admUsersHtml(admUserCache);
      admWireUsers();
    });
  }
  function admUsersHtml(users) {
    /* detail / edit sub-view first (back preserves list + search) */
    if (admUserSel && (admUserSel.mode === 'detail' || admUserSel.mode === 'edit')) {
      var sel = admFindUser(admUserSel.id);
      if (!sel) { admUserSel = null; }
      else if (admUserSel.mode === 'detail') return admUserDetailHtml(sel);
      else return admUserEditHtml(sel);
    }
    var q = (admUserQ || '').toLowerCase();
    var kept = [];
    for (var i = 0; i < users.length; i++) {
      var u0 = users[i];
      if (!q || (String(u0.username || '') + ' ' + String(u0.name || '') + ' ' + String(u0.phone || '')).toLowerCase().indexOf(q) >= 0) kept.push(u0);
    }
    var grand = 0;
    for (var g = 0; g < users.length; g++) grand += admUserStats(users[g]).done;
    var h = '<div class="adm-hero"><div><div class="adm-hero-t">ইউজার</div>' +
      '<div class="adm-hero-n">' + bn(users.length) + ' জন · মোট ' + bn(grand) + 'টি টিক</div></div>' +
      '<button class="btn small" data-u="new">+ নতুন ইউজার</button></div>';
    h += '<div class="adm-bar"><input id="admUserSearch" class="adm-search" placeholder="নাম / ইউজারনেম / ফোন খুঁজুন…" value="' + esc(admUserQ || '') + '">' +
      '<span class="adm-count">' + bn(kept.length) + '/' + bn(users.length) + '</span></div>';
    if (!kept.length) h += '<div class="card"><p class="muted">' + (users.length ? 'খুঁজে কেউ পাওয়া যায়নি।' : 'কোনো ইউজার নেই — নিচে থেকে তৈরি করুন।') + '</p></div>';
    for (var j = 0; j < kept.length; j++) {
      var u = kept[j];
      var st = admUserStats(u);
      var initial = esc(String(u.name || u.username || '?').slice(0, 1));
      h += '<div class="u-card"><div class="u-top"><span class="u-av">' + initial + '</span>' +
        '<span class="u-id"><b>' + esc(u.name || u.username) + '</b>' +
        '<span class="muted">@' + esc(u.username) + (u.phone ? ' · ' + esc(u.phone) : '') + '</span></span>' +
        '<span class="badge">' + bn(st.done) + '/' + bn(st.total) + '</span></div>' +
        '<div class="prog"><div class="bar"><i style="width:' + st.pct + '%"></i></div>' +
        '<span class="muted">' + bn(st.pct) + '%</span></div>' +
        '<div class="u-phases"><span class="muted">আবেদন ' + bn(st.per['abedonpotrer-purbe'].done) + '/' + bn(st.per['abedonpotrer-purbe'].total) +
        ' · প্রশ্ন ' + bn(st.per['proshnopotrer-purbe'].done) + '/' + bn(st.per['proshnopotrer-purbe'].total) +
        ' · শপথ ' + bn(st.per['shopother-purbe'].done) + '/' + bn(st.per['shopother-purbe'].total) + '</span></div>' +
        '<div class="u-acts"><button class="btn small" data-u="detail" data-id="' + esc(u._id) + '">অগ্রগতি</button>' +
        '<button class="btn small ghost" data-u="edit" data-id="' + esc(u._id) + '">এডিট</button>' +
        '<button class="btn small danger" data-u="del" data-id="' + esc(u._id) + '" data-uname="' + esc(u.username) + '">ডিলিট</button></div></div>';
    }
    h += '<div class="card"><h3>+ নতুন ইউজার</h3>' +
      '<div id="auErr" class="adm-err" style="display:none"></div>' +
      '<label class="fld">ইউজারনেম<input id="nuUser" autocomplete="off" placeholder="যেমন: rahim_01"></label>' +
      '<label class="fld">নাম<input id="nuName" autocomplete="off" placeholder="পুরো নাম"></label>' +
      '<label class="fld">ফোন<input id="nuPhone" autocomplete="off" placeholder="01XXXXXXXXX"></label>' +
      '<label class="fld">পাসওয়ার্ড (কমপক্ষে ৪ অক্ষর)<input id="nuPass" type="password" autocomplete="new-password"></label>' +
      '<button id="nuGo" class="btn">ইউজার তৈরি করুন</button></div>';
    return h;
  }
  function admUserDetailHtml(u) {
    var st = admUserStats(u);
    var phases = [
      ['abedonpotrer-purbe', 'আবেদনপত্রের পূর্বে'],
      ['proshnopotrer-purbe', 'প্রশ্নপত্রের পূর্বে'],
      ['shopother-purbe', 'শপথের পূর্বে']
    ];
    var h = '<button class="btn small ghost" data-u="back">‹ সব ইউজার</button>' +
      '<div class="u-card"><div class="u-top"><span class="u-av">' + esc(String(u.name || u.username || '?').slice(0, 1)) + '</span>' +
      '<span class="u-id"><b>' + esc(u.name || u.username) + '</b>' +
      '<span class="muted">@' + esc(u.username) + (u.phone ? ' · ' + esc(u.phone) : '') + '</span></span>' +
      '<span class="badge">' + bn(st.done) + '/' + bn(st.total) + ' · ' + bn(st.pct) + '%</span></div>' +
      '<div class="prog"><div class="bar"><i style="width:' + st.pct + '%"></i></div></div>' +
      '<div class="u-acts"><button class="btn small ghost" data-u="edit" data-id="' + esc(u._id) + '">এডিট</button>' +
      '<button class="btn small danger" data-u="reset" data-id="' + esc(u._id) + '">অগ্রগতি রিসেট</button></div></div>';
    for (var i = 0; i < phases.length; i++) {
      var ph = phases[i][0];
      var p = st.per[ph];
      h += '<div class="card"><h3>' + esc(phases[i][1]) + ' <span class="badge">' + bn(p.done) + '/' + bn(p.total) + '</span></h3>' +
        '<div class="prog"><div class="bar"><i style="width:' + p.pct + '%"></i></div><span class="muted">' + bn(p.pct) + '%</span></div>';
      var list = (DATA && DATA.checklist && DATA.checklist[ph]) || [];
      var saved = (u.progress && u.progress[ph]) || {};
      var last = '';
      for (var j = 0; j < list.length; j++) {
        if (list[j].c !== last) { h += '<div class="check-cat">' + esc(list[j].c) + '</div>'; last = list[j].c; }
        var doneIt = !!saved[j];
        h += '<div class="check-item"><span class="badge' + (doneIt ? '' : ' dim') + '">' + (doneIt ? 'সম্পন্ন' : 'বাকি') + '</span><span>' + esc(list[j].t) + '</span></div>';
      }
      if (!list.length) h += '<p class="muted">চেকলিস্ট সিংক হয়নি — ⟳ সিংক করে আবার দেখুন।</p>';
      h += '</div>';
    }
    return h;
  }
  function admUserEditHtml(u) {
    var h = '<button class="btn small ghost" data-u="back">‹ সব ইউজার</button>' +
      '<div class="card"><h3>এডিট — ' + esc(u.username) + '</h3>' +
      '<div id="ueErr" class="adm-err" style="display:none"></div>' +
      '<label class="fld">ইউজারনেম<input id="euUser" value="' + esc(u.username || '') + '" autocomplete="off"></label>' +
      '<label class="fld">নাম<input id="euName" value="' + esc(u.name || '') + '" autocomplete="off"></label>' +
      '<label class="fld">ফোন<input id="euPhone" value="' + esc(u.phone || '') + '" autocomplete="off"></label>' +
      '<label class="fld">নতুন পাসওয়ার্ড (খালি রাখলে আগেরটাই থাকবে)<input id="euPass" type="password" autocomplete="new-password" placeholder="বদলাতে চাইলে লিখুন"></label>' +
      '<div class="row"><button id="euGo" class="btn">সেভ করুন</button>' +
      '<button class="btn ghost" data-u="detail" data-id="' + esc(u._id) + '">অগ্রগতি দেখুন</button></div>' +
      '<p class="muted">পাসওয়ার্ড হ্যাশ থাকে — দেখা যায় না, শুধু বদলানো যায়।</p></div>';
    return h;
  }
  function admWireUsers() {
    var body = $('admBody');
    var s = $('admUserSearch');
    if (s) {
      s.addEventListener('input', function () {
        admUserQ = this.value;
        var pos = this.selectionStart;
        body.innerHTML = admUsersHtml(admUserCache || []);
        admWireUsers();
        var s2 = $('admUserSearch');
        if (s2) { try { s2.focus(); s2.setSelectionRange(pos, pos); } catch (e) {} }
      });
    }
    var btns = body.querySelectorAll('[data-u]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var act = this.getAttribute('data-u');
        var id = this.getAttribute('data-id');
        if (act === 'back' || act === 'new') {
          if (act === 'back') admUserSel = null;
          body.innerHTML = admUsersHtml(admUserCache || []);
          admWireUsers();
          if (act === 'new') {
            var nu = $('nuUser');
            if (nu) { try { nu.focus(); } catch (e) {} }
          }
          return;
        }
        if (act === 'detail') { admUserSel = { mode: 'detail', id: id }; body.innerHTML = admUsersHtml(admUserCache || []); admWireUsers(); return; }
        if (act === 'edit') { admUserSel = { mode: 'edit', id: id }; body.innerHTML = admUsersHtml(admUserCache || []); admWireUsers(); return; }
        if (act === 'del') {
          var uname = this.getAttribute('data-uname') || '';
          if (!window.confirm('"' + uname + '" মুছবেন?')) return;
          apiPost('/api/admin/users/delete', { token: admToken(), id: id }, function (err2) {
            if (!err2) { admUserCache = null; admUserSel = null; admRenderSec(); }
            else setSync(err2 === 'offline' ? 'ইন্টারনেট নেই।' : 'মোছা হয়নি।');
          });
          return;
        }
        if (act === 'reset') {
          if (!window.confirm('এই ইউজারের সব টিক মুছে যাবে — রিসেট করবেন?')) return;
          apiPost('/api/admin/users/reset-progress', { token: admToken(), id: id }, function (err3, obj3) {
            if (!err3) {
              admUserCache = null; admRenderSec();
            } else setSync(err3 === 'offline' ? 'ইন্টারনেট নেই।' : 'রিসেট হয়নি।');
          });
          return;
        }
      });
    }
    var nuGo = $('nuGo');
    if (nuGo) {
      nuGo.addEventListener('click', function () {
        var data = { username: $('nuUser').value, name: $('nuName').value, phone: $('nuPhone').value, password: $('nuPass').value };
        nuGo.disabled = true;
        apiPost('/api/admin/users', { token: admToken(), data: data }, function (err4) {
          nuGo.disabled = false;
          if (err4) {
            var e = $('auErr');
            if (e) { e.style.display = 'block'; e.textContent = err4 === 'offline' ? 'ইন্টারনেট নেই।' : (typeof err4 === 'string' && err4.slice(0, 4) === 'http' ? 'তৈরি হয়নি।' : err4); }
            return;
          }
          admUserCache = null; admUserSel = null; admRenderSec();
        });
      });
    }
    var euGo = $('euGo');
    if (euGo) {
      euGo.addEventListener('click', function () {
        var id2 = (admUserSel && admUserSel.id) || '';
        var data2 = { username: $('euUser').value, name: $('euName').value, phone: $('euPhone').value, password: $('euPass').value };
        euGo.disabled = true;
        apiPost('/api/admin/users/update', { token: admToken(), id: id2, data: data2 }, function (err5, obj5) {
          euGo.disabled = false;
          if (err5) {
            var e2 = $('ueErr');
            if (e2) { e2.style.display = 'block'; e2.textContent = err5 === 'offline' ? 'ইন্টারনেট নেই।' : (typeof err5 === 'string' && err5.slice(0, 4) === 'http' ? 'সেভ হয়নি।' : err5); }
            return;
          }
          admUserCache = null;
          admUserSel = { mode: 'detail', id: id2 };
          admRenderSec();
        });
      });
    }
  }

  /* ---------- theme (dark + light, SVG icon like the site) ---------- */
  var ICON_SUN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var ICON_MOON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  function applyTheme() {
    var th = 'dark';
    try { th = localStorage.getItem(LS_THEME) || 'dark'; } catch (e) {}
    if (th !== 'light') th = 'dark';
    document.documentElement.setAttribute('data-theme', th);
    var b = $('themeBtn');
    if (b) {
      b.innerHTML = th === 'light' ? ICON_MOON : ICON_SUN;
      b.setAttribute('aria-label', th === 'light' ? 'ডার্ক থিম চালু করুন' : 'লাইট থিম চালু করুন');
    }
  }

  /* ---------- boot ---------- */
  window.addEventListener('hashchange', route);
  applyTheme();
  var themeBtn = $('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var cur = 'dark';
      try { cur = localStorage.getItem(LS_THEME) || 'dark'; } catch (e) {}
      try { localStorage.setItem(LS_THEME, cur === 'light' ? 'dark' : 'light'); } catch (e2) {}
      applyTheme();
    });
  }
  var updateBtn = $('updateBtn');
  if (updateBtn) {
    updateBtn.addEventListener('click', function () {
      setSync('আপডেট হচ্ছে…');
      if (window.Android && window.Android.refresh) {
        try { window.Android.refresh(); return; } catch (e) {}
      }
      setSync('অ্যাপ থেকে রিফ্রেশ করুন।');
    });
  }
  $('refreshBtn').addEventListener('click', function () {
    if (window.Android && window.Android.refresh) {
      try { window.Android.refresh(); return; } catch (e) {}
    }
    setSync('অ্যাপ থেকে রিফ্রেশ করুন।');
  });
  renderTabs();
  route();
})();
