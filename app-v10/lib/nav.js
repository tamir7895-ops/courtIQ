/* CourtIQ v12 — bottom navigation
   Five tabs, icons only (the user's sketch + Duolingo's bar). Each tab
   owns a feature color; the active icon sits in a tinted rounded box.
   TRACK and TRAIN merged into one tab — 'train' routes still exist for
   deep links, they just light the track icon.
   Idempotent: built once, setActive() only toggles classes.
   ============================================================ */
(function () {
  'use strict';

  // Phosphor uses `<weight-class> <icon-name>` (e.g. `ph-fill ph-house`).
  var TABS = [
    { id: 'home',   icon: 'ph-house',               label: 'Home' },
    { id: 'track',  icon: 'ph-basketball',          label: 'Tracking' },
    { id: 'social', icon: 'ph-users-three',         label: 'Social' },
    { id: 'coach',  icon: 'ph-chalkboard-teacher',  label: 'Coach' },
    { id: 'me',     icon: 'ph-user',                label: 'Profile' }
  ];

  // Screens that belong to a tab without being one.
  var ALIAS = {
    train: 'track', 'drill-library': 'track', 'workout-player': 'track',
    'post-session': 'track', 'camera-hud': 'track',
    'avatar-customizer': 'me', notifications: 'home', onboarding: 'home'
  };

  var navEl = null;
  var itemsById = {};

  function buildNav(activeId) {
    if (navEl) { setActive(activeId); return navEl; }
    var nav = document.createElement('nav');
    nav.className = 'd-nav';
    nav.setAttribute('aria-label', 'Main');

    TABS.forEach(function (t) {
      var a = document.createElement('a');
      a.className = 'd-nav__item';
      a.setAttribute('data-tab', t.id);
      a.setAttribute('href', '#' + t.id);
      a.setAttribute('aria-label', t.label);

      var box = document.createElement('div');
      box.className = 'd-nav__box';
      var i = document.createElement('i');
      i.className = 'ph-bold ' + t.icon;
      box.appendChild(i);
      a.appendChild(box);

      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.app && typeof window.app.go === 'function') window.app.go(t.id);
      });

      nav.appendChild(a);
      itemsById[t.id] = { el: a, icon: i };
    });

    navEl = nav;
    return nav;
  }

  function setActive(activeId) {
    if (!navEl) {
      var existing = document.querySelector('.d-nav, .v10-nav');
      if (existing) existing.remove();
      document.body.appendChild(buildNav(activeId));
    }
    var id = ALIAS[activeId] || activeId;
    TABS.forEach(function (t) {
      var item = itemsById[t.id];
      if (!item) return;
      var isActive = (t.id === id);
      item.el.classList.toggle('is-active', isActive);
      item.icon.className = (isActive ? 'ph-fill ' : 'ph-bold ') + t.icon;
    });
  }

  window.V10Nav = { build: buildNav, setActive: setActive, TABS: TABS };
})();
