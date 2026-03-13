/* ============================================================
   SHOT ANALYSIS — /js/shot-analysis.js
   Three features:
   1. Personalized drill recommendations from shot history
   2. YouTube "Watch Tutorial" button on every drill card
   3. Shot Tracker AI feedback panel (weak areas + drill recs)
   ============================================================ */
(function () {
  'use strict';

  var LS_SHOTS = 'courtiq-shot-sessions';

  /* ── Drill recommendations per weak area ─────────────────── */
  var DRILL_RECS = {
    '3pt': [
      { id: 'shoot-001', name: 'Catch & Shoot Corner 3s',    focus: 'Shooting', diff: 'Beginner',     min: 12 },
      { id: 'shoot-003', name: 'Step-Back Three',             focus: 'Shooting', diff: 'Advanced',     min: 16 },
      { id: 'shoot-004', name: 'Five-Spot Shooting Circuit',  focus: 'Shooting', diff: 'Beginner',     min: 20 }
    ],
    'ft': [
      { id: 'shoot-006', name: 'Free Throw Pressure Routine', focus: 'Shooting', diff: 'Intermediate', min: 12 },
      { id: 'shoot-004', name: 'Five-Spot Shooting Circuit',  focus: 'Shooting', diff: 'Beginner',     min: 20 },
      { id: 'shoot-001', name: 'Catch & Shoot Corner 3s',    focus: 'Shooting', diff: 'Beginner',     min: 12 }
    ],
    'fg': [
      { id: 'shoot-002', name: 'Mid-Range Pull-Up',           focus: 'Shooting', diff: 'Intermediate', min: 15 },
      { id: 'shoot-007', name: 'Off-Screen Curl Shot',        focus: 'Shooting', diff: 'Advanced',     min: 14 },
      { id: 'shoot-004', name: 'Five-Spot Shooting Circuit',  focus: 'Shooting', diff: 'Beginner',     min: 20 }
    ]
  };

  /* Benchmarks: below these = weak */
  var BENCHMARKS = { '3pt': 33, 'ft': 70, 'fg': 45 };

  /* What to pass to window.coachResult.weak_areas for drill filter */
  var COACH_AREA_MAP = {
    '3pt': ['3-point', 'shooting'],
    'ft':  ['free throw', 'shooting'],
    'fg':  ['shooting', 'mid-range']
  };

  var AREA_LABELS = { '3pt': '3-Point', 'ft': 'Free Throw', 'fg': 'Field Goal' };
  var AREA_ICONS  = { '3pt': '🎯', 'ft': '🏀', 'fg': '📊' };

  /* ── Load sessions ──────────────────────────────────────── */
  function loadSessions() {
    try {
      var raw = localStorage.getItem(LS_SHOTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  /* ── Analyse last 7 days ─────────────────────────────────── */
  function analyzeWeek() {
    var sessions = loadSessions();
    if (!sessions.length) return null;

    var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var recent = sessions.filter(function (s) {
      return new Date(s.date).getTime() >= cutoff;
    });

    // Fall back to all sessions if fewer than 2 in last week
    if (recent.length < 2) recent = sessions.slice(0, Math.min(5, sessions.length));
    if (!recent.length) return null;

    var totals = { fgMade: 0, fgMissed: 0, threeMade: 0, threeMissed: 0, ftMade: 0, ftMissed: 0 };
    recent.forEach(function (s) {
      totals.fgMade    += s.fg_made    || 0;
      totals.fgMissed  += s.fg_missed  || 0;
      totals.threeMade += s.three_made  || 0;
      totals.threeMissed += s.three_missed || 0;
      totals.ftMade    += s.ft_made    || 0;
      totals.ftMissed  += s.ft_missed  || 0;
    });

    function pct(made, missed) {
      var t = made + missed;
      return t === 0 ? null : Math.round((made / t) * 100);
    }

    return {
      sessions: recent.length,
      fg:  pct(totals.fgMade,    totals.fgMissed),
      '3pt': pct(totals.threeMade, totals.threeMissed),
      ft:  pct(totals.ftMade,    totals.ftMissed)
    };
  }

  /* ── Find the weakest area ───────────────────────────────── */
  function getWeakArea(stats) {
    if (!stats) return null;
    var worst = null;
    var worstGap = -999;

    var keys = ['3pt', 'ft', 'fg'];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var val = stats[key];
      if (val === null) continue;
      var gap = BENCHMARKS[key] - val; // positive = below benchmark
      if (gap > worstGap) {
        worstGap = gap;
        worst = { area: key, pct: val, gap: gap };
      }
    }
    return worst;
  }

  /* ── Feature 1: Coach banner integration ─────────────────── */
  function initCoachBanner() {
    var stats = analyzeWeek();
    var weak = getWeakArea(stats);
    if (!weak || weak.gap <= 0) return; // nothing weak

    window.coachResult = {
      weak_areas: COACH_AREA_MAP[weak.area] || ['shooting'],
      weak_summary: AREA_LABELS[weak.area] + ' at ' + weak.pct + '%'
    };
    window._coachWeakAreas = COACH_AREA_MAP[weak.area] || ['shooting'];

    // drill-engine.js is a synchronous script loaded before this file — call directly
    if (typeof _checkCoachSuggestions === 'function') {
      _checkCoachSuggestions();
    }
  }

  /* ── Feature 3: Shot Tracker feedback panel ──────────────── */
  function renderFeedback() {
    var panel = document.getElementById('st-ai-feedback');
    if (!panel) return;

    var stats = analyzeWeek();
    if (!stats) {
      panel.style.display = 'none';
      return;
    }

    var weak = getWeakArea(stats);

    // Build stat pills
    var pills = [];
    if (stats.fg  !== null) pills.push(buildPill('FG%',  stats.fg,  'fg'));
    if (stats['3pt'] !== null) pills.push(buildPill('3PT%', stats['3pt'], '3pt'));
    if (stats.ft  !== null) pills.push(buildPill('FT%',  stats.ft,  'ft'));

    var pillsHTML = '<div class="sa-pills">' + pills.join('') + '</div>';

    var alertHTML = '';
    var drillsHTML = '';

    if (weak && weak.gap > 0) {
      var label = AREA_LABELS[weak.area];
      var icon  = AREA_ICONS[weak.area];
      alertHTML =
        '<div class="sa-alert">' +
          '<span class="sa-alert-dot"></span>' +
          '<span>' + icon + ' Your <strong>' + label + '</strong> is at ' +
            '<strong class="sa-weak-pct">' + weak.pct + '%</strong> — ' +
            'here are 3 drills to improve it.</span>' +
        '</div>';

      var recs = DRILL_RECS[weak.area] || [];
      drillsHTML =
        '<div class="sa-drills-title">Recommended Drills</div>' +
        '<div class="sa-drills-list">' +
        recs.map(function (d) {
          return '<div class="sa-drill-card">' +
            '<div class="sa-drill-info">' +
              '<div class="sa-drill-name">' + d.name + '</div>' +
              '<div class="sa-drill-meta">' + d.focus + ' · ' + d.diff + ' · ' + d.min + ' min</div>' +
            '</div>' +
            '<a href="https://www.youtube.com/results?search_query=basketball+' +
              encodeURIComponent(d.name) + '+drill+tutorial" ' +
              'target="_blank" rel="noopener" class="sa-drill-yt-btn">▶ Watch</a>' +
          '</div>';
        }).join('') +
        '</div>' +
        '<button class="sa-go-drills-btn" onclick="if(typeof dbSwitchTabById===\'function\')dbSwitchTabById(\'drills\')">' +
          'Go to Drills →' +
        '</button>';
    } else {
      alertHTML =
        '<div class="sa-alert sa-alert-good">' +
          '<span class="sa-alert-dot sa-dot-green"></span>' +
          '<span>💪 Great work! All shot types are above benchmark.</span>' +
        '</div>';
    }

    panel.innerHTML =
      '<div class="sa-header">' +
        '<span class="sa-header-icon">🤖</span>' +
        '<span class="sa-header-title">AI Shot Analysis</span>' +
        '<span class="sa-header-sub">Last ' + stats.sessions + ' session' + (stats.sessions !== 1 ? 's' : '') + '</span>' +
      '</div>' +
      pillsHTML +
      alertHTML +
      drillsHTML;

    panel.style.display = 'block';
  }

  function buildPill(label, val, area) {
    var bench = BENCHMARKS[area];
    var good = val >= bench;
    return '<div class="sa-pill' + (good ? '' : ' sa-pill-weak') + '">' +
      '<span class="sa-pill-label">' + label + '</span>' +
      '<span class="sa-pill-val">' + val + '%</span>' +
    '</div>';
  }

  /* ── Feature 2: YouTube button on drill card expand ─────── */
  function patchDrillCards() {
    var original = window.drillToggleExpand;
    if (typeof original !== 'function') return;

    window.drillToggleExpand = function (drillId) {
      original(drillId);
      // After expand, inject video button if panel is now open
      setTimeout(function () {
        injectVideoButton(drillId);
      }, 50);
    };
  }

  function injectVideoButton(drillId) {
    var panel = document.getElementById('drill-detail-' + drillId);
    if (!panel || !panel.classList.contains('open')) return;
    if (panel.querySelector('.drill-video-btn-wrap')) return; // already injected

    // Grab drill name from the card for a good search query
    var card = document.getElementById('drill-card-' + drillId);
    var nameEl = card && card.querySelector('.drill-card-name');
    var drillName = nameEl ? nameEl.textContent.trim() : drillId;

    var wrap = document.createElement('div');
    wrap.className = 'drill-video-btn-wrap';
    wrap.innerHTML =
      '<a href="https://www.youtube.com/results?search_query=basketball+' +
        encodeURIComponent(drillName) + '+drill+tutorial" ' +
        'target="_blank" rel="noopener" class="drill-video-btn">' +
        '▶ Watch Tutorial on YouTube' +
      '</a>';

    panel.appendChild(wrap);
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    initCoachBanner();
    patchDrillCards();

    // Render feedback when shot-tracker signals it has rendered history.
    // Use flag for the common case where shot-tracker's DOMContentLoaded
    // fires before ours (scripts are registered in order).
    var sessions = loadSessions();
    if (sessions.length > 0) {
      if (window.ShotTracker && window.ShotTracker.ready) {
        renderFeedback();
      } else {
        document.addEventListener('courtiq:shotTrackerReady', function () {
          renderFeedback();
        }, { once: true });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ShotAnalysis = {
    renderFeedback: renderFeedback,
    analyzeWeek: analyzeWeek
  };
})();
