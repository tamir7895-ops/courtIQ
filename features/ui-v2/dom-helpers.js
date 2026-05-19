/* CourtIQ UI v2 — dom-helpers.js
 *
 * Tiny DOM-construction helpers shared by every v2 tab renderer.
 * No innerHTML usage — every node is built with createElement /
 * createElementNS so the security hooks stay green.
 *
 *   h('div', { class: 'foo', text: 'hi' })
 *   h('button', { class: 'btn', onclick: fn }, [iconNode, label])
 *   svg('svg', { viewBox: '0 0 24 24' }, [svg('path', { d: '...' })])
 */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function setAttrs(el, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class' || k === 'className') {
        // SVGElement.className is read-only (SVGAnimatedString); use setAttribute
        // which works correctly for both HTML and SVG nodes.
        el.setAttribute('class', v);
      } else if (k === 'text') {
        el.textContent = v;
      } else if (k === 'html') {
        // Last-resort raw markup. Skipped here — use h() with children instead.
      } else if (k === 'style' && typeof v === 'object') {
        Object.keys(v).forEach(function (s) {
          if (s.indexOf('--') === 0) el.style.setProperty(s, v[s]);
          else el.style[s] = v[s];
        });
      } else if (k.indexOf('on') === 0 && typeof v === 'function') {
        el.addEventListener(k.substring(2).toLowerCase(), v);
      } else if (k === 'data' && typeof v === 'object') {
        Object.keys(v).forEach(function (d) { el.setAttribute('data-' + d, v[d]); });
      } else {
        el.setAttribute(k, v);
      }
    });
  }

  function appendChildren(el, children) {
    if (children == null || children === false) return;
    if (typeof children === 'string' || typeof children === 'number') {
      el.appendChild(document.createTextNode(String(children)));
      return;
    }
    if (Array.isArray(children)) {
      children.forEach(function (c) { appendChildren(el, c); });
      return;
    }
    if (children && children.nodeType) {
      el.appendChild(children);
      return;
    }
  }

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    setAttrs(el, attrs);
    appendChildren(el, children);
    return el;
  }

  function svg(tag, attrs, children) {
    var el = document.createElementNS(SVG_NS, tag);
    setAttrs(el, attrs);
    appendChildren(el, children);
    return el;
  }

  function clearChildren(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  /* Hide every legacy db-panel-* — used when a v2 renderer takes over the screen. */
  function hideLegacyPanels() {
    var panels = document.querySelectorAll('[id^="db-panel-"]');
    panels.forEach(function (p) { p.setAttribute('data-ciq-hidden-by-v2', '1'); p.style.display = 'none'; });
  }
  function restoreLegacyPanels() {
    var panels = document.querySelectorAll('[data-ciq-hidden-by-v2]');
    panels.forEach(function (p) { p.removeAttribute('data-ciq-hidden-by-v2'); p.style.display = ''; });
  }

  /* Find or create a v2 host element inside the main scroll area.
     Hides all sibling v2 hosts so only the active tab is visible. */
  function ensureHost(id) {
    // Hide every other v2 host first
    var allHosts = document.querySelectorAll('.ciq-v2-host');
    allHosts.forEach(function (h) {
      if (h.id !== id) h.style.display = 'none';
    });

    var existing = document.getElementById(id);
    if (existing) {
      clearChildren(existing);
      existing.style.display = '';          // un-hide if it was hidden
      return existing;
    }
    var host = document.createElement('section');
    host.id = id;
    host.className = 'ciq-v2-host';
    var anchor = document.getElementById('db-main-inner') || document.body;
    anchor.appendChild(host);
    return host;
  }

  window.CourtIQ_V2_DOM = {
    h: h,
    svg: svg,
    clearChildren: clearChildren,
    ensureHost: ensureHost,
    hideLegacyPanels: hideLegacyPanels,
    restoreLegacyPanels: restoreLegacyPanels
  };
})();
