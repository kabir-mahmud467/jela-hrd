/* Jela HRD admin-bulk.js — batch delete, ES5 ONLY, CSP-safe.
   Ticks checkboxes in admin tables (table[data-reorder]); a bulk bar shows
   the selected count + ONE "delete selected" button that POSTs to
   /admin/<path>/bulk-delete (single deleteMany). No-JS fallback: per-row
   delete forms stay untouched. */
(function () {
  var table = document.querySelector('table[data-reorder]');
  if (!table) return;
  var path = table.getAttribute('data-reorder');
  var bar = document.querySelector('[data-bulk-bar]');
  var countEl = document.querySelector('[data-bulk-count]');
  var delBtn = document.querySelector('[data-bulk-delete]');
  var allBox = table.querySelector('[data-bulk-all]');
  if (!bar || !delBtn) return;
  var busy = false;

  function boxes() {
    return table.querySelectorAll('.bulk-check');
  }
  function selected() {
    var out = [];
    var list = boxes();
    for (var i = 0; i < list.length; i++) {
      if (list[i].checked && list[i].value) out.push(list[i].value);
    }
    return out;
  }
  function toBengali(n) {
    var d = '০১২৩৪৫৬৭৮৯';
    return String(n).split('').map(function (c) { return d[c] || c; }).join('');
  }
  function sync() {
    var sel = selected();
    var list = boxes();
    if (!sel.length) {
      bar.setAttribute('hidden', 'hidden');
    } else {
      bar.removeAttribute('hidden');
      if (countEl) countEl.textContent = toBengali(sel.length) + 'টি সিলেক্ট';
    }
    for (var i = 0; i < list.length; i++) {
      var tr = list[i];
      while (tr && tr.tagName !== 'TR') tr = tr.parentNode;
      if (tr) {
        if (list[i].checked) {
          if (tr.className.indexOf('row-selected') < 0) tr.className += ' row-selected';
        } else {
          tr.className = tr.className.replace(/\s*row-selected/g, '');
        }
      }
    }
    if (allBox) allBox.checked = list.length > 0 && sel.length === list.length;
    if (!busy) delBtn.disabled = sel.length === 0;
  }

  if (allBox) {
    allBox.addEventListener('change', function () {
      var list = boxes();
      for (var i = 0; i < list.length; i++) list[i].checked = allBox.checked;
      sync();
    });
  }
  table.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.className && t.className.indexOf && t.className.indexOf('bulk-check') >= 0) sync();
  });

  delBtn.addEventListener('click', function () {
    if (busy) return;
    var sel = selected();
    if (!sel.length) return;
    if (!window.confirm(sel.length + 'টি আইটেম ডিলিট করবেন? এই কাজ ফেরানো যাবে না।')) return;
    busy = true;
    delBtn.disabled = true;
    delBtn.textContent = 'মুছছে…';
    var f = document.createElement('form');
    f.method = 'POST';
    f.action = '/admin/' + path + '/bulk-delete';
    var inp = document.createElement('input');
    inp.type = 'hidden';
    inp.name = 'ids';
    inp.value = sel.join(',');
    f.appendChild(inp);
    document.body.appendChild(f);
    f.submit();
  });

  sync();
})();
