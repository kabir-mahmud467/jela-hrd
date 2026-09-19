/* Bijoy (SutonnyMJ) -> Unicode Bangla converter.
 * Shared single source: browser global window.BijoyConverter + Node require().
 * ES5 only, no dependencies. Glyph map verified from bijoy-unicode-converter.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.BijoyConverter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Bangla char helpers ---------- */
  function IsBanglaPreKar(CUni) {
    if (CUni == "ি" || CUni == "ৈ" || CUni == "ে") return true;
    return false;
  }
  function IsBanglaPostKar(CUni) {
    if (
      CUni == "া" ||
      CUni == "ো" ||
      CUni == "ৌ" ||
      CUni == "ৗ" ||
      CUni == "ু" ||
      CUni == "ূ" ||
      CUni == "ী" ||
      CUni == "ৃ"
    )
      return true;
    return false;
  }
  function IsBanglaKar(CUni) {
    if (IsBanglaPreKar(CUni) || IsBanglaPostKar(CUni)) return true;
    return false;
  }
  function IsBanglaBanjonborno(CUni) {
    if (
      CUni == "ক" ||
      CUni == "খ" ||
      CUni == "গ" ||
      CUni == "ঘ" ||
      CUni == "ঙ" ||
      CUni == "চ" ||
      CUni == "ছ" ||
      CUni == "জ" ||
      CUni == "ঝ" ||
      CUni == "ঞ" ||
      CUni == "ট" ||
      CUni == "ঠ" ||
      CUni == "ড" ||
      CUni == "ঢ" ||
      CUni == "ণ" ||
      CUni == "ত" ||
      CUni == "থ" ||
      CUni == "দ" ||
      CUni == "ধ" ||
      CUni == "ন" ||
      CUni == "প" ||
      CUni == "ফ" ||
      CUni == "ব" ||
      CUni == "ভ" ||
      CUni == "ম" ||
      CUni == "শ" ||
      CUni == "ষ" ||
      CUni == "স" ||
      CUni == "হ" ||
      CUni == "য" ||
      CUni == "র" ||
      CUni == "ল" ||
      CUni == "য়" ||
      CUni == "ং" ||
      CUni == "ঃ" ||
      CUni == "ঁ" ||
      CUni == "ৎ"
    )
      return true;
    return false;
  }
  function IsBanglaNukta(CUni) {
    if (CUni == "ং" || CUni == "ঃ" || CUni == "ঁ") return true;
    return false;
  }
  function IsBanglaHalant(CUni) {
    if (CUni == "্") return true;
    return false;
  }
  function IsSpace(C) {
    if (C == " " || C == "\t" || C == "\n" || C == "\r") return true;
    return false;
  }

  /* ---------- Glyph map (Bijoy/SutonnyMJ -> Unicode) ---------- */
  var BIJOY_MAP = {
  "i¨": "র‌্য",
  "ª¨": "্র্য",
  "°": "ক্ক",
  "±": "ক্ট",
  "³": "ক্ত",
  "K¡": "ক্ব",
  "¯Œ": "স্ক্র",
  µ: "ক্র",
  "K¬": "ক্ল",
  "¶": "ক্ষ",
  ÿ: "ক্ষ",
  "·": "ক্স",
  "¸": "গু",
  "»": "গ্ধ",
  Mœ: "গ্ন",
  "M¥": "গ্ম",
  "M­": "গ্ল",
  "¼": "ঙ্ক",
  "•¶": "ঙ্ক্ষ",
  "•L": "ঙ্খ",
  "½": "ঙ্গ",
  "•N": "ঙ্ঘ",
  "•": "ক্স",
  "”P": "চ্চ",
  "”Q": "চ্ছ",
  "”Q¡": "চ্ছ্ব",
  "”T": "চ্ঞ",
  "¾¡": "জ্জ্ব",
  "¾": "জ্জ",
  À: "জ্ঝ",
  Á: "জ্ঞ",
  "R¡": "জ্ব",
  Â: "ঞ্চ",
  Ã: "ঞ্ছ",
  Ä: "ঞ্জ",
  Å: "ঞ্ঝ",
  Æ: "ট্ট",
  "U¡": "ট্ব",
  "U¥": "ট্ম",
  Ç: "ড্ড",
  È: "ণ্ট",
  É: "ণ্ঠ",
  Ý: "ন্স",
  Ê: "ণ্ড",
  "š‘": "ন্তু",
  "Y\\^": "ণ্ব",
  Ë: "ত্ত",
  "Ë¡": "ত্ত্ব",
  Ì: "ত্থ",
  "Z¥": "ত্ম",
  "š—¡": "ন্ত্ব",
  "Z¡": "ত্ব",
  Î: "ত্র",
  "_¡": "থ্ব",
  "˜M": "দ্গ",
  "˜N": "দ্ঘ",
  Ï: "দ্দ",
  "×": "দ্ধ",
  "˜¡": "দ্ব",
  Ø: "দ্ব",
  "™¢": "দ্ভ",
  Ù: "দ্ম",
  "`ª“": "দ্রু",
  aŸ: "ধ্ব",
  "a¥": "ধ্ম",
  "›U": "ন্ট",
  Ú: "ন্ঠ",
  Û: "ন্ড",
  šÍ: "ন্ত",
  "š—": "ন্ত",
  "š¿": "ন্ত্র",
  "š’": "ন্থ",
  "›`": "ন্দ",
  "›Ø": "ন্দ্ব",
  Ü: "ন্ধ",
  bœ: "ন্ন",
  "š\\^": "ন্ব",
  "b¥": "ন্ম",
  Þ: "প্ট",
  ß: "প্ত",
  cœ: "প্ন",
  à: "প্প",
  cø: "প্ল",
  "c­": "প্ল",
  á: "প্স",
  "d¬": "ফ্ল",
  â: "ব্জ",
  ã: "ব্দ",
  ä: "ব্ধ",
  eŸ: "ব্ব",
  "e­": "ব্ল",
  å: "ভ্র",
  gœ: "ম্ন",
  "¤ú": "ম্প",
  ç: "ম্ফ",
  "¤\\^": "ম্ব",
  "¤¢": "ম্ভ",
  "¤£": "ম্ভ্র",
  "¤§": "ম্ম",
  "¤­": "ম্ল",
  "i“": "রু",
  iæ: "রু",
  iƒ: "রূ",
  é: "ল্ক",
  ê: "ল্গ",
  ë: "ল্ট",
  ì: "ল্ড",
  í: "ল্প",
  î: "ল্ফ",
  "j¦": "ল্ব",
  "j¥": "ল্ম",
  jø: "ল্ল",
  ï: "শু",
  ð: "শ্চ",
  kœ: "শ্ন",
  kø: "শ্ল",
  "k¦": "শ্ব",
  "k¥": "শ্ম",
  "k­": "শ্ল",
  "®‹": "ষ্ক",
  "®Œ": "ষ্ক্র",
  ó: "ষ্ট",
  ô: "ষ্ঠ",
  ò: "ষ্ণ",
  "®ú": "ষ্প",
  õ: "ষ্ফ",
  "®§": "ষ্ম",
  "¯‹": "স্ক",
  "÷": "স্ট",
  ö: "স্খ",
  "¯—": "স্ত",
  "¯Í": "স্ত",
  "¯‘": "স্তু",
  "¯¿": "স্ত্র",
  "¯’": "স্থ",
  mœ: "স্ন",
  "¯ú": "স্প",
  ù: "স্ফ",
  "¯\\^": "স্ব",
  "¯^": "স্ব", /* backslash-less variant seen in real pasted text (¯^ার্থ = স্বার্থ) */
  "¯§": "স্ম",
  "¯­": "স্ল",
  û: "হু",
  nè: "হ্ণ",
  ý: "হ্ন",
  þ: "হ্ম",
  "n¬": "হ্ল",
  ü: "হৃ",
  "©": "র্",
  Av: "আ",
  A: "অ",
  B: "ই",
  C: "ঈ",
  D: "উ",
  E: "ঊ",
  F: "ঋ",
  G: "এ",
  H: "ঐ",
  I: "ও",
  J: "ঔ",
  K: "ক",
  L: "খ",
  M: "গ",
  N: "ঘ",
  O: "ঙ",
  P: "চ",
  Q: "ছ",
  R: "জ",
  S: "ঝ",
  T: "ঞ",
  U: "ট",
  V: "ঠ",
  W: "ড",
  X: "ঢ",
  Y: "ণ",
  Z: "ত",
  _: "থ",
  "`": "দ",
  a: "ধ",
  b: "ন",
  c: "প",
  d: "ফ",
  e: "ব",
  f: "ভ",
  g: "ম",
  h: "য",
  i: "র",
  j: "ল",
  k: "শ",
  l: "ষ",
  m: "স",
  n: "হ",
  o: "ড়",
  p: "ঢ়",
  q: "য়",
  r: "ৎ",
  0: "০",
  1: "১",
  2: "২",
  3: "৩",
  4: "৪",
  5: "৫",
  6: "৬",
  7: "৭",
  8: "৮",
  9: "৯",
  v: "া",
  w: "ি",
  x: "ী",
  y: "ু",
  z: "ু",
  "~": "ূ",
  "„": "ৃ",
  "‡": "ে",
  "†": "ে",
  "‰": "ৈ",
  "\\ˆ": "ৈ",
  Š: "ৗ",
  Ô: "‘",
  Õ: "’",
  "\\|": "।",
  "|": "।", /* lone pipe = dari (SutonnyMJ copies often lose the backslash) */
  Ò: "“",
  Ó: "”",
  s: "ং",
  t: "ঃ",
  u: "ঁ",
  ª: "্র",
  Ö: "্র",
  "«": "্র",
  "¨": "্য",
  "\\&": "্",
  "…": "ৃ",
};

  /* Longest keys first: "Av" must win over "A", conjuncts over singles. */
  var BIJOY_KEYS = Object.keys(BIJOY_MAP).sort(function (a, b) {
    return b.length - a.length;
  });

  function ReArrangeUnicodeConvertedText(str) {
    for (var i = 0; i < str.length; i++) {
      if (
        i > 0 &&
        str.charAt(i) == "\u09CD" &&
        (IsBanglaKar(str.charAt(i - 1)) || IsBanglaNukta(str.charAt(i - 1))) &&
        i < str.length - 1
      ) {
        var temp = str.substring(0, i - 1);
        temp += str.charAt(i);
        temp += str.charAt(i + 1);
        temp += str.charAt(i - 1);
        temp += str.substring(i + 2, str.length);
        str = temp;
      }
      if (
        i > 0 &&
        i < str.length - 1 &&
        str.charAt(i) == "\u09CD" &&
        str.charAt(i - 1) == "\u09B0" &&
        str.charAt(i - 2) != "\u09CD" &&
        IsBanglaKar(str.charAt(i + 1))
      ) {
        var temp = str.substring(0, i - 1);
        temp += str.charAt(i + 1);
        temp += str.charAt(i - 1);
        temp += str.charAt(i);
        temp += str.substring(i + 2, str.length);
        str = temp;
      }
      if (
        i < str.length - 1 &&
        str.charAt(i) == "র" &&
        IsBanglaHalant(str.charAt(i + 1)) &&
        !IsBanglaHalant(str.charAt(i - 1)) &&
        !IsBanglaKar(str.charAt(i - 1)) &&
        !IsBanglaNukta(str.charAt(i - 1))
      ) {
        /* reph hops left over ONE consonant cluster — but never over a
           vowel sign/nukta: র after া/ি/ং starts a new syllable
           (স্বার্থ = স্+ব+া+র্থ), it is not a reph. */
        var j = 1;
        while (true) {
          if (i - j < 0) break;
          if (
            IsBanglaBanjonborno(str.charAt(i - j)) &&
            IsBanglaHalant(str.charAt(i - j - 1))
          )
            j += 2;
          else if (j == 1 && IsBanglaKar(str.charAt(i - j))) j++;
          else break;
        }
        var temp = str.substring(0, i - j);
        temp += str.charAt(i);
        temp += str.charAt(i + 1);
        temp += str.substring(i - j, i);
        temp += str.substring(i + 2, str.length);
        str = temp;
        i += 1;
        continue;
      }
      if (
        i < str.length - 1 &&
        IsBanglaPreKar(str.charAt(i)) &&
        IsSpace(str.charAt(i + 1)) == false &&
        !IsBanglaBanjonborno(str.charAt(i - 1)) &&
        !IsBanglaHalant(str.charAt(i - 1)) &&
        !IsBanglaNukta(str.charAt(i - 1))
      ) {
        /* ি/ে/ৈ hops right over its cluster — but never when already
           after a consonant/halant: then it is Unicode order already
           (তিনি, বলেন untouched), Bijoy order puts it BEFORE. */
        var temp = str.substring(0, i);
        var j = 1;
        while (IsBanglaBanjonborno(str.charAt(i + j))) {
          if (IsBanglaHalant(str.charAt(i + j + 1))) j += 2;
          else break;
        }
        temp += str.substring(i + 1, i + j + 1);
        var l = 0;
        if (str.charAt(i) == "ে" && str.charAt(i + j + 1) == "া") {
          temp += "ো";
          l = 1;
        } else if (str.charAt(i) == "ে" && str.charAt(i + j + 1) == "ৗ") {
          temp += "ৌ";
          l = 1;
        } else temp += str.charAt(i);
        temp += str.substring(i + j + l + 1, str.length);
        str = temp;
        i += j;
      }
      if (
        i < str.length - 1 &&
        str.charAt(i) == "ঁ" &&
        IsBanglaPostKar(str.charAt(i + 1))
      ) {
        var temp = str.substring(0, i);
        temp += str.charAt(i + 1);
        temp += str.charAt(i);
        temp += str.substring(i + 2, str.length);
        str = temp;
      }
    }
    return str;
  }

  var MARKER_RE = /[¨ª°±³¡¯Œµ¬¶ÿ·¸»œ¥­¼•½”¾ÀÁÂÃÄÅÆÇÈÉÝÊš‘ËÌ—Î˜Ï×Ø™¢Ù“Ÿ›ÚÛÍ¿’ÜÞßàøáâãäå¤úç£§æƒéêëìíî¦ïð®‹óôòõ÷öùûèýþü©„‡†‰ˆŠÔÕÒÓÖ«…]/;
  var BENGALI_RE = /[\u0980-\u09FF]/;
  var URL_RE = /https?:\/\/[^\s<>"']+/g;
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

  function containsBengali(s) {
    return BENGALI_RE.test(String(s == null ? '' : s));
  }

  /* True when text carries Bijoy-only glyph bytes (SutonnyMJ) and no
     Unicode Bangla yet. Pure-ASCII Bijoy ("Avgvi") is indistinguishable
     from English, so it is NOT auto-detected: pick Bijoy mode manually. */
  function looksLikeBijoy(s) {
    if (s == null) return false;
    s = String(s);
    if (!s) return false;
    if (BENGALI_RE.test(s)) return false;
    return MARKER_RE.test(s);
  }

  /* URL/email masking so http links survive the ASCII->Bangla mapping.
     Placeholders use PUA chars (never in the glyph map, incl. digits). */
  function maskRe(s, re, store) {
    return String(s).replace(re, function (m) {
      store.push(m);
      var ph = '\u0001';
      var n = store.length - 1;
      var digits = String(n);
      for (var i = 0; i < digits.length; i++) {
        ph += String.fromCharCode(0xe000 + (digits.charCodeAt(i) - 48));
      }
      return ph + '\u0002';
    });
  }

  function unmask(s, store) {
    return String(s).replace(/\u0001([\ue000-\ue009]+)\u0002/g, function (m, enc) {
      var num = '';
      for (var i = 0; i < enc.length; i++) {
        num += String(enc.charCodeAt(i) - 0xe000);
      }
      var idx = parseInt(num, 10);
      return store[idx] !== undefined ? store[idx] : m;
    });
  }

  var ENTITY_RE = /&[a-zA-Z#0-9]+;/g;

  /* Tag-aware conversion for editor HTML: only text between tags is
     converted, markup/attributes stay intact. Entities (&amp; etc.)
     are masked so their latin letters never convert. */
  function convertHtmlMixed(input) {
    var s = String(input == null ? '' : input);
    if (!s) return s;
    var parts = s.split(/(<[^<>]*>)/g);
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (!seg || seg.charAt(0) === '<') continue;
      var store = [];
      seg = maskRe(seg, URL_RE, store);
      seg = maskRe(seg, EMAIL_RE, store);
      seg = maskRe(seg, ENTITY_RE, store);
      if (looksLikeBijoy(seg)) {
        for (var k = 0; k < BIJOY_KEYS.length; k++) {
          var from = BIJOY_KEYS[k];
          if (seg.indexOf(from) === -1) continue;
          seg = seg.split(from).join(BIJOY_MAP[from]);
        }
        seg = ReArrangeUnicodeConvertedText(seg);
        if (seg.indexOf('\u0985\u09BE') !== -1) {
          seg = seg.split('\u0985\u09BE').join('\u0986');
        }
      }
      parts[i] = unmask(seg, store);
    }
    return parts.join('');
  }

  function convertBijoyToUnicode(input) {
    var line = String(input == null ? '' : input);
    if (!line) return line;
    var store = [];
    line = maskRe(line, URL_RE, store);
    line = maskRe(line, EMAIL_RE, store);
    for (var k = 0; k < BIJOY_KEYS.length; k++) {
      var from = BIJOY_KEYS[k];
      if (line.indexOf(from) === -1) continue;
      /* split/join = literal replace (no $ or regex pitfalls) */
      line = line.split(from).join(BIJOY_MAP[from]);
    }
    line = ReArrangeUnicodeConvertedText(line);
    if (line.indexOf('\u0985\u09BE') !== -1) {
      line = line.split('\u0985\u09BE').join('\u0986');
    }
    return unmask(line, store);
  }

  /* Force mode for the manual "বিজয়" toolbar button: pure-ASCII Bijoy
     ("MxeZ bv Kiv") carries no marker bytes, so auto-detect can never fire
     (English ambiguity). User explicitly invokes this, so a segment
     converts when it has marker bytes (even mixed with Unicode, e.g.
     ¯^ার্থ inside a Bengali sentence) or when it has no Bengali at all.
     Bengali segments WITHOUT markers are spared (existing Unicode text,
     English+digit runs like "সহিহ বুখারি: ১" stay intact). */
  function forceHtmlMixed(input) {
    var s = String(input == null ? '' : input);
    if (!s) return s;
    var parts = s.split(/(<[^<>]*>)/g);
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (!seg || seg.charAt(0) === '<') continue;
      if (BENGALI_RE.test(seg) && !MARKER_RE.test(seg)) continue;
      var store = [];
      seg = maskRe(seg, URL_RE, store);
      seg = maskRe(seg, EMAIL_RE, store);
      seg = maskRe(seg, ENTITY_RE, store);
      for (var k = 0; k < BIJOY_KEYS.length; k++) {
        var from = BIJOY_KEYS[k];
        if (seg.indexOf(from) === -1) continue;
        seg = seg.split(from).join(BIJOY_MAP[from]);
      }
      seg = ReArrangeUnicodeConvertedText(seg);
      if (seg.indexOf('অা') !== -1) {
        seg = seg.split('অা').join('আ');
      }
      parts[i] = unmask(seg, store);
    }
    return parts.join('');
  }

  /* mode: 'bijoy' | 'unicode' | 'auto'
     bijoy   -> convert unless already Unicode Bangla present
     auto    -> convert only when looksLikeBijoy()
     unicode -> never */
  function shouldConvert(text, mode) {
    if (mode === 'unicode') return false;
    if (text == null || String(text) === '') return false;
    if (mode === 'bijoy') return !containsBengali(text);
    return looksLikeBijoy(text);
  }

  function convertIfNeeded(text, mode) {
    return shouldConvert(text, mode) ? convertBijoyToUnicode(text) : String(text == null ? '' : text);
  }

  return {
    convertBijoyToUnicode: convertBijoyToUnicode,
    convertHtmlMixed: convertHtmlMixed,
    forceHtmlMixed: forceHtmlMixed,
    convertIfNeeded: convertIfNeeded,
    shouldConvert: shouldConvert,
    looksLikeBijoy: looksLikeBijoy,
    containsBengali: containsBengali,
    BIJOY_KEYS_COUNT: BIJOY_KEYS.length
  };
});
