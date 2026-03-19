/* ============================================================
   PROGRESS CHARTS — /js/progress-charts.js
   Custom canvas line chart for shooting progress over time.
   Reads from courtiq-shot-sessions in localStorage.
   Lazy-loads via IntersectionObserver.
   ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'courtiq-shot-sessions';

  var COLORS = {
    overall: '#f5a623',
    fg:      '#3a86ff',
    three:   '#56d364',
    ft:      '#bc8cff'
  };

  var LABELS = {
    overall: 'Overall',
    fg:      'FG%',
    three:   '3PT%',
    ft:      'FT%'
  };

  var PAD = { top: 14, right: 24, bottom: 34, left: 44 };

  var drawn = false;

  /* ── Data ─────────────────────────────────────────────────── */
  function loadSessions() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // Async version: merge localStorage + Supabase sessions for complete data
  async function loadAllSessions() {
    var local = loadSessions();
    if (typeof DataService === 'undefined' || !window.currentUser || window.courtiqGuest) {
      return local;
    }
    try {
      var remote = await DataService.getShotSessions(50);
      if (!remote || remote.length === 0) return local;
      // Merge: use date as dedup key, prefer remote data
      var byDate = {};
      local.forEach(function (s) { byDate[s.date] = s; });
      remote.forEach(function (s) {
        byDate[s.session_date || s.date] = {
          date: s.session_date || s.date,
          fg_made: s.fg_made || 0, fg_missed: s.fg_missed || 0,
          three_made: s.three_made || 0, three_missed: s.three_missed || 0,
          ft_made: s.ft_made || 0, ft_missed: s.ft_missed || 0
        };
      });
      return Object.values(byDate).sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });
    } catch (e) {
      return local;
    }
  }

  function calcPct(made, missed) {
    var total = made + missed;
    return total === 0 ? 0 : Math.round((made / total) * 100);
  }

  function buildSeries(sessions) {
    // Sessions are stored newest-first; reverse for chronological
    var chronological = sessions.slice().reverse();

    var series = { overall: [], fg: [], three: [], ft: [] };

    for (var i = 0; i < chronological.length; i++) {
      var s = chronological[i];
      var totalMade   = s.fg_made + s.three_made + s.ft_made;
      var totalMissed = s.fg_missed + s.three_missed + s.ft_missed;

      series.overall.push(calcPct(totalMade, totalMissed));
      series.fg.push(calcPct(s.fg_made, s.fg_missed));
      series.three.push(calcPct(s.three_made, s.three_missed));
      series.ft.push(calcPct(s.ft_made, s.ft_missed));
    }

    return { series: series, count: chronological.length, sessions: chronological };
  }

  /* ── Legend ───────────────────────────────────────────────── */
  function renderLegend() {
    var el = document.getElementById('pc-legend');
    if (!el) return;

    var keys = ['overall', 'fg', 'three', 'ft'];
    el.innerHTML = keys.map(function (k) {
      return '<span class="pc-legend-item">' +
        '<span class="pc-legend-dot" style="background:' + COLORS[k] + '"></span>' +
        LABELS[k] +
      '</span>';
    }).join('');
  }

  /* ── Draw ─────────────────────────────────────────────────── */
  function draw(sessionsOverride) {
    var canvas = document.getElementById('pc-canvas');
    var emptyEl = document.getElementById('pc-empty');
    if (!canvas) return;

    var ctx = canvas.getContext('2d');
    var sessions = sessionsOverride || loadSessions();
    var data = buildSeries(sessions);

    // Need 2+ sessions
    if (data.count < 2) {
      canvas.style.display = 'none';
      if (emptyEl) emptyEl.classList.remove('hidden');
      document.getElementById('pc-legend').style.display = 'none';
      return;
    }

    canvas.style.display = 'block';
    if (emptyEl) emptyEl.classList.add('hidden');
    document.getElementById('pc-legend').style.display = '';

    renderLegend();

    // Retina support
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.parentElement.getBoundingClientRect();
    var w = rect.width;
    var h = 260;

    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    // Chart area
    var cw = w - PAD.left - PAD.right;
    var ch = h - PAD.top - PAD.bottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // ── Grid lines ──
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.font = '11px Barlow, sans-serif';
    ctx.fillStyle = 'rgba(240,237,230,0.22)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    var gridSteps = [0, 25, 50, 75, 100];
    for (var g = 0; g < gridSteps.length; g++) {
      var gy = PAD.top + ch - (gridSteps[g] / 100) * ch;
      ctx.beginPath();
      ctx.moveTo(PAD.left, gy);
      ctx.lineTo(PAD.left + cw, gy);
      ctx.stroke();
      ctx.fillText(gridSteps[g] + '%', PAD.left - 8, gy);
    }

    ctx.setLineDash([]);

    // ── X-axis labels ──
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var n = data.count;
    var xStep = cw / (n - 1);

    for (var xi = 0; xi < n; xi++) {
      var xx = PAD.left + xi * xStep;
      // Show session number or short date
      var label;
      if (n <= 12) {
        var d = new Date(data.sessions[xi].date);
        label = (d.getMonth() + 1) + '/' + d.getDate();
      } else {
        label = '' + (xi + 1);
      }
      ctx.fillText(label, xx, PAD.top + ch + 10);
    }

    // ── Lines ──
    var keys = ['ft', 'three', 'fg', 'overall']; // draw overall last (on top)
    for (var ki = 0; ki < keys.length; ki++) {
      var key = keys[ki];
      var pts = data.series[key];
      var color = COLORS[key];

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (var pi = 0; pi < pts.length; pi++) {
        var px = PAD.left + pi * xStep;
        var py = PAD.top + ch - (pts[pi] / 100) * ch;
        if (pi === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();

      // Dots
      ctx.fillStyle = color;
      for (var di = 0; di < pts.length; di++) {
        var dx = PAD.left + di * xStep;
        var dy = PAD.top + ch - (pts[di] / 100) * ch;
        ctx.beginPath();
        ctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawn = true;
  }

  /* ── Refresh (called after new session) ────────────────── */
  function refresh() {
    // Try to merge Supabase + localStorage data, fall back to local only
    loadAllSessions().then(function (all) { draw(all); }).catch(function () { draw(); });
  }

  /* ── Lazy load via IntersectionObserver ─────────────────── */
  function initObserver() {
    var wrap = document.getElementById('pc-chart-wrap');
    if (!wrap) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: draw immediately
      draw();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          draw();
          observer.disconnect();
          break;
        }
      }
    }, { threshold: 0.1 });

    observer.observe(wrap);
  }

  /* ── Init ──────────────────────────────────────────────── */
  function init() {
    initObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ProgressCharts = {
    draw: draw,
    refresh: refresh
  };
})();
