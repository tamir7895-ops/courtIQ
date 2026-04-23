/* CourtIQ UI v2 — Coach tab module (purple accent).
 *
 * The existing #db-panel-coach is a form the user fills in to
 * recalibrate next week's AI program. We preserve that form
 * unchanged and (a) prepend a v2-styled chat-style intro above it,
 * and (b) let coach.css handle the re-skin.
 *
 * No changes to js/ai-coach.js or the form behaviour.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.COACH_TAB) return;

  function ICON_COACH() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  }

  function buildIntro() {
    var el = document.createElement('div');
    el.id = 'ciq-coach-intro';
    el.innerHTML = ''
      + '<div class="ciq-coach-eyebrow">AI Coach</div>'
      + '<h1 class="ciq-coach-title">Coach.</h1>'
      + '<div class="ciq-coach-chat">'
      +   '<div class="ciq-coach-msg">'
      +     '<div class="ciq-coach-avatar">' + ICON_COACH() + '</div>'
      +     '<div class="ciq-coach-bubble">I noticed your release is <strong>~0.12s slower</strong> on contested shots. Share your last week\'s drills below and I\'ll rebuild next week\'s program.</div>'
      +   '</div>'
      +   '<div class="ciq-coach-msg self">'
      +     '<div class="ciq-coach-bubble">Let\'s go.</div>'
      +   '</div>'
      +   '<div class="ciq-coach-msg">'
      +     '<div class="ciq-coach-avatar">' + ICON_COACH() + '</div>'
      +     '<div class="ciq-coach-bubble">Two focus drills for the week after you submit:'
      +       '<div class="ciq-coach-recs">'
      +         '<div class="ciq-coach-rec"><div class="play"></div><div class="t">Catch-and-Shoot · 4×10</div><div class="chev">›</div></div>'
      +         '<div class="ciq-coach-rec"><div class="play"></div><div class="t">Elbow Pull-Up · 3×8</div><div class="chev">›</div></div>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '<div class="ciq-coach-divider">Update Performance →</div>';
    return el;
  }

  function init() {
    var panel = document.getElementById('db-panel-coach');
    if (!panel) {
      console.warn('[ciq-coach] #db-panel-coach not found; skipping');
      return;
    }

    // Prepend intro once
    if (!document.getElementById('ciq-coach-intro')) {
      var intro = buildIntro();
      panel.insertBefore(intro, panel.firstChild);
    }

    document.body.classList.add('ciq-v2-coach');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
