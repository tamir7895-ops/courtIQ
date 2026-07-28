/* CourtIQ v12 — bottom navigation
   Five tabs, icons only (the user's sketch + Duolingo's bar). Each tab
   owns a feature color; the active icon sits in a tinted rounded box.
   TRACK and TRAIN merged into one tab — 'train' routes still exist for
   deep links, they just light the track icon.
   Idempotent: built once, setActive() only toggles classes.
   ============================================================ */
(function () {
  'use strict';

  /* The nav is icon-only — these labels are what a screen reader says. */
  var T = {
    en: { 'nav.home': 'Home', 'nav.track': 'Tracking', 'nav.social': 'Social',
          'nav.coach': 'Coach', 'nav.me': 'Profile', 'nav.main': 'Main' },
    he: { 'nav.home': 'בית', 'nav.track': 'מעקב', 'nav.social': 'סושיאל',
          'nav.coach': 'מאמן', 'nav.me': 'פרופיל', 'nav.main': 'ניווט ראשי' }
  };
  if (window.V12I18n && window.V12I18n.add) window.V12I18n.add(T);
  function t(k) { return window.V12I18n ? window.V12I18n.t(k) : (T.en[k] || k); }

  // Phosphor uses `<weight-class> <icon-name>` (e.g. `ph-fill ph-house`).
  var TABS = [
    { id: 'home',   icon: 'ph-house',               labelKey: 'nav.home' },
    { id: 'track',  icon: 'ph-basketball',          labelKey: 'nav.track' },
    { id: 'social', icon: 'ph-users-three',         labelKey: 'nav.social' },
    { id: 'coach',  icon: 'ph-chalkboard-teacher',  labelKey: 'nav.coach' },
    { id: 'me',     icon: 'ph-user',                labelKey: 'nav.me' }
  ];

  // Screens that belong to a tab without being one.
  var ALIAS = {
    train: 'track', plan: 'track', 'drill-library': 'track', 'workout-player': 'track',
    'post-session': 'track', 'camera-hud': 'track',
    'avatar-customizer': 'me', shop: 'me', notifications: 'home', onboarding: 'home'
  };

  var navEl = null;
  var itemsById = {};

  function buildNav(activeId) {
    if (navEl) { setActive(activeId); return navEl; }
    var nav = document.createElement('nav');
    nav.className = 'd-nav';
    nav.setAttribute('aria-label', t('nav.main'));

    /* `tb`, not `t` — the callback param would shadow the t() helper and
       turn every aria-label lookup into a call on the tab object. */
    TABS.forEach(function (tb) {
      var a = document.createElement('a');
      a.className = 'd-nav__item';
      a.setAttribute('data-tab', tb.id);
      a.setAttribute('href', '#' + tb.id);
      a.setAttribute('aria-label', t(tb.labelKey));

      var box = document.createElement('div');
      box.className = 'd-nav__box';
      var i = document.createElement('i');
      i.className = 'ph-bold ' + tb.icon;
      box.appendChild(i);
      a.appendChild(box);

      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.app && typeof window.app.go === 'function') window.app.go(tb.id);
      });

      nav.appendChild(a);
      itemsById[tb.id] = { el: a, icon: i };
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
    TABS.forEach(function (tb) {
      var item = itemsById[tb.id];
      if (!item) return;
      var isActive = (tb.id === id);
      item.el.classList.toggle('is-active', isActive);
      item.icon.className = (isActive ? 'ph-fill ' : 'ph-bold ') + tb.icon;
    });
  }

  window.V10Nav = { build: buildNav, setActive: setActive, TABS: TABS };
})();
