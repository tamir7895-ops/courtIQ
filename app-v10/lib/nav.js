/* CourtIQ v10 — Bottom Navigation with Sliding Accent Pill
   Idempotent: built once, setActive() just slides the pill + toggles classes.
   ============================================================ */
(function () {
  'use strict';

  // Phosphor uses `<weight-class> <icon-name>` (e.g. `ph-fill ph-house`),
  // NOT `ph-house-fill`. Same icon name for both weights — just swap the weight.
  var TABS = [
    { id: 'home',  icon: 'ph-house',     label: 'HOME' },
    { id: 'track', icon: 'ph-crosshair', label: 'TRACK' },
    { id: 'train', icon: 'ph-barbell',   label: 'TRAIN' },
    { id: 'coach', icon: 'ph-brain',     label: 'COACH' },
    { id: 'me',    icon: 'ph-user',      label: 'ME' }
  ];

  var navEl = null;
  var pillEl = null;
  var itemsById = {};

  function buildNav(activeId) {
    if (navEl) {
      setActive(activeId);
      return navEl;
    }
    var nav = document.createElement('nav');
    nav.className = 'v10-nav';

    // The sliding accent pill — colored per-screen via [data-screen] CSS.
    var pill = document.createElement('div');
    pill.className = 'v10-nav__pill';
    nav.appendChild(pill);

    TABS.forEach(function (t) {
      var a = document.createElement('a');
      a.className = 'v10-nav__item';
      a.setAttribute('data-tab', t.id);
      a.setAttribute('href', '#' + t.id);

      var i = document.createElement('i');
      i.className = 'ph-bold ' + t.icon;
      a.appendChild(i);

      var span = document.createElement('span');
      span.textContent = t.label;
      a.appendChild(span);

      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.app && typeof window.app.go === 'function') {
          window.app.go(t.id);
        }
      });

      nav.appendChild(a);
      itemsById[t.id] = { el: a, icon: i };
    });

    navEl = nav;
    pillEl = pill;
    return nav;
  }

  function setActive(activeId) {
    // First call after page load — build + mount.
    if (!navEl) {
      var existing = document.querySelector('.v10-nav');
      if (existing) existing.remove();
      document.body.appendChild(buildNav(activeId));
    }
    var index = -1;
    TABS.forEach(function (t, i) {
      var isActive = (t.id === activeId);
      var item = itemsById[t.id];
      if (!item) return;
      item.el.classList.toggle('is-active', isActive);
      // Swap weight only — same icon name; ph-bold (outline) ↔ ph-fill (solid).
      item.icon.className = (isActive ? 'ph-fill ' : 'ph-bold ') + t.icon;
      if (isActive) index = i;
    });
    if (pillEl && index >= 0) {
      var n = TABS.length;
      pillEl.style.transform = 'translateX(' + (index * 100) + '%)';
      pillEl.style.width = (100 / n) + '%';
    }
  }

  window.V10Nav = { build: buildNav, setActive: setActive, TABS: TABS };
})();
