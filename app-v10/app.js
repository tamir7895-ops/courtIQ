/* CourtIQ v10 — App Bootstrap & Router
   Single-page app. Hash-based routing. Each screen has render(host, ctx).
   ============================================================ */
(function () {
  'use strict';

  var SCREENS = {}; // populated by screens/*.js calling app.register()
  var current = null;

  /* ── navigation model ─────────────────────────────────────────
     The five tabs are ROOTS: landing on one clears the trail, like
     every tab bar on the platform. Everything else is a sub-screen
     that goes ON the trail, so back() returns where you actually
     came from — a library opened from the coach goes back to the
     coach, not to some hardcoded parent.
     TRANSIENT screens (flows you must not "back" into: the live
     camera, auth, onboarding) never enter the trail. PARENT is the
     fallback when the trail is empty — a cold deep-link still gets
     a sensible back. */
  var ROOTS = { home: 1, track: 1, social: 1, coach: 1, me: 1 };
  var TRANSIENT = { landing: 1, onboarding: 1, auth: 1, 'camera-hud': 1, 'session-prep': 1 };
  var PARENT = {
    train: 'track', plan: 'track', 'drill-library': 'track',
    'workout-player': 'track', 'post-session': 'track',
    'camera-hud': 'track', 'session-prep': 'track',
    'avatar-customizer': 'me', shop: 'me', notifications: 'home',
    auth: 'landing', onboarding: 'home', landing: 'home'
  };
  var stack = [];
  var poppingBack = false;   // back() navigates without re-pushing

  function back() {
    var target = null;
    while (stack.length) {
      var cand = stack.pop();
      if (cand && SCREENS[cand] && !TRANSIENT[cand] && cand !== current) {
        target = cand; break;
      }
    }
    if (!target) target = PARENT[current] || 'home';
    poppingBack = true;
    go(target, 'r');
  }

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
    /* keep the trail BEFORE current changes: tabs reset it, leaving a
       normal screen records it, transient screens leave no trace */
    if (poppingBack) { poppingBack = false; }
    else if (ROOTS[id]) { stack.length = 0; }
    else if (current && current !== id && !TRANSIENT[current] && SCREENS[current]) {
      if (stack[stack.length - 1] !== current) stack.push(current);
      if (stack.length > 12) stack.shift();
    }
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
          back: back,
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
    // First run → the landing screen: language, brand, and the three
    // ways in (create profile / sign in / guest). It hands off to
    // onboarding, which sets courtiq_onboarded on finish. A returning
    // player who finished onboarding never sees either again. Deep
    // links to other screens are respected.
    try {
      if (initial === 'home' && !localStorage.getItem('courtiq_onboarded')) {
        var signedIn = false;
        try { signedIn = !!(window.V10Auth && window.V10Auth.user()); } catch (e2) {}
        if (!signedIn && SCREENS.landing) initial = 'landing';
        else if (SCREENS.onboarding) initial = 'onboarding';
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
    back: back,
    bootstrap: bootstrap,
    current: function () { return current; }
  };
})();
