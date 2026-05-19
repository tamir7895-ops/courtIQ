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

  /* Overlay registry — fullscreen screens that sit above tabs (no bottom nav).
     Each entry: { global, method } or just a string (uses .render). */
  var OVERLAYS = {
    'camera-hud':        { global: 'CourtIQ_V2_CameraHUD',      method: 'render' },
    'post-session':      { global: 'CourtIQ_V2_PostSession',     method: 'render' },
    'workout-player':    { global: 'CIQ_PLAYER',                 method: 'start'  },
    'avatar-customizer': { global: 'CourtIQ_V2_AvatarCustomizer', method: 'render' },
    'onboarding':        { global: 'CourtIQ_V2_OnboardingV2',    method: 'render' }
  };

  /* Basketball-crafted icon paths — every icon feels sport-specific. */
  var ICON_PATHS = {
    /* Basketball — circle with seams (the sport's universal symbol) */
    home: [
      ['circle', { cx: '12', cy: '12', r: '9' }],
      ['path',   { d: 'M3 12h18' }],
      ['path',   { d: 'M8.5 3.3Q5.5 12 8.5 20.7' }],
      ['path',   { d: 'M15.5 3.3Q18.5 12 15.5 20.7' }]
    ],
    /* Whistle — coach's training whistle with sound waves */
    train: [
      ['path',   { d: 'M2 10v4h3l1.5 2h6a4 4 0 0 0 0-8H6.5L5 10z' }],
      ['circle', { cx: '14.5', cy: '12', r: '1', fill: 'currentColor', stroke: 'none' }],
      ['path',   { d: 'M19 9l2-1.5M19 15l2 1.5M20 12h2' }]
    ],
    /* Hoop front view — backboard, rim support, rim, net threads */
    track: [
      ['path',   { d: 'M3 5h18' }],
      ['line',   { x1: '12', y1: '5', x2: '12', y2: '8' }],
      ['rect',   { x: '6', y: '8', width: '12', height: '1.5', rx: '.75' }],
      ['path',   { d: 'M7.5 9.5l1.5 7M12 9.5v7.5M16.5 9.5l-1.5 7' }]
    ],
    /* Clipboard with X-O play diagram */
    coach: [
      ['rect',   { x: '5', y: '4', width: '14', height: '17', rx: '2' }],
      ['path',   { d: 'M9 2v3h6V2' }],
      ['path',   { d: 'M8.5 10.5l2 2m0-2l-2 2' }],
      ['circle', { cx: '16', cy: '11.5', r: '1.5' }],
      ['path',   { d: 'M11 13l3.5-2.5', 'stroke-dasharray': '2 1.5' }]
    ],
    /* Player silhouette with headband */
    me: [
      ['circle', { cx: '12', cy: '8', r: '4' }],
      ['path',   { d: 'M4 21a8 8 0 0 1 16 0' }],
      ['path',   { d: 'M8 7h8' }]
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
    var svg = svgEl('svg', { width: '28', height: '28', viewBox: '0 0 200 200', style: 'flex-shrink:0' });
    var g = svgEl('g', { fill: 'none', stroke: '#FF6A00', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });

    /* Basketball circle */
    g.appendChild(svgEl('circle', { cx: '100', cy: '100', r: '58', 'stroke-width': '5' }));

    /* Basketball seam — single horizontal arc */
    g.appendChild(svgEl('path', { d: 'M42 100 Q100 60, 158 100', 'stroke-width': '3' }));

    /* Basketball seam — single vertical arc */
    g.appendChild(svgEl('path', { d: 'M100 42 Q140 100, 100 158', 'stroke-width': '3' }));

    /* Crosshair lines extending beyond circle */
    g.appendChild(svgEl('line', { x1: '100', y1: '30', x2: '100', y2: '14', 'stroke-width': '4' }));
    g.appendChild(svgEl('line', { x1: '100', y1: '170', x2: '100', y2: '186', 'stroke-width': '4' }));
    g.appendChild(svgEl('line', { x1: '30', y1: '100', x2: '14', y2: '100', 'stroke-width': '4' }));
    g.appendChild(svgEl('line', { x1: '170', y1: '100', x2: '186', y2: '100', 'stroke-width': '4' }));

    /* Crosshair tick marks (T-ends) */
    g.appendChild(svgEl('line', { x1: '93', y1: '14', x2: '107', y2: '14', 'stroke-width': '3.5' }));
    g.appendChild(svgEl('line', { x1: '93', y1: '186', x2: '107', y2: '186', 'stroke-width': '3.5' }));
    g.appendChild(svgEl('line', { x1: '14', y1: '93', x2: '14', y2: '107', 'stroke-width': '3.5' }));
    g.appendChild(svgEl('line', { x1: '186', y1: '93', x2: '186', y2: '107', 'stroke-width': '3.5' }));

    /* Signal waves — left */
    g.appendChild(svgEl('path', { d: 'M24 74 Q6 87, 6 100 Q6 113, 24 126', 'stroke-width': '4' }));
    g.appendChild(svgEl('path', { d: 'M14 60 Q-8 80, -8 100 Q-8 120, 14 140', 'stroke-width': '3.5', opacity: '0.65' }));

    /* Signal waves — right */
    g.appendChild(svgEl('path', { d: 'M176 74 Q194 87, 194 100 Q194 113, 176 126', 'stroke-width': '4' }));
    g.appendChild(svgEl('path', { d: 'M186 60 Q208 80, 208 100 Q208 120, 186 140', 'stroke-width': '3.5', opacity: '0.65' }));

    svg.appendChild(g);
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
    var brandLabelCourt = document.createTextNode('Court');
    var iqSpan = el('span', { text: 'IQ', style: 'color:#FF6A00;font-weight:800' });
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
  var activeOverlay = null;

  function cleanupActiveOverlay() {
    if (activeOverlay) {
      var ren = window[activeOverlay];
      if (ren) {
        // Try cleanup first, then close (CIQ_PLAYER uses .close())
        var fn = ren.cleanup || ren.close;
        if (typeof fn === 'function') {
          try { fn.call(ren); } catch (e) { console.warn('[ciq-shell] overlay cleanup', e); }
        }
      }
      activeOverlay = null;
    }
  }

  function switchTo(tabId, data) {
    /* ── Overlay screens (fullscreen, no bottom nav) ── */
    if (OVERLAYS[tabId]) {
      var oDef = OVERLAYS[tabId];
      var oGlobal = oDef.global;
      var oMethod = oDef.method || 'render';
      var overlay = window[oGlobal];
      if (overlay && typeof overlay[oMethod] === 'function') {
        cleanupActiveOverlay();
        activeOverlay = oGlobal;
        try {
          overlay[oMethod](data);
        } catch (e) {
          console.error('[ciq-shell] overlay', tabId, 'threw', e);
          activeOverlay = null;
        }
      } else {
        console.warn('[ciq-shell] no overlay renderer for', tabId, '(' + oGlobal + '.' + oMethod + ')');
      }
      return;
    }

    /* ── Main tabs ── */
    var def = TABS.find(function (t) { return t.id === tabId; });
    if (!def) return;

    // Close any active overlay first
    cleanupActiveOverlay();

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
