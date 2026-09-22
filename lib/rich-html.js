/* Rich-text pipeline: sanitize editor HTML + bridge legacy plain/markdown.
 * Shared single source: browser global window.RichHtml + Node require().
 * - sanitize(html): allowlist tags (p/br/strong/em/u/h3/ul/ol/li/a,
 *   table/thead/tbody/tfoot/tr/th/td/caption), http(s) links only,
 *   everything else escaped or dropped. Script/style/iframe etc. dropped
 *   WITH their content.
 * - renderRich(src): editor HTML -> sanitize; legacy text -> BnFormat.
 * ES5 only. Node needs ./bn-format.js beside it; browser needs BnFormat global.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./bn-format.js'));
  } else {
    root.RichHtml = factory(root.BnFormat || null);
  }
})(typeof self !== 'undefined' ? self : this, function (BnFormat) {
  'use strict';

  var ALLOWED = { p: 1, br: 1, strong: 1, em: 1, u: 1, s: 1, strike: 1, del: 1, h3: 1, ul: 1, ol: 1, li: 1, blockquote: 1, a: 1, table: 1, caption: 1, thead: 1, tbody: 1, tfoot: 1, tr: 1, th: 1, td: 1 };
  var RENAME = { b: 'strong', i: 'em', div: 'p' };
  /* dropped WITH content */
  var DROP_CONTENT = {
    script: 1, style: 1, iframe: 1, object: 1, embed: 1, form: 1, input: 1,
    button: 1, textarea: 1, select: 1, option: 1, link: 1, meta: 1, title: 1,
    head: 1, html: 1, body: 1, svg: 1, math: 1, video: 1, audio: 1, source: 1,
    track: 1, canvas: 1, template: 1, noscript: 1, frame: 1, frameset: 1
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Single-pass entity decode (browser-serialized HTML passes through here).
     Named entities beyond amp/lt/gt/quot matter: editors serialize big gaps
     as &nbsp; — without this the sanitizer's esc() turns them into literal
     "&nbsp;" text on the page. */
  var NAMED_ENT = {
    nbsp: '\u00A0', mdash: '—', ndash: '–', hellip: '…',
    lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
    laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™',
    times: '×', divide: '÷', middot: '·', bull: '•'
  };
  function decodeEntities(s) {
    return String(s).replace(/&(?:amp|lt|gt|quot|#39|#x27|#x22|nbsp|mdash|ndash|hellip|lsquo|rsquo|ldquo|rdquo|laquo|raquo|copy|reg|trade|times|divide|middot|bull|#(\d+)|#x([0-9a-fA-F]+));/g,
      function (m, dec, hex) {
        if (NAMED_ENT[m.slice(1, -1)] !== undefined) return NAMED_ENT[m.slice(1, -1)];
        if (dec) {
          try {
            var c = parseInt(dec, 10);
            if (c > 0 && c < 0x110000) return String.fromCharCode(c);
          } catch (e) {}
          return m;
        }
        if (hex) {
          try {
            var h = parseInt(hex, 16);
            if (h > 0 && h < 0x110000) return String.fromCharCode(h);
          } catch (e2) {}
          return m;
        }
        switch (m) {
          case '&amp;': return '&';
          case '&lt;': return '<';
          case '&gt;': return '>';
          case '&quot;': return '"';
          case '&#39;': return "'";
          case '&#x27;': return "'";
          case '&#x22;': return '"';
          default: return m;
        }
      });
  }

  function getHref(tag) {
    var m = tag.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if (!m) return null;
    var u = (m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4])) || '';
    u = u.replace(/^\s+|\s+$/g, '');
    if (!/^https?:\/\//i.test(u)) return null;
    if (/[\x00-\x20<>"]/.test(u)) return null;
    return u;
  }

  function sanitize(html) {
    var s = String(html == null ? '' : html);
    if (!s) return '';
    var out = [];
    var dropStack = [];
    var aStack = [];
    var parts = s.split(/(<[^<>]*>)/g);
    for (var i = 0; i < parts.length; i++) {
      var tok = parts[i];
      if (!tok) continue;
      if (tok.charAt(0) !== '<') {
        if (dropStack.length) continue;
        out.push(esc(decodeEntities(tok)));
        continue;
      }
      /* tag token */
      if (/^<!--/.test(tok) || /^<![^>]/.test(tok) || /^<\?/.test(tok)) continue; /* comments/doctype */
      var m = tok.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)\b/);
      if (!m) {
        if (!dropStack.length) out.push(esc(tok));
        continue;
      }
      var name = m[1].toLowerCase();
      var closing = tok.charAt(1) === '/';
      if (DROP_CONTENT[name]) {
        if (!closing) dropStack.push(name);
        else if (dropStack.length && dropStack[dropStack.length - 1] === name) dropStack.pop();
        else if (dropStack.length) dropStack.pop();
        continue;
      }
      if (dropStack.length) continue;
      if (RENAME[name]) name = RENAME[name];
      if (!ALLOWED[name]) continue; /* unknown tag: drop, keep content */
      if (name === 'br') {
        if (!closing) out.push('<br>');
        continue;
      }
      if (name === 'a') {
        if (!closing) {
          var href = getHref(tok);
          aStack.push(!!href);
          out.push(href ? '<a href="' + esc(href) + '" rel="noopener">' : '');
        } else {
          var ok = aStack.pop();
          if (ok) out.push('</a>');
        }
        continue;
      }
      out.push(closing ? '</' + name + '>' : '<' + name + '>');
    }
    return out.join('');
  }

  function hasHtml(s) {
    return /<\/?(p|div|strong|b|em|i|u|s|strike|del|h3|ul|ol|li|blockquote|a|br|table|thead|tbody|tfoot|tr|th|td|caption)[\s>/]/i.test(String(s));
  }

  function fallbackRender(src) {
    return '<p>' + esc(src).replace(/\n/g, '<br>') + '</p>';
  }

  /* Editor HTML -> sanitize; legacy plain/markdown -> BnFormat. */
  function renderRich(src) {
    src = String(src == null ? '' : src);
    if (!src) return '';
    if (hasHtml(src)) return sanitize(src);
    if (BnFormat && BnFormat.renderHtml) return BnFormat.renderHtml(src);
    return fallbackRender(src);
  }

  return {
    sanitize: sanitize,
    renderRich: renderRich,
    hasHtml: hasHtml,
    esc: esc
  };
});
