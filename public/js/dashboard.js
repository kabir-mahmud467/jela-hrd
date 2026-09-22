/* HRD dashboard.js — logged-in user checklist (DB + localStorage merge), ES5 ONLY.
   Server progress seeds from #server-progress; ticks save instantly to
   localStorage, then POST /dashboard/progress when online (best-effort). */
(function () {
  var KEY = 'hrd_dash_local_v1';
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
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function render() {
    var listEl = document.getElementById('checklist-list');
    if (!listEl) return;
    var list = data[current] || [];
    var html = '';
    var lastCat = '';
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var checked = store[current] && store[current][i] ? 'checked' : '';
      if (it.c !== lastCat) {
        html += '<div class="check-cat">' + esc(it.c) + '</div>';
        lastCat = it.c;
      }
      html += '<label class="check-item"><input type="checkbox" data-i="' + i + '" ' + checked + '> <span>' + esc(it.t) + '</span></label>';
    }
    listEl.innerHTML = html;
    var boxes = listEl.querySelectorAll('input[type=checkbox]');
    for (var b = 0; b < boxes.length; b++) {
      boxes[b].addEventListener('change', function () {
        var idx = this.getAttribute('data-i');
        store[current] = store[current] || {};
        if (this.checked) store[current][idx] = 1;
        else delete store[current][idx];
        saveLocal(store);
        updateProgress();
        pushServer();
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
