/* Jela HRD admin-reorder.js — batch serial ordering, ES5 ONLY, CSP-safe.
   Arrows move rows instantly in the DOM (zero requests); the new sequence
   is kept as a localStorage draft. ONE "সংরক্ষণ" POSTs the whole order to
   /admin/<path>/reorder (single bulkWrite) and reloads once.
   No-JS fallback: arrow forms POST per-click to .../move/up|down (unchanged). */
(function () {
  var table = document.querySelector('table[data-reorder]');
  if (!table) return;
  var path = table.getAttribute('data-reorder');
  var KEY = 'jela_order_' + path;
  var tbody = (table.tBodies && table.tBodies[0]) || table;

  function rows() {
    return tbody.querySelectorAll('tr[data-id]');
  }
  function curIds() {
    var r = rows();
    var out = [];
    for (var i = 0; i < r.length; i++) out.push(r[i].getAttribute('data-id'));
    return out;
  }
  function loadDraft() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return (v && v.length) ? v : null;
    } catch (e) {
      return null;
    }
  }
  function storeDraft(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }
  function dropDraft() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
  }
  function sameSet(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var s = {};
    for (var i = 0; i < a.length; i++) s[a[i]] = 1;
    for (var j = 0; j < b.length; j++) if (!s[b[j]]) return false;
    return true;
  }
  function sameOrder(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function movedCount(from, to) {
    var n = 0;
    for (var i = 0; i < to.length; i++) if (to[i] !== from[i]) n++;
    return n;
  }
  function refreshArrows() {
    var r = rows();
    for (var i = 0; i < r.length; i++) {
      var up = r[i].querySelector('form[action$="/move/up"] button');
      var dn = r[i].querySelector('form[action$="/move/down"] button');
      if (up) {
        if (i === 0) up.setAttribute('disabled', 'disabled');
        else up.removeAttribute('disabled');
      }
      if (dn) {
        if (i === r.length - 1) dn.setAttribute('disabled', 'disabled');
        else dn.removeAttribute('disabled');
      }
      /* serial input mirrors live position (skip while typing) */
      var pos = r[i].querySelector('input.pos-input');
      if (pos && document.activeElement !== pos) pos.value = String(i + 1);
    }
  }
  /* Jump a row straight to serial N (instant DOM move + draft, like arrows). */
  function moveTo(tr, n) {
    var r = rows();
    var arr = [];
    for (var i = 0; i < r.length; i++) arr.push(r[i]);
    var from = arr.indexOf(tr);
    if (from < 0) return;
    if (isNaN(n)) n = from + 1;
    n = Math.max(1, Math.min(arr.length, n));
    if (n === from + 1) {
      refreshArrows();
      /* Order unchanged — keep draft in sync so the bar hides when the
         user moves a row back to its saved position. */
      storeDraft(curIds());
      syncBar();
      return;
    }
    arr.splice(from, 1);
    var ref = arr[n - 1] || null;
    if (ref) tbody.insertBefore(tr, ref);
    else tbody.appendChild(tr);
    refreshArrows();
    storeDraft(curIds());
    syncBar();
  }
  function applyOrder(list) {
    var map = {};
    var r = rows();
    for (var i = 0; i < r.length; i++) map[r[i].getAttribute('data-id')] = r[i];
    for (var j = 0; j < list.length; j++) {
      if (map[list[j]]) tbody.appendChild(map[list[j]]);
    }
    refreshArrows();
  }

  var serverOrder = curIds();

  var bar = document.createElement('div');
  bar.className = 'reorder-bar';
  bar.setAttribute('hidden', 'hidden');
  var msg = document.createElement('span');
  msg.className = 'reorder-msg';
  var saveBtn = document.createElement('button');
  saveBtn.className = 'btn primary small';
  saveBtn.type = 'button';
  saveBtn.textContent = 'সংরক্ষণ করুন';
  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn small';
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'বাতিল';
  bar.appendChild(msg);
  bar.appendChild(saveBtn);
  bar.appendChild(cancelBtn);
  document.body.appendChild(bar);

  function syncBar() {
    var draft = loadDraft();
    var cur = curIds();
    if (!draft || !sameSet(draft, cur)) {
      /* Stale draft (rows added/deleted elsewhere, e.g. bulk delete) —
         drop it so it never resurrects a phantom order. */
      if (draft && !sameSet(draft, cur)) dropDraft();
      bar.setAttribute('hidden', 'hidden');
      return;
    }
    if (sameOrder(draft, serverOrder)) {
      dropDraft();
      bar.setAttribute('hidden', 'hidden');
      return;
    }
    msg.textContent = 'ক্রম বদলেছে (' + movedCount(serverOrder, draft) + 'টি সারি) — সংরক্ষণ করুন';
    bar.removeAttribute('hidden');
  }

  var saving = false;
  saveBtn.addEventListener('click', function () {
    if (saving) return;
    var draft = loadDraft();
    if (!draft) return;
    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'সংরক্ষণ হচ্ছে…';
    cancelBtn.disabled = true;
    var f = document.createElement('form');
    f.method = 'POST';
    f.action = '/admin/' + path + '/reorder';
    var inp = document.createElement('input');
    inp.type = 'hidden';
    inp.name = 'ids';
    inp.value = draft.join(',');
    f.appendChild(inp);
    document.body.appendChild(f);
    f.submit();
  });
  cancelBtn.addEventListener('click', function () {
    dropDraft();
    window.location.reload();
  });

  table.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || !f.getAttribute) return;
    var act = f.getAttribute('action') || '';
    if (act.indexOf('/move-to') >= 0) {
      /* serial jump: instant, no reload (no-JS posts the form natively) */
      e.preventDefault();
      var num = f.querySelector('input.pos-input');
      var n = num ? parseInt(num.value, 10) : NaN;
      var row = f;
      while (row && row !== table && !(row.tagName === 'TR' && row.getAttribute('data-id'))) {
        row = row.parentNode;
      }
      if (!row || row === table) return;
      moveTo(row, n);
      return;
    }    if (act.indexOf('/move/') < 0) return;
    e.preventDefault();
    var tr = f;
    while (tr && tr !== table && !(tr.tagName === 'TR' && tr.getAttribute('data-id'))) {
      tr = tr.parentNode;
    }
    if (!tr || tr === table) return;
    var dir = act.indexOf('/move/down') >= 0 ? 1 : -1;
    var sib = dir > 0 ? tr.nextElementSibling : tr.previousElementSibling;
    while (sib && !(sib.tagName === 'TR' && sib.getAttribute('data-id'))) {
      sib = dir > 0 ? sib.nextElementSibling : sib.previousElementSibling;
    }
    if (!sib) return;
    if (dir > 0) tbody.insertBefore(sib, tr);
    else tbody.insertBefore(tr, sib);
    refreshArrows();
    storeDraft(curIds());
    syncBar();
  });

  // Resume unsaved draft after an accidental refresh (same rows, new order).
  var pending = loadDraft();
  if (pending && sameSet(pending, serverOrder) && !sameOrder(pending, serverOrder)) {
    applyOrder(pending);
  }
  refreshArrows();
  syncBar();
})();
