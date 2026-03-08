/* ============================================================
   SHOT TRACKER — /js/shot-tracker.js
   Granular shooting session logger with FG / 3PT / FT tracking.
   Calculates percentages and persists sessions to localStorage.
   ============================================================ */
(function () {
  'use strict';

  var LS_KEY = 'courtiq-shot-sessions';

  /* ── Data ─────────────────────────────────────────────────── */
  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function save(sessions) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(sessions));
    } catch (e) { /* silent */ }
  }

  /* ── Calc ─────────────────────────────────────────────────── */
  function calcPct(made, missed) {
    var total = made + missed;
    if (total === 0) return 0;
    return Math.round((made / total) * 100);
  }

  function pctColor(pct) {
    if (pct >= 65) return 'st-color-green';
    if (pct >= 50) return 'st-color-amber';
    return 'st-color-red';
  }

  function pctHex(pct) {
    if (pct >= 65) return '#56d364';
    if (pct >= 50) return '#f5a623';
    return '#f85149';
  }

  /* ── Validation + Submit ─────────────────────────────────── */
  function getVal(id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    var v = parseInt(el.value, 10);
    return isNaN(v) ? -1 : v;
  }

  function addSession() {
    var errEl = document.getElementById('st-error');

    var fgMade     = getVal('st-fg-made');
    var fgMissed   = getVal('st-fg-missed');
    var threeMade  = getVal('st-3pt-made');
    var threeMissed = getVal('st-3pt-missed');
    var ftMade     = getVal('st-ft-made');
    var ftMissed   = getVal('st-ft-missed');

    // Validate non-negative
    var fields = [fgMade, fgMissed, threeMade, threeMissed, ftMade, ftMissed];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i] < 0) {
        showError(errEl, 'All fields must be zero or positive numbers.');
        return;
      }
    }

    // At least one shot type must have attempts
    var totalAttempts = (fgMade + fgMissed) + (threeMade + threeMissed) + (ftMade + ftMissed);
    if (totalAttempts === 0) {
      showError(errEl, 'Log at least one shot attempt.');
      return;
    }

    // Made cannot exceed attempted for each category
    if (fgMade > fgMade + fgMissed && fgMade + fgMissed > 0) {
      showError(errEl, 'FG made can\u2019t exceed total FG attempts.');
      return;
    }
    if (threeMade > threeMade + threeMissed && threeMade + threeMissed > 0) {
      showError(errEl, '3PT made can\u2019t exceed total 3PT attempts.');
      return;
    }
    if (ftMade > ftMade + ftMissed && ftMade + ftMissed > 0) {
      showError(errEl, 'FT made can\u2019t exceed total FT attempts.');
      return;
    }

    // Total shots cap
    if (totalAttempts > 500) {
      showError(errEl, 'Max 500 total shots per session. You entered ' + totalAttempts + '.');
      return;
    }

    // Warn on unrealistic but still allow
    if (totalAttempts > 300) {
      if (!window._shotWarningConfirmed) {
        showError(errEl, 'That\u2019s ' + totalAttempts + ' total shots \u2014 are you sure? Click again to confirm.');
        window._shotWarningConfirmed = true;
        setTimeout(function () { window._shotWarningConfirmed = false; }, 10000);
        return;
      }
      window._shotWarningConfirmed = false;
    }

    hideError(errEl);

    var session = {
      id: Date.now(),
      date: new Date().toISOString(),
      fg_made: fgMade,
      fg_missed: fgMissed,
      three_made: threeMade,
      three_missed: threeMissed,
      ft_made: ftMade,
      ft_missed: ftMissed
    };

    var sessions = load();
    sessions.unshift(session);

    // Keep last 50 sessions
    if (sessions.length > 50) {
      sessions = sessions.slice(0, 50);
    }

    save(sessions);
    renderResults(session);
    renderHistory(sessions);
    clearForm();

    // Async sync to Supabase (non-blocking, write-through)
    if (window.currentUser && typeof DataService !== 'undefined') {
      DataService.addShotSession(session).catch(function () {});
    }

    // Sound effect
    if (typeof SFX !== 'undefined') SFX.success();

    // XP integration
    if (typeof XPSystem !== 'undefined' && XPSystem.grantXP) {
      XPSystem.grantXP(20, 'Shot Session Logged');
    }

    if (typeof showToast === 'function') {
      showToast('Shooting session logged!');
    }

    // Refresh progress chart
    if (typeof ProgressCharts !== 'undefined' && ProgressCharts.refresh) {
      ProgressCharts.refresh();
    }

    // AI shot analysis feedback
    if (typeof ShotAnalysis !== 'undefined' && ShotAnalysis.renderFeedback) {
      ShotAnalysis.renderFeedback();
    }
  }

  /* ── Error helpers ─────────────────────────────────────────── */
  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
  }

  function hideError(el) {
    if (!el) return;
    el.classList.remove('show');
  }

  /* ── Render results ────────────────────────────────────────── */
  function renderResults(session) {
    var container = document.getElementById('st-results');
    if (!container) return;

    var fgPct    = calcPct(session.fg_made, session.fg_missed);
    var threePct = calcPct(session.three_made, session.three_missed);
    var ftPct    = calcPct(session.ft_made, session.ft_missed);

    var totalMade   = session.fg_made + session.three_made + session.ft_made;
    var totalMissed = session.fg_missed + session.three_missed + session.ft_missed;
    var overallPct  = calcPct(totalMade, totalMissed);
    var totalShots  = totalMade + totalMissed;

    // Overall ring
    var ring = document.getElementById('st-pct-ring');
    if (ring) {
      var hex = pctHex(overallPct);
      ring.style.background = 'conic-gradient(' + hex + ' ' + (overallPct * 3.6) + 'deg, var(--c-surface2) 0deg)';
    }

    var pctVal = document.getElementById('st-pct-value');
    if (pctVal) {
      pctVal.textContent = overallPct + '%';
      pctVal.className = 'st-pct-value ' + pctColor(overallPct);
    }

    // FG stat
    var fgEl = document.getElementById('st-fg-pct');
    if (fgEl) {
      fgEl.textContent = fgPct + '%';
      fgEl.className = 'st-stat-pct ' + pctColor(fgPct);
    }
    var fgDetail = document.getElementById('st-fg-detail');
    if (fgDetail) fgDetail.textContent = session.fg_made + '/' + (session.fg_made + session.fg_missed);

    // 3PT stat
    var threeEl = document.getElementById('st-3pt-pct');
    if (threeEl) {
      threeEl.textContent = threePct + '%';
      threeEl.className = 'st-stat-pct ' + pctColor(threePct);
    }
    var threeDetail = document.getElementById('st-3pt-detail');
    if (threeDetail) threeDetail.textContent = session.three_made + '/' + (session.three_made + session.three_missed);

    // FT stat
    var ftEl = document.getElementById('st-ft-pct');
    if (ftEl) {
      ftEl.textContent = ftPct + '%';
      ftEl.className = 'st-stat-pct ' + pctColor(ftPct);
    }
    var ftDetail = document.getElementById('st-ft-detail');
    if (ftDetail) ftDetail.textContent = session.ft_made + '/' + (session.ft_made + session.ft_missed);

    // Summary
    var summary = document.getElementById('st-summary');
    if (summary) {
      summary.innerHTML =
        '<span>Total: <strong>' + totalShots + ' shots</strong></span>' +
        '<span>Made: <strong>' + totalMade + '</strong></span>' +
        '<span>Missed: <strong>' + totalMissed + '</strong></span>';
    }

    container.classList.add('show');
  }

  /* ── Render history ────────────────────────────────────────── */
  function renderHistory(sessions) {
    if (!sessions) sessions = load();

    var list = document.getElementById('st-history-list');
    var empty = document.getElementById('st-history-empty');
    if (!list) return;

    if (sessions.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = '';
      return;
    }

    if (empty) empty.style.display = 'none';

    // Show last 10
    var show = sessions.slice(0, 10);

    list.innerHTML = show.map(function (s) {
      var fgPct    = calcPct(s.fg_made, s.fg_missed);
      var threePct = calcPct(s.three_made, s.three_missed);
      var ftPct    = calcPct(s.ft_made, s.ft_missed);

      var totalMade   = s.fg_made + s.three_made + s.ft_made;
      var totalMissed = s.fg_missed + s.three_missed + s.ft_missed;
      var overallPct  = calcPct(totalMade, totalMissed);

      var d = new Date(s.date);
      var dateStr = d.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
      });

      return '<div class="st-history-card">' +
        '<div class="st-history-date">' + dateStr + '</div>' +
        '<div class="st-history-stats">' +
          '<div class="st-history-stat">' +
            '<div class="st-history-stat-label">Overall</div>' +
            '<div class="st-history-stat-val ' + pctColor(overallPct) + '">' + overallPct + '%</div>' +
          '</div>' +
          '<div class="st-history-stat">' +
            '<div class="st-history-stat-label">FG%</div>' +
            '<div class="st-history-stat-val ' + pctColor(fgPct) + '">' + fgPct + '%</div>' +
          '</div>' +
          '<div class="st-history-stat">' +
            '<div class="st-history-stat-label">3PT%</div>' +
            '<div class="st-history-stat-val ' + pctColor(threePct) + '">' + threePct + '%</div>' +
          '</div>' +
          '<div class="st-history-stat">' +
            '<div class="st-history-stat-label">FT%</div>' +
            '<div class="st-history-stat-val ' + pctColor(ftPct) + '">' + ftPct + '%</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ── Clear form ────────────────────────────────────────────── */
  function clearForm() {
    var ids = ['st-fg-made', 'st-fg-missed', 'st-3pt-made', 'st-3pt-missed', 'st-ft-made', 'st-ft-missed'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    var btn = document.getElementById('st-submit-btn');
    if (btn) {
      btn.addEventListener('click', addSession);
    }

    // Load existing history
    renderHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ShotTracker = {
    load: load,
    addSession: addSession,
    renderHistory: renderHistory
  };
})();
