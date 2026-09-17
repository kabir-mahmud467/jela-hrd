/* Jela HRD checklist.js — homepage progress (localStorage), CSP-safe, ES5 ONLY.
   Reads data from <script type="application/json" id="checklist-data"> in index.ejs.
   No arrows, const/let, async/await, template literals, optional chaining. */
(function () {
  var KEY = 'jela_checklist_v1';
  var current = 'abedonpotrer-purbe';
  var dataEl = document.getElementById('checklist-data');
  var data = {};
  try {
    data = dataEl ? JSON.parse(dataEl.textContent) : {};
  } catch (e) {
    data = {};
  }
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) {
      return {};
    }
  }
  function save(o) {
    try {
      localStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) {}
  }
  function updateProgress() {
    var store = load();
    var list = data[current] || [];
    var done = 0;
    for (var i = 0; i < list.length; i++) {
      if (store[current + '-' + i]) done++;
    }
    var pct = list.length ? Math.round(done / list.length * 100) : 0;
    var bar = document.getElementById('checklist-bar');
    var cnt = document.getElementById('checklist-count');
    var prog = document.getElementById('checklist-progress');
    if (bar) bar.style.width = pct + '%';
    if (cnt) cnt.textContent = done + '/' + list.length;
    if (prog) prog.textContent = pct + '% সম্পন্ন';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function render() {
    var listEl = document.getElementById('checklist-list');
    if (!listEl) return;
    var store = load();
    var list = data[current] || [];
    var html = '';
    var lastCat = '';
    var catNum = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      var key = current + '-' + i;
      var checked = store[key] ? 'checked' : '';
      if (it.c !== lastCat) {
        catNum = 1;
        html += '<div style="margin:10px 0 4px;font-weight:700;color:var(--navy);font-size:13px;border-left:3px solid var(--sky);padding-left:8px">' + esc(it.c) + '</div>';
        lastCat = it.c;
      } else {
        catNum++;
      }
      html += '<label style="display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border:1px solid var(--line-soft);border-radius:8px;margin-bottom:6px;background:#fff;cursor:pointer"><input type="checkbox" data-k="' + key + '" ' + checked + ' style="margin-top:3px"> <span style="font-size:14px;line-height:1.5">' + catNum + '. ' + esc(it.t) + '</span></label>';
    }
    listEl.innerHTML = html;
    updateProgress();
  }
  function applyState() {
    var store = load();
    var boxes = document.querySelectorAll('#checklist-list input[type=checkbox]');
    for (var i = 0; i < boxes.length; i++) {
      var k = boxes[i].getAttribute('data-k');
      if (k) boxes[i].checked = !!store[k];
    }
  }
  try {
    applyState();
    updateProgress();
  } catch (e) {}
  var tabs = document.getElementById('checklist-tabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-check-phase]') : null;
      if (!b) return;
      current = b.getAttribute('data-check-phase');
      var chips = document.querySelectorAll('#checklist-tabs .chip');
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
      b.classList.add('active');
      render();
    });
  }
  var reset = document.getElementById('checklist-reset');
  if (reset) {
    reset.addEventListener('click', function () {
      if (!window.confirm('এই পর্বের সব টিক মুছবেন?')) return;
      var s = load();
      var list = data[current] || [];
      for (var i = 0; i < list.length; i++) delete s[current + '-' + i];
      save(s);
      render();
    });
  }
  var list2 = document.getElementById('checklist-list');
  if (list2) {
    list2.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.matches && t.matches('input[type=checkbox][data-k]')) {
        var s = load();
        var k = t.getAttribute('data-k');
        s[k] = t.checked;
        if (!t.checked) delete s[k];
        save(s);
        updateProgress();
      }
    });
  }
})();
