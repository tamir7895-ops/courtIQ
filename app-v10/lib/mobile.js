/* CourtIQ v12 — MOBILE RUNTIME
   ------------------------------------------------------------------
   Two jobs, both about making the web view behave like an app:

   1. ONE CANVAS ON EVERY PHONE. The layout is designed in px on a
      ~390px canvas. On a 360px Galaxy everything crowds; on a 430px
      Pro Max everything rattles loose. Instead of chasing that with
      per-component clamps, we pin the LAYOUT VIEWPORT itself to 390
      and let the OS scale it to the glass — the same trick a game
      uses: fixed canvas, hardware scaling. One design, every device,
      pixel-identical proportions.

      Desktop browsers ignore the viewport meta entirely, so the dev
      Studio and browser preview are unaffected. Tablet-class widths
      (>600px) keep device-width — stretching a phone canvas over an
      iPad would look like a toy.

   2. TAB SWIPES. Horizontal drag on the five main tabs pages between
      them, following the finger, committing on distance OR velocity —
      exactly the physics a native pager has.

      What must NOT trigger it (each guard exists because skipping it
      breaks a real interaction):
        · vertical scrolling — direction is decided ONCE, by whichever
          axis wins first, and a vertical gesture never converts
        · horizontally scrollable rows (chips, card rails) — walk the
          ancestor chain; if anything scrolls sideways, it wins
        · sliders, inputs, canvas, video — they own their gestures
        · sub-screens (drill-library, plan, shop…) — swiping between
          SIBLING tabs only makes sense between siblings
   ============================================================ */
(function () {
  'use strict';

  /* ── 1 · viewport lock ─────────────────────────────────────────── */
  var CANVAS = 390;   /* iPhone 12-16 logical width — the design canvas */

  function lockViewport() {
    try {
      var w = window.screen && window.screen.width
        ? Math.min(window.screen.width, window.screen.height || 9999)
        : window.innerWidth;
      if (!w || w > 600) return;   /* tablets/desktop keep device-width */
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) return;
      meta.setAttribute('content',
        'width=' + CANVAS + ', viewport-fit=cover, user-scalable=no' +
        ', interactive-widget=resizes-content');
    } catch (e) { /* worst case: device-width, exactly what we had */ }
  }
  lockViewport();

  /* ── 2 · tab swipes ────────────────────────────────────────────── */
  var ORDER = ['home', 'track', 'social', 'coach', 'me'];

  var app = null;
  var st = null;   /* live gesture, null when idle */

  function currentIdx() {
    var cur = (window.app && window.app.current && window.app.current()) || '';
    return ORDER.indexOf(cur);
  }

  /* An element (or any ancestor inside #app) that scrolls sideways owns
     horizontal gestures. Checking computed overflow alone lies — a row
     with overflow-x:auto but nothing to scroll shouldn't eat the swipe,
     hence the scrollWidth comparison. */
  function ownsHorizontal(el) {
    while (el && el !== app && el.nodeType === 1) {
      var tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
          tag === 'CANVAS' || tag === 'VIDEO') return true;
      if (el.hasAttribute && el.hasAttribute('data-noswipe')) return true;
      if (el.scrollWidth > el.clientWidth + 4) {
        var ov = getComputedStyle(el).overflowX;
        if (ov === 'auto' || ov === 'scroll') return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function onStart(ev) {
    if (st) return;
    var idx = currentIdx();
    if (idx < 0) return;                      /* sub-screen — no tab swipe */
    var t = ev.touches ? ev.touches[0] : ev;
    if (ownsHorizontal(ev.target)) return;
    st = {
      x0: t.clientX, y0: t.clientY, t0: Date.now(),
      idx: idx, axis: null, dx: 0
    };
  }

  function onMove(ev) {
    if (!st) return;
    var t = ev.touches ? ev.touches[0] : ev;
    var dx = t.clientX - st.x0, dy = t.clientY - st.y0;

    /* Direction is decided ONCE. A gesture that started vertical stays
       vertical — otherwise diagonal scrolling judders the page sideways. */
    if (!st.axis) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      st.axis = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'x' : 'y';
      if (st.axis === 'x') app.classList.add('is-dragging');
    }
    if (st.axis !== 'x') return;

    /* Rubber-band at the ends: first tab dragging right (or last tab
       dragging left) moves at third-speed — the resistance IS the "no
       more pages" message, same as every native pager. */
    var atEdge = (st.idx === 0 && dx > 0) || (st.idx === ORDER.length - 1 && dx < 0);
    st.dx = atEdge ? dx / 3 : dx;
    app.style.transform = 'translateX(' + st.dx + 'px)';
    if (ev.cancelable) ev.preventDefault();
  }

  function onEnd() {
    if (!st) return;
    var s = st; st = null;
    app.classList.remove('is-dragging');
    if (s.axis !== 'x') { app.style.transform = ''; return; }

    var dt = Math.max(1, Date.now() - s.t0);
    var velocity = Math.abs(s.dx) / dt;                 /* px per ms */
    var commit = Math.abs(s.dx) > window.innerWidth * 0.28 || velocity > 0.55;
    var dir = s.dx < 0 ? 1 : -1;                         /* left drag → next */
    var next = s.idx + dir;

    if (commit && next >= 0 && next < ORDER.length) {
      app.style.transform = '';
      window.app.go(ORDER[next], dir > 0 ? 'l' : 'r');
      try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    } else {
      /* Snap back — the gesture didn't earn the page turn. */
      app.classList.add('is-snapback');
      app.style.transform = '';
      setTimeout(function () { app.classList.remove('is-snapback'); }, 200);
    }
  }

  /* ── 3 · keyboard vs the locked shell ──────────────────────────
     With html/body fixed and the WKWebView's own scrolling disabled,
     iOS no longer auto-scrolls a focused input above the keyboard —
     the shell can't move, so the keyboard just covers it. The scroll
     has to happen inside #app, and we're the only ones who know that.
     300ms delay: the keyboard animates in first; scrolling before it
     settles measures the wrong viewport. */
  function onFocusIn(ev) {
    var t = ev.target;
    if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    setTimeout(function () {
      try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {
        try { t.scrollIntoView(); } catch (e2) {}
      }
    }, 300);
  }

  function boot() {
    app = document.getElementById('app');
    if (!app) return;
    document.addEventListener('focusin', onFocusIn);
    /* touch events, not pointer: iOS Safari's pointercancel during
       native scroll makes pointer-based pagers drop gestures. */
    app.addEventListener('touchstart', onStart, { passive: true });
    app.addEventListener('touchmove', onMove, { passive: false });
    app.addEventListener('touchend', onEnd, { passive: true });
    app.addEventListener('touchcancel', onEnd, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

  window.V12Mobile = { ORDER: ORDER, lockViewport: lockViewport };
})();
