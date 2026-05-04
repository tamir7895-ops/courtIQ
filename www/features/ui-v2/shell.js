/* CourtIQ UI v2 — shell.js (Wave 1 redesign)
 *
 * Renders the v2 chrome: keeps the lightweight topbar (logo + bell)
 * and replaces the bottom nav with the new Claude Design `.ciq-nav`
 * markup — colored active glow, dot indicator, refined stroke icons.
 *
 * Tab activation order on click:
 *   1. window.CourtIQ_V2_<TabName>.render(host)  — new v2 renderer
 *   2. window.dbSwitchTab(legacyId)              — legacy panel switcher
 *
 * As v2 renderers land they take over their tab; until then the legacy
 * panel keeps rendering. Rollback = SHELL_ACTIVE=false in config.js.
 *
 * All DOM is built via createElement / createElementNS — no innerHTML.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.SHELL_ACTIVE) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* Tab registry — maps v2 tab id → legacy panel id + renderer global. */
  var TABS = [
    { id: 'home',  legacy: 'home',      label: 'Home',  accent: '#f5a623', glow: 'rgba(245,166,35,0.40)',  rendererGlobal: 'CourtIQ_V2_Home'  },
    { id: 'train', legacy: 'training',  label: 'Train', accent: '#4ca3ff', glow: 'rgba(76,163,255,0.40)',  rendererGlobal: 'CourtIQ_V2_Train' },
    { id: 'track', legacy: 'shots',     label: 'Track', accent: '#56d364', glow: 'rgba(86,211,100,0.40)',  rendererGlobal: 'CourtIQ_V2_Track' },
    { id: 'coach', legacy: 'coach',     label: 'Coach', accent: '#bc8cff', glow: 'rgba(188,140,255,0.40)', rendererGlobal: 'CourtIQ_V2_Coach' },
    { id: 'me',    legacy: 'archetype', label: 'Me',    accent: '#2dd4bf', glow: 'rgba(45,212,191,0.40)',  rendererGlobal: 'CourtIQ_V2_Me'    }
  ];

  /* Refined stroke-icon path data (from _design-import/v2/components/ciq-shell.jsx). */
  var ICON_PATHS = {
    home:  [['path', { d: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z' }]],
    train: [
      ['path', { d: 'M6 6L4 4M18 6l2-2M6 18l-2 2M18 18l2 2' }],
      ['path', { d: 'M9 9l-3 0 0 6 3 0M15 9l3 0 0 6-3 0M9 12h6' }]
    ],
    track: [
      ['path', { d: 'M3 17l5-5 4 4 8-8' }],
      ['path', { d: 'M16 8h4v4' }]
    ],
    coach: [['path', { d: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z' }]],
    me:    [
      ['circle', { cx: '12', cy: '8', r: '4' }],
      ['path',   { d: 'M4 21a8 8 0 0 1 16 0' }]
    ]
  };

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    }
    return el;
  }

  function buildIcon(tabId) {
    var svg = svgEl('svg', {
      viewBox: '0 0 24 24',
      class: 'ciq-nav__icon',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.6',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
    });
    ICON_PATHS[tabId].forEach(function (p) { svg.appendChild(svgEl(p[0], p[1])); });
    return svg;
  }

  function buildBellIcon() {
    var svg = svgEl('svg', {
      viewBox: '0 0 24 24',
      width: '18', height: '18',
      fill: 'none', stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    });
    svg.appendChild(svgEl('path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }));
    svg.appendChild(svgEl('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' }));
    return svg;
  }

  function buildBrandMark() {
    var svg = svgEl('svg', { width: '26', height: '26', viewBox: '0 0 200 200', style: 'flex-shrink:0' });
    svg.appendChild(svgEl('circle', { cx: '100', cy: '100', r: '86', fill: 'none', stroke: '#F5A623', 'stroke-width': '7' }));
    var paths = [
      'M100 14 Q78 58, 100 100 Q122 58, 100 14 Z',
      'M186 100 Q142 78, 100 100 Q142 122, 186 100 Z',
      'M100 186 Q122 142, 100 100 Q78 142, 100 186 Z',
      'M14 100 Q58 122, 100 100 Q58 78, 14 100 Z'
    ];
    paths.forEach(function (d) { svg.appendChild(svgEl('path', { d: d, fill: '#F5A623' })); });
    return svg;
  }

  function el(tag, opts, children) {
    var n = document.createElement(tag);
    if (opts) {
      if (opts.className) n.className = opts.className;
      if (opts.text) n.textContent = opts.text;
      if (opts.attrs) Object.keys(opts.attrs).forEach(function (k) { n.setAttribute(k, opts.attrs[k]); });
      if (opts.style) n.setAttribute('style', opts.style);
    }
    if (children) children.forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function findMount() {
    var mount = document.getElementById('ciq-chrome-mount');
    if (mount) return mount;
    mount = document.createElement('div');
    mount.id = 'ciq-chrome-mount';
    document.body.appendChild(mount);
    return mount;
  }

  function renderTopbar(container) {
    var brandMark = buildBrandMark();
    var brandLabelCourt = document.createTextNode('COURT');
    var iqSpan = el('span', { text: 'IQ' });
    var brand = el('div', { className: 'brand' });
    brand.appendChild(brandMark);
    brand.appendChild(brandLabelCourt);
    brand.appendChild(iqSpan);

    var bellBtn = el('button', {
      className: 'ciq-icon-btn',
      attrs: { 'aria-label': 'Notifications', 'data-ciq-action': 'notifications' }
    }, [buildBellIcon()]);
    bellBtn.addEventListener('click', function () {
      if (typeof window.dbSwitchTab === 'function') {
        window.dbSwitchTab('notifications');
      }
    });

    var topbar = el('div', { className: 'ciq-topbar' }, [brand, bellBtn]);
    container.appendChild(topbar);
  }

  function buildNavButton(tab) {
    var fill = el('span', { className: 'ciq-nav__fill', attrs: { 'aria-hidden': 'true' } });
    var iconWrap = el('span', { className: 'ciq-nav__icon-wrap' }, [fill, buildIcon(tab.id)]);
    var label = el('span', { className: 'ciq-nav__lbl', text: tab.label });
    var dot = el('span', { className: 'ciq-nav__dot', attrs: { 'aria-hidden': 'true' } });
    var btn = el('button', {
      className: 'ciq-nav__btn',
      attrs: { type: 'button', role: 'tab', 'data-ciq-tab': tab.id }
    }, [iconWrap, label, dot]);
    btn.addEventListener('click', function () { switchTo(tab.id); });
    return btn;
  }

  function renderBottomNav(container) {
    var bg = el('div', { className: 'ciq-nav__bg' });
    var row = el('div', { className: 'ciq-nav__row' });
    TABS.forEach(function (t) { row.appendChild(buildNavButton(t)); });
    var nav = el('div', { className: 'ciq-nav', attrs: { role: 'tablist' } }, [bg, row]);
    container.appendChild(nav);
    return nav;
  }

  function paintActive(tabId) {
    var def = TABS.find(function (t) { return t.id === tabId; });
    if (!def) return;
    var nav = document.querySelector('.ciq-nav');
    if (nav) nav.style.setProperty('--ciq-nav-glow', def.glow);
    var btns = document.querySelectorAll('.ciq-nav__btn');
    btns.forEach(function (b) {
      var active = b.getAttribute('data-ciq-tab') === tabId;
      b.classList.toggle('is-active', active);
      if (active) {
        b.style.color = def.accent;
        b.style.setProperty('--ciq-nav-glow', def.glow);
      } else {
        b.style.color = '';
        b.style.removeProperty('--ciq-nav-glow');
      }
    });
    TABS.forEach(function (t) { document.body.classList.remove('ciq-tab-' + t.id); });
    document.body.classList.add('ciq-tab-' + tabId);
  }

  var currentTab = 'home';
  function switchTo(tabId) {
    var def = TABS.find(function (t) { return t.id === tabId; });
    if (!def) return;
    currentTab = tabId;
    paintActive(tabId);

    var renderer = window[def.rendererGlobal];
    if (renderer && typeof renderer.render === 'function') {
      var host = document.getElementById('db-main-inner') || document.body;
      try {
        renderer.render(host);
      } catch (e) {
        console.error('[ciq-shell] v2 renderer for', tabId, 'threw', e);
        if (typeof window.dbSwitchTab === 'function') window.dbSwitchTab(def.legacy);
      }
      return;
    }
    if (typeof window.dbSwitchTab === 'function') {
      window.dbSwitchTab(def.legacy);
    } else {
      console.warn('[ciq-shell] no renderer or dbSwitchTab for', tabId);
    }
  }

  function init() {
    document.body.classList.add('ciq-active');
    document.body.classList.add('ciq-tab-' + currentTab);
    var mount = findMount();
    renderTopbar(mount);
    renderBottomNav(mount);
    setTimeout(function () { switchTo(currentTab); }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.CIQ_SHELL = { switchTo: switchTo, TABS: TABS };
})();
