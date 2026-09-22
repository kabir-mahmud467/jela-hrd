/* HRD dashboard.js — logged-in user checklist (DB + localStorage merge), ES5 ONLY.
   Server progress seeds from #server-progress; ticks save instantly to
   localStorage, then POST /dashboard/progress when online (best-effort). */
(function () {
  var KEY = 'hrd_dash_local_v5';
  var current = 'abedonpotrer-purbe';
  var dataEl = document.getElementById('checklist-data');
  var srvEl = document.getElementById('server-progress');
  var data = {};
  var server = {};
  try {
    data = dataEl ? JSON.parse(dataEl.textContent) : {};
  } catch (e) {
    data = {};
  }
  try {
    server = srvEl ? JSON.parse(srvEl.textContent) : {};
  } catch (e2) {
    server = {};
  }
  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) {
      return {};
    }
  }
  function saveLocal(o) {
    try {
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) {}
  }
  /* merged view: server wins when it has a tick */
  function merged() {
    var local = loadLocal();
    var out = {};
    var phases = ['abedonpotrer-purbe', 'proshnopotrer-purbe', 'shopother-purbe'];
    for (var p = 0; p < phases.length; p++) {
      var ph = phases[p];
      out[ph] = {};
      var s = server[ph] || {};
      var l = local[ph] || {};
      for (var k in s) if (s[k]) out[ph][k] = 1;
      for (var k2 in l) if (l[k2]) out[ph][k2] = 1;
    }
    /* shared cross-phase ticks live outside phases: one tick shows in all 3 */
    out.shared = {};
    var ss = server.shared || {};
    var sl = local.shared || {};
    for (var sk in ss) if (ss[sk]) out.shared[sk] = 1;
    for (var sk2 in sl) if (sl[sk2]) out.shared[sk2] = 1;
    return out;
  }
  var store = merged();
  /* first visit: seed local from server so offline keeps working */
  saveLocal(store);
  function setSaveState(t) {
    var el = document.getElementById('save-state');
    if (el) el.textContent = t;
  }
  function pushServer() {
    setSaveState('সেভ হচ্ছে…');
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/dashboard/progress', true);
      xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var r = JSON.parse(xhr.responseText);
            if (r && r.progress) server = r.progress;
          } catch (e) {}
          setSaveState('সব সংরক্ষিত');
        } else {
          setSaveState('অফলাইন — ফোনে সংরক্ষিত');
        }
      };
      xhr.onerror = function () {
        setSaveState('অফলাইন — ফোনে সংরক্ষিত');
      };
      xhr.send(JSON.stringify({ progress: store }));
    } catch (e) {
      setSaveState('অফলাইন — ফোনে সংরক্ষিত');
    }
  }
  function updateProgress() {
    var list = data[current] || [];
    var done = 0;
    for (var i = 0; i < list.length; i++) {
      if (store[current] && store[current][i]) done++;
    }
    var pct = list.length ? Math.round(done / list.length * 100) : 0;
    var bar = document.getElementById('checklist-bar');
    var cnt = document.getElementById('checklist-count');
    if (bar) bar.style.width = pct + '%';
    if (cnt) cnt.textContent = done + '/' + list.length;
  }
  function catDone(list, cat) {
    var tot = 0, done = 0;
    for (var i = 0; i < list.length; i++) {
      if ((list[i] || {}).c === cat) {
        tot++;
        if (store[current] && store[current][i]) done++;
      }
    }
    return { tot: tot, done: done, pct: tot ? Math.round(done / tot * 100) : 0 };
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* section rollup: categories like 'আয়াত-হাদিস/ঈমান' group per-topic but
     also roll into one whole-section bar ('আয়াত-হাদিস'). Plain categories
     (no '/') are untouched. Shared 'সাধারণ হাদিস' has no prefix — excluded. */
  function secOf(cat) {
    var s = String(cat == null ? '' : cat);
    var i = s.indexOf('/');
    return i < 0 ? '' : s.slice(0, i);
  }
  function catTitle(cat) {
    var s = String(cat == null ? '' : cat);
    var i = s.indexOf('/');
    return i < 0 ? s : s.slice(i + 1);
  }
  function render() {
    var listEl = document.getElementById('checklist-list');
    if (!listEl) return;
    var list = data[current] || [];
    var secTot = {}, secDone = {};
    for (var s0 = 0; s0 < list.length; s0++) {
      var sc0 = secOf((list[s0] || {}).c);
      if (!sc0) continue;
      secTot[sc0] = (secTot[sc0] || 0) + 1;
      if (store[current] && store[current][s0]) secDone[sc0] = (secDone[sc0] || 0) + 1;
    }
    var html = '';
    var lastCat = '';
    var lastSec = '';
    var catNum = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var checked = store[current] && store[current][i] ? 'checked' : '';
      var sc = secOf(it.c || '');
      if (sc !== lastSec) {
        if (sc) {
          var sT = secTot[sc] || 0, sD = secDone[sc] || 0;
          var sP = sT ? Math.round(sD / sT * 100) : 0;
          html += '<div class="check-cat sec">' + esc(sc) + ' <span class="badge light">' + sD + '/' + sT + '</span></div>' +
            '<div class="bar cat-bar"><i style="width:' + sP + '%"></i></div>';
        }
        lastSec = sc;
      }
      if (it.c !== lastCat) {
        catNum = 1;
        var st = catDone(list, it.c);
        html += '<div class="check-cat">' + esc(catTitle(it.c)) + ' <span class="badge light">' + st.done + '/' + st.tot + '</span></div>' +
          '<div class="bar cat-bar"><i style="width:' + st.pct + '%"></i></div>';
        lastCat = it.c;
      } else {
        catNum++;
      }
      html += '<label class="check-item"><input type="checkbox" data-i="' + i + '" ' + checked + '> <span>' + catNum + '. ' + esc(it.t) + '</span></label>';
    }
    /* shared section: same list + same ticks in every phase */
    var shared = (typeof data.shared !== 'undefined' && data.shared) || [];
    if (shared.length) {
      var sDone = 0;
      for (var si = 0; si < shared.length; si++) {
        if (store.shared && store.shared[shared[si].id]) sDone++;
      }
      var sPct = Math.round(sDone / shared.length * 100);
      html += '<div class="check-cat">সাধারণ হাদিস <span class="badge light">' + sDone + '/' + shared.length + '</span></div>' +
        '<div class="bar cat-bar"><i style="width:' + sPct + '%"></i></div>' +
        '<p class="muted">সব পর্বে একসাথে — এক জায়গায় টিক দিলে তিন পর্বেই দেখাবে।</p>';
      for (var sj = 0; sj < shared.length; sj++) {
        var sChecked = store.shared && store.shared[shared[sj].id] ? 'checked' : '';
        html += '<label class="check-item"><input type="checkbox" data-sid="' + esc(shared[sj].id) + '" ' + sChecked + '> <span>' + (sj + 1) + '. ' + esc(shared[sj].t) + '</span></label>';
      }
    }
    listEl.innerHTML = html;
    var boxes = listEl.querySelectorAll('input[type=checkbox]');
    for (var b = 0; b < boxes.length; b++) {
      boxes[b].addEventListener('change', function () {
        var idx = this.getAttribute('data-i');
        var sid = this.getAttribute('data-sid');
        if (sid) {
          store.shared = store.shared || {};
          if (this.checked) store.shared[sid] = 1;
          else delete store.shared[sid];
        } else {
          store[current] = store[current] || {};
          if (this.checked) store[current][idx] = 1;
          else delete store[current][idx];
        }
        saveLocal(store);
        pushServer();
        render();
      });
    }
    updateProgress();
  }
  var tabs = document.getElementById('checklist-tabs');
  if (tabs) {
    var btns = tabs.querySelectorAll('button');
    for (var t = 0; t < btns.length; t++) {
      btns[t].addEventListener('click', function () {
        current = this.getAttribute('data-check-phase');
        for (var j = 0; j < btns.length; j++) btns[j].classList.remove('active');
        this.classList.add('active');
        render();
      });
    }
  }
  var reset = document.getElementById('checklist-reset');
  if (reset) {
    reset.addEventListener('click', function () {
      store[current] = {};
      saveLocal(store);
      render();
      pushServer();
    });
  }
  render();
})();
