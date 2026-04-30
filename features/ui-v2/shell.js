/* CourtIQ UI v2 — shell.js
 *
 * Thin vanilla-JS module. When SHELL_ACTIVE is true:
 *   1. Adds `body.ciq-active` so components.css activates.
 *   2. Renders a fixed topbar (CourtIQ logo + notifications button).
 *   3. Renders a 5-tab bottom nav (Home, Train, Track, Coach, Me).
 *   4. Routes tab clicks onto the existing `dbSwitchTab()` so all
 *      legacy panel content keeps rendering inside the shell.
 *   5. Maintains `body.ciq-tab-<id>` so tab CSS can target the
 *      active tab without JS further.
 *
 * No panel JS changes. Rollback = set SHELL_ACTIVE=false and reload.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.SHELL_ACTIVE) return;

  /* ── Tab registry — maps v2 tab id → legacy panel id consumed by dbSwitchTab ── */
  var TABS = [
    { id: 'home',  legacy: 'home',      label: 'Home',  accent: '#f5a623' },
    { id: 'train', legacy: 'training',  label: 'Train', accent: '#4ca3ff' },
    { id: 'track', legacy: 'shots',     label: 'Track', accent: '#56d364' },
    { id: 'coach', legacy: 'coach',     label: 'Coach', accent: '#bc8cff' },
    { id: 'me',    legacy: 'archetype', label: 'Me',    accent: '#2dd4bf' }
  ];

  /* ── Inline stroke icons (lifted from design's Icons.jsx) ── */
  function svg(paths, size) {
    size = size || 22;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" '
      + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + paths + '</svg>';
  }
  var ICONS = {
    home:  function (s) { return svg('<path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/>', s); },
    train: function (s) { return svg('<path d="M6.5 6.5l11 11"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>', s); },
    track: function (s) { return svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 4 4 5-5"/>', s); },
    coach: function (s) { return svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', s); },
    me:    function (s) { return svg('<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>', s); },
    bell:  function (s) { return svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', s); }
  };

  /* ── Brand mark — CourtIQ logo SVG from Chrome.jsx TopBar ── */
  var BRAND_SVG = '<svg width="26" height="26" viewBox="0 0 200 200" style="flex-shrink:0">'
    + '<circle cx="100" cy="100" r="86" fill="none" stroke="#F5A623" stroke-width="7"/>'
    + '<path d="M100 14 Q78 58, 100 100 Q122 58, 100 14 Z" fill="#F5A623"/>'
    + '<path d="M186 100 Q142 78, 100 100 Q142 122, 186 100 Z" fill="#F5A623"/>'
    + '<path d="M100 186 Q122 142, 100 100 Q78 142, 100 186 Z" fill="#F5A623"/>'
    + '<path d="M14 100 Q58 122, 100 100 Q58 78, 14 100 Z" fill="#F5A623"/>'
    + '</svg>';

  function findMount() {
    var mount = document.getElementById('ciq-chrome-mount');
    if (mount) return mount;
    // Fallback: create one as last child of body so we can still render.
    mount = document.createElement('div');
    mount.id = 'ciq-chrome-mount';
    document.body.appendChild(mount);
    return mount;
  }

  function renderTopbar(container) {
    var topbar = document.createElement('div');
    topbar.className = 'ciq-topbar';
    topbar.innerHTML =
      '<div class="brand">' + BRAND_SVG + 'COURT<span>IQ</span></div>'
      + '<button class="ciq-icon-btn" aria-label="Notifications" data-ciq-action="notifications">'
      + ICONS.bell(18)
      + '</button>';
    container.appendChild(topbar);
    topbar.querySelector('[data-ciq-action="notifications"]').addEventListener('click', function () {
      if (typeof window.dbSwitchTab === 'function') {
        window.dbSwitchTab('notifications');
      }
    });
  }

  function renderBottomNav(container) {
    var nav = document.createElement('div');
    nav.className = 'ciq-bottom-nav';
    nav.setAttribute('role', 'tablist');
    nav.style.setProperty('--accent', TABS[0].accent);

    TABS.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ciq-nav-item';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('data-ciq-tab', t.id);
      btn.setAttribute('data-ciq-legacy', t.legacy);
      btn.style.setProperty('--accent', t.accent);
      btn.innerHTML =
        '<div class="chip">' + ICONS[t.id](20) + '</div>'
        + '<div class="lb">' + t.label + '</div>';
      btn.addEventListener('click', function () { switchTo(t.id); });
      nav.appendChild(btn);
    });

    container.appendChild(nav);
    return nav;
  }

  var currentTab = 'home';
  function switchTo(tabId) {
    var def = TABS.find(function (t) { return t.id === tabId; });
    if (!def) return;
    currentTab = tabId;

    // Paint active state
    document.querySelectorAll('.ciq-nav-item').forEach(function (el) {
      var active = el.getAttribute('data-ciq-tab') === tabId;
      el.classList.toggle('active', active);
    });
    var nav = document.querySelector('.ciq-bottom-nav');
    if (nav) nav.style.setProperty('--accent', def.accent);

    // Body-level class so per-tab CSS can target.
    TABS.forEach(function (t) { document.body.classList.remove('ciq-tab-' + t.id); });
    document.body.classList.add('ciq-tab-' + tabId);

    // Delegate to legacy panel switcher.
    if (typeof window.dbSwitchTab === 'function') {
      window.dbSwitchTab(def.legacy);
    } else {
      console.warn('[ciq-shell] dbSwitchTab not found on window; legacy panel not switched');
    }
  }

  function init() {
    document.body.classList.add('ciq-active');
    document.body.classList.add('ciq-tab-' + currentTab);
    var mount = findMount();
    renderTopbar(mount);
    renderBottomNav(mount);
    // Default highlight + route to initial tab after a tick so dashboard.js has registered.
    setTimeout(function () { switchTo(currentTab); }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual testing in console: CIQ_SHELL.switchTo('track')
  window.CIQ_SHELL = { switchTo: switchTo, TABS: TABS };
})();
