/* CourtIQ UI v2 — Train tab module
 *
 * When COURTIQ_UI_V2.TRAIN_TAB is true:
 *   1. Injects #ciq-train-screen into the main dashboard area.
 *   2. Syncs the weekly challenge (title, desc, week, drill list, time)
 *      from the legacy #db-panel-training hooks. Whatever drill-engine.js
 *      and training-panel.js populate into those IDs, the v2 view reflects.
 *   3. Syncs the 4 weekly-goal stat tiles.
 *   4. Wires "Start Challenge" to the existing trChallengeStart() global.
 *   5. Sub-nav routes Moves → db-panel-moves.
 *
 * No changes to drill-engine.js, daily-workout.js, or move-library.js.
 */
(function () {
  'use strict';

  if (!window.COURTIQ_UI_V2 || !window.COURTIQ_UI_V2.TRAIN_TAB) return;

  var SUB_TABS = [
    { id: 'program', legacy: 'training', label: 'Program' },
    { id: 'moves',   legacy: 'moves',    label: 'Moves' }
  ];

  function ICON_PLAY() {
    return '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  }

  function buildScreen() {
    var host = document.createElement('section');
    host.id = 'ciq-train-screen';
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', 'Train');

    var subButtons = SUB_TABS.map(function (t, i) {
      var cls = (i === 0) ? 'active' : '';
      return '<button type="button" class="' + cls + '" data-ciq-subtab="' + t.id + '" data-ciq-legacy="' + t.legacy + '">' + t.label + '</button>';
    }).join('');

    host.innerHTML = ''
      + '<div class="ciq-train-eyebrow">Your Program</div>'
      + '<h1 class="ciq-train-title">Training</h1>'

      + '<nav class="ciq-train-subnav" aria-label="Train sections">' + subButtons + '</nav>'

      + '<section class="ciq-train-challenge">'
      +   '<div class="ciq-train-week-pill" data-ciq-slot="week">Week Challenge</div>'
      +   '<div class="ciq-train-challenge-name" data-ciq-slot="title">Loading…</div>'
      +   '<div class="ciq-train-challenge-desc" data-ciq-slot="desc"></div>'
      +   '<div class="ciq-train-drills-head">This Week\'s Drills</div>'
      +   '<ol class="ciq-train-drills" data-ciq-slot="drills"></ol>'
      +   '<div class="ciq-train-cta-row">'
      +     '<button class="ciq-train-start-btn" data-ciq-action="start-challenge">Start Challenge</button>'
      +     '<div class="ciq-train-total">'
      +       '<div><span class="ciq-train-total-val" data-ciq-slot="time">—</span></div>'
      +       '<div class="ciq-train-total-lbl">Total</div>'
      +     '</div>'
      +   '</div>'
      + '</section>'

      + '<div class="ciq-train-goals-head">Weekly Goals</div>'
      + '<div class="ciq-train-goals">'
      +   '<div class="ciq-train-goal"><div class="lbl">XP This Week</div><div class="val" data-ciq-slot="xp">0</div></div>'
      +   '<div class="ciq-train-goal"><div class="lbl">Sessions</div><div class="val" data-ciq-slot="sessions">0</div></div>'
      +   '<div class="ciq-train-goal"><div class="lbl">Focus Area</div><div class="val" data-ciq-slot="focus">General</div></div>'
      +   '<div class="ciq-train-goal"><div class="lbl">Streak</div><div class="val" data-ciq-slot="streak">0</div></div>'
      + '</div>';

    return host;
  }

  /* ─── Data sync from legacy #db-panel-training ─────────── */
  function textOf(sel) {
    var el = document.querySelector(sel);
    return el ? (el.textContent || '').trim() : '';
  }
  function setSlot(host, slot, value) {
    var el = host.querySelector('[data-ciq-slot="' + slot + '"]');
    if (!el) return;
    el.textContent = value || '';
  }

  function syncChallenge(host) {
    var wk = textOf('#tr-challenge-week-badge');
    if (wk) setSlot(host, 'week', wk);

    var title = textOf('#tr-challenge-title');
    if (title && title !== 'Loading…') setSlot(host, 'title', title);

    var desc = textOf('#tr-challenge-desc');
    if (desc) setSlot(host, 'desc', desc);

    var time = textOf('#tr-challenge-time');
    if (time) setSlot(host, 'time', time);

    // Drills list — clone structure from legacy OL
    var legacyList = document.getElementById('tr-challenge-steps');
    var target = host.querySelector('[data-ciq-slot="drills"]');
    if (legacyList && target) {
      var items = legacyList.querySelectorAll('li');
      if (items.length > 0) {
        target.innerHTML = Array.prototype.map.call(items, function (li, idx) {
          // Prefer structured spans used by the legacy panel
          var nameEl = li.querySelector('.tr-step-name');
          var metaEl = li.querySelector('.tr-step-meta');
          var name, meta;
          if (nameEl) {
            name = (nameEl.textContent || '').trim();
            meta = metaEl ? (metaEl.textContent || '').trim() : '';
          } else {
            var txt = (li.textContent || '').trim().replace(/^\d+\.?\s*/, '');
            var m = txt.match(/^(.+?)\s+[·—\-|]\s+(.+)$/);
            name = m ? m[1] : txt;
            meta = m ? m[2] : '';
          }
          return ''
            + '<li class="ciq-train-drill">'
            +   '<div class="ciq-train-drill-num">' + (idx + 1) + '</div>'
            +   '<div class="ciq-train-drill-body">'
            +     '<div class="ciq-train-drill-name">' + escapeHTML(name) + '</div>'
            +     (meta ? '<div class="ciq-train-drill-meta">' + escapeHTML(meta) + '</div>' : '')
            +   '</div>'
            +   '<div class="ciq-train-drill-play">' + ICON_PLAY() + '</div>'
            + '</li>';
        }).join('');
      }
    }
  }

  function syncGoals(host) {
    var xp = textOf('#tr-xp-val');
    if (xp) setSlot(host, 'xp', xp);

    var sessions = textOf('#tr-sessions-val');
    if (sessions) setSlot(host, 'sessions', sessions);

    var focus = textOf('#tr-focus-val');
    if (focus) setSlot(host, 'focus', focus);

    var streak = textOf('#tr-streak-val');
    if (streak) setSlot(host, 'streak', streak);
  }

  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function wireActions(host) {
    host.addEventListener('click', function (e) {
      var t = e.target.closest('[data-ciq-action], [data-ciq-subtab]');
      if (!t) return;

      var sub = t.getAttribute('data-ciq-subtab');
      if (sub) {
        host.querySelectorAll('.ciq-train-subnav button').forEach(function (b) { b.classList.toggle('active', b === t); });
        var legacy = t.getAttribute('data-ciq-legacy');
        if (legacy && legacy !== 'training' && typeof window.dbSwitchTab === 'function') {
          window.dbSwitchTab(legacy);
        }
        return;
      }

      var act = t.getAttribute('data-ciq-action');
      if (act === 'start-challenge' && typeof window.trChallengeStart === 'function') {
        window.trChallengeStart();
      }
    });
  }

  function init() {
    var main = document.querySelector('.db-main-inner, #db-main-inner, .db-main, main');
    if (!main) {
      console.warn('[ciq-train] main container not found; skipping');
      return;
    }

    var host = buildScreen();
    main.appendChild(host);
    wireActions(host);

    function syncAll() { syncChallenge(host); syncGoals(host); }
    syncAll();
    setTimeout(syncAll, 400);
    setTimeout(syncAll, 1500);

    var legacyPanel = document.getElementById('db-panel-training');
    if (legacyPanel && 'MutationObserver' in window) {
      var mo = new MutationObserver(syncAll);
      mo.observe(legacyPanel, { subtree: true, childList: true, characterData: true });
    }

    document.body.classList.add('ciq-v2-train');

    window.CIQ_TRAIN = { host: host, syncNow: syncAll };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
