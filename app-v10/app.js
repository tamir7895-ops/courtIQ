/* CourtIQ v10 — App Bootstrap & Router
   Single-page app. Hash-based routing. Each screen has render(host, ctx).
   ============================================================ */
(function () {
  'use strict';

  var SCREENS = {}; // populated by screens/*.js calling app.register()
  var current = null;

  function host() {
    var el = document.getElementById('app');
    if (!el) {
      el = document.createElement('main');
      el.id = 'app';
      document.body.appendChild(el);
    }
    return el;
  }

  function register(id, fn) {
    SCREENS[id] = fn;
  }

  function go(id) {
    if (!id) id = 'home';
    if (!SCREENS[id]) id = 'home';
    document.body.setAttribute('data-screen', id);
    if (location.hash !== '#' + id) {
      try { history.replaceState(null, '', '#' + id); } catch (e) {}
    }
    current = id;
    var h = host();
    while (h.firstChild) h.removeChild(h.firstChild);
    // Tab fade-in (200ms) — restart the animation each navigation
    h.classList.remove('v10-tab-enter');
    void h.offsetWidth;
    h.classList.add('v10-tab-enter');
    try {
      SCREENS[id]({
        host: h,
        ctx: {
          go: go,
          data: window.V10Data,
          ui: window.V10UI
        }
      });
    } catch (e) {
      var err = document.createElement('div');
      err.style.padding = '20px';
      err.style.color = '#FF4F1F';
      err.textContent = 'Screen failed: ' + (e && e.message);
      h.appendChild(err);
      console.error('[v10] render error:', e);
    }
    if (window.V10Nav) window.V10Nav.setActive(id);
    // Headline numbers roll up after the sections compose
    try {
      if (window.V10UI && window.V10UI.animateCounts) window.V10UI.animateCounts(h);
    } catch (e2) { /* purely decorative */ }
  }

  function bootstrap() {
    var initial = (location.hash || '').replace(/^#/, '') || 'home';
    go(initial);
    window.addEventListener('hashchange', function () {
      var next = (location.hash || '').replace(/^#/, '') || 'home';
      if (next !== current) go(next);
    });
  }

  window.app = {
    register: register,
    go: go,
    bootstrap: bootstrap,
    current: function () { return current; }
  };
})();
