/* Admin Bijoy auto-convert — silent, no UI/tools, no selection.
 * Content-form submit-এর সময় যেসব বাংলা ফিল্ডে Bijoy (SutonnyMJ) টেক্সট
 * শনাক্ত হয়, সেগুলো Unicode বাংলায় রূপান্তর করে submit করে।
 * Server-side-এও একই check আছে, তাই JS বন্ধ থাকলেও রূপান্তর হবে।
 * ES5 ONLY, CSP-safe (no inline handlers).
 */
(function () {
  if (!window.BijoyConverter) return;

  /* শুধু কনটেন্ট ফর্মে (login/settings/bans ছোঁবে না) */
  var CONTENT_RE = /^\/admin\/(books|notes|dars|duas|ayathadith|surah|bibidh)(\/|$)/;

  function convertField(el) {
    var v = el.value;
    if (/<[a-zA-Z][^<>]*>/.test(v)) {
      /* editor HTML: convert text nodes only, markup intact */
      var out = window.BijoyConverter.convertHtmlMixed(v);
      if (out !== v) el.value = out;
      return;
    }
    if (window.BijoyConverter.looksLikeBijoy(v)) {
      el.value = window.BijoyConverter.convertBijoyToUnicode(v);
    }
  }

  function skip(el) {
    if (el.disabled || el.readOnly) return true;
    if (el.hasAttribute && el.hasAttribute('data-no-bijoy')) return true;
    var name = (el.getAttribute('name') || '').toLowerCase();
    if (name === 'link' || name === 'arabic') return true;
    if ((el.getAttribute('type') || '').toLowerCase() === 'url') return true;
    if ((el.getAttribute('inputmode') || '').toLowerCase() === 'url') return true;
    return false;
  }

  /* capture phase: confirm dialog-এর আগেই convert, যাতে সেভ হওয়া মান Unicode হয় */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    var action = f.getAttribute('action') || '';
    if (!CONTENT_RE.test(action)) return;
    var els = f.querySelectorAll('textarea, input[type="text"], input:not([type])');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (skip(el)) continue;
      convertField(el);
    }
  }, true);
})();
