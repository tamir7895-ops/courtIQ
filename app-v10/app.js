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

  function go(id, slideDir) {
    if (!id) id = 'home';
    if (!SCREENS[id]) id = 'home';
    document.body.setAttribute('data-screen', id);
    if (location.hash !== '#' + id) {
      try { history.replaceState(null, '', '#' + id); } catch (e) {}
    }
    current = id;
    var h = host();
    while (h.firstChild) h.removeChild(h.firstChild);
    /* Swipes slide from the direction of travel ('l'/'r', set by
       lib/mobile.js); everything else keeps the 200ms fade. Restart the
       animation each navigation. */
    h.classList.remove('v10-tab-enter', 'v12-slide-l', 'v12-slide-r');
    void h.offsetWidth;
    h.classList.add(slideDir === 'l' ? 'v12-slide-l'
                  : slideDir === 'r' ? 'v12-slide-r'
                  : 'v10-tab-enter');
    /* A swipe lands on a NEW page — it starts at the top, like a pager,
       not wherever the last visit left the scroller. */
    if (slideDir) { try { h.scrollTop = 0; } catch (e) {} }
    var rendered = null;
    try {
      rendered = SCREENS[id]({
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
    /* Headline numbers roll up once the sections compose.
       Every screen appends inside a promise, so calling this synchronously
       scanned an EMPTY host and found zero numbers — the count-up was dead
       app-wide, most visibly on post-session, where the ticker IS the
       celebration. A screen can now return a promise to say "I'm done";
       otherwise we retry on the next frames to catch late-resolving data. */
    var roll = function () {
      try {
        if (window.V10UI && window.V10UI.animateCounts) window.V10UI.animateCounts(h);
      } catch (e2) { /* purely decorative */ }
    };
    if (rendered && typeof rendered.then === 'function') rendered.then(roll, roll);
    else { roll(); setTimeout(roll, 60); setTimeout(roll, 240); }
  }

  function bootstrap() {
    var initial = (location.hash || '').replace(/^#/, '') || 'home';
    // First run → onboarding (it sets courtiq_onboarded on finish and
    // stores name/position that the guest profile reads). Deep links to
    // other screens are respected.
    try {
      if (initial === 'home' && !localStorage.getItem('courtiq_onboarded') && SCREENS.onboarding) {
        initial = 'onboarding';
      }
    } catch (e) { /* storage blocked — skip */ }
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
