/* Bangla markdown-lite formatter: **bold** *italic* ## heading - list [text](url).
 * Shared single source: browser global window.BnFormat + Node require().
 * XSS-safe by construction: HTML is escaped FIRST, markers transformed after,
 * link URLs restricted to http/https. ES5 only, no dependencies.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.BnFormat = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* Inline markers on already-escaped text. */
  function inline(s) {
    /* [text](https://...) — http/https only, else literal text */
    s = String(s).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      function (m, t, u) {
        return '<a href="' + u + '" rel="noopener">' + t + '</a>';
      });
    /* **bold** before *italic* */
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    return s;
  }

  /* Full text -> safe HTML (paragraphs, ## headings, - lists). */
  function renderHtml(src) {
    var lines = String(src == null ? '' : src).split('\n');
    var html = '';
    var para = [];
    var list = [];
    function flushPara() {
      if (para.length) {
        html += '<p>' + inline(esc(para.join('\n')).replace(/\n/g, '<br>')) + '</p>';
        para = [];
      }
    }
    function flushList() {
      if (list.length) {
        html += '<ul><li>' + list.join('</li><li>') + '</li></ul>';
        list = [];
      }
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var t = line.replace(/^\s+|\s+$/g, '');
      if (!t) {
        flushPara();
        flushList();
        continue;
      }
      var h = t.match(/^##\s+(.*)$/);
      if (h && h[1]) {
        flushPara();
        flushList();
        html += '<h3>' + inline(esc(h[1])) + '</h3>';
        continue;
      }
      var li = t.match(/^-\s+(.*)$/);
      if (li && li[1]) {
        flushPara();
        list.push(inline(esc(li[1])));
        continue;
      }
      flushList();
      para.push(line);
    }
    flushPara();
    flushList();
    return html;
  }

  /* Markers stripped -> plain text (list snippets, search excerpts).
     Editor HTML is tag-stripped first. */
  function toPlain(src) {
    var s = String(src == null ? '' : src);
    s = s.replace(/<[^<>]*>/g, ' ');
    s = s.replace(/ {2,}/g, ' ');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1');
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1$2');
    s = s.replace(/^##\s+/gm, '');
    s = s.replace(/^-\s+/gm, '');
    return s;
  }

  return {
    renderHtml: renderHtml,
    toPlain: toPlain,
    esc: esc
  };
});
