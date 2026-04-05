/* ══════════════════════════════════════════════════════════════
   THE LAB — Panel Orchestrator
   Inits on every switch to the STATS (shots) tab.
   Reuses: ShotTracker.load(), ProgressCharts, XPSystem
   ══════════════════════════════════════════════════════════════ */

'use strict';

var _labInited = false;

function labPanelInit() {
  labLoadStats();
  labRenderTrackerSummary();
  labRenderCoachPreview();
  labRenderConsistencyBars();
  // Draw progress chart (ProgressCharts module handles canvas)
  if (window.ProgressCharts && typeof ProgressCharts.refresh === 'function') {
    setTimeout(function () { ProgressCharts.refresh(); }, 100);
  }
  _labInited = true;
}

/* ── Section 1: Performance stat cards ─────────────────────── */
function labLoadStats() {
  // Sessions count
  var sessions = [];
  try { sessions = JSON.parse(localStorage.getItem('courtiq-shot-sessions') || '[]'); } catch(e) {}
  var sessionCount = sessions.length;

  // FG% average (last 10 sessions)
  var fgPct = '—';
  var recent = sessions.slice(-10);
  if (recent.length > 0) {
    var totalMade = 0, totalAtt = 0;
    recent.forEach(function(s) {
      totalMade += (s.fg_made || 0) + (s.three_made || 0) + (s.ft_made || 0);
      totalAtt  += (s.fg_made || 0) + (s.fg_missed || 0)
                 + (s.three_made || 0) + (s.three_missed || 0)
                 + (s.ft_made || 0) + (s.ft_missed || 0);
    });
    if (totalAtt > 0) fgPct = Math.round((totalMade / totalAtt) * 100) + '%';
  }

  // XP
  var xp = 0;
  try {
    var xpData = window.XPSystem ? XPSystem.load() : null;
    if (xpData) xp = xpData.xp || 0;
  } catch(e) {}

  // Streak
  var streak = 0;
  try { streak = parseInt(localStorage.getItem('courtiq-streak') || '0', 10) || 0; } catch(e) {}

  // Fill stat cards
  _labSetStat('lab-stat-pts', sessionCount, 'Sessions');
  _labSetStat('lab-stat-fg',  fgPct,        fgPct === '—' ? 'Log sessions to unlock' : 'Avg FG%');
  _labSetStat('lab-stat-vol', xp > 0 ? xp.toLocaleString() : '—', 'Total XP');
  _labSetStat('lab-stat-vert', streak > 0 ? streak + ' 🔥' : '—', 'Day Streak');
}

function _labSetStat(id, value, sub) {
  var numEl = document.getElementById(id);
  if (numEl) numEl.textContent = value;
  var subEl = document.getElementById(id + '-sub');
  if (subEl) { subEl.textContent = sub; subEl.style.display = 'block'; }
}

/* ── Section 2: Shot Tracker summary (right panel) ─────────── */
function labRenderTrackerSummary() {
  var el = document.getElementById('lab-tracker-summary');
  if (!el) return;

  var sessions = [];
  try { sessions = JSON.parse(localStorage.getItem('courtiq-shot-sessions') || '[]'); } catch(e) {}

  if (sessions.length === 0) {
    el.innerHTML = '<div class="lab-empty-state">'
      + '<div class="lab-empty-icon">🎯</div>'
      + '<div class="lab-empty-text">No sessions yet.<br>Launch the camera to track your first shot.</div>'
      + '</div>';
    return;
  }

  var last = sessions[sessions.length - 1];
  var made  = (last.fg_made || 0) + (last.three_made || 0) + (last.ft_made || 0);
  var total = made + (last.fg_missed || 0) + (last.three_missed || 0) + (last.ft_missed || 0);
  var pct   = total > 0 ? Math.round((made / total) * 100) : 0;
  var dateStr = last.date ? new Date(last.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  el.innerHTML = '<div class="lab-tracker-summary">'
    + '<div class="lab-tracker-label">Last Session' + (dateStr ? ' · ' + dateStr : '') + '</div>'
    + '<div class="lab-tracker-big-num">' + pct + '%</div>'
    + '<div class="lab-tracker-label">Field Goal %</div>'
    + '<div class="lab-tracker-row">'
    + '<div class="lab-tracker-mini"><div class="lab-tracker-mini-num">' + made + '</div><div class="lab-tracker-mini-lbl">Made</div></div>'
    + '<div class="lab-tracker-mini"><div class="lab-tracker-mini-num">' + total + '</div><div class="lab-tracker-mini-lbl">Attempts</div></div>'
    + '</div>'
    + '</div>';
}

/* ── Section 3: AI Coach preview (right panel) ──────────────── */
function labRenderCoachPreview() {
  var el = document.getElementById('lab-coach-preview');
  if (!el) return;

  // Try to read last coach plan from localStorage
  var plan = null;
  try { plan = JSON.parse(localStorage.getItem('courtiq-coach-plan') || 'null'); } catch(e) {}

  if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
    el.innerHTML = '<div class="lab-empty-state">'
      + '<div class="lab-empty-icon">🤖</div>'
      + '<div class="lab-empty-text">No plan yet.<br>Open the AI Coach to generate your program.</div>'
      + '</div>';
    return;
  }

  // Show first 3 days as preview tags
  var preview = plan.days.slice(0, 3);
  var html = '<div class="lab-coach-preview">';
  preview.forEach(function(day) {
    var intensity = day.intensity || '';
    var focus = day.focus || day.drills || '';
    html += '<div class="lab-coach-day-tag">'
      + '<span class="lab-coach-day-name">' + (day.day || '').substring(0, 3) + '</span>'
      + '<span class="lab-coach-day-focus">' + focus + '</span>'
      + (intensity ? '<span class="lab-coach-day-intensity">' + intensity + '</span>' : '')
      + '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

/* ── Section 4: Consistency bars (real data) ────────────────── */
function labRenderConsistencyBars() {
  var container = document.getElementById('lab-consistency-bars');
  if (!container) return;

  var sessions = [];
  try { sessions = JSON.parse(localStorage.getItem('courtiq-shot-sessions') || '[]'); } catch(e) {}

  // Build last-7-days counts
  var days = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var key = d.toISOString().substring(0, 10);
    var label = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    var count = sessions.filter(function(s) { return (s.date || '').substring(0, 10) === key; }).length;
    days.push({ label: label, count: count, isToday: i === 0 });
  }

  var maxCount = Math.max(1, Math.max.apply(null, days.map(function(d) { return d.count; })));

  var barsHtml = '<div class="lab-bars-wrap">';
  days.forEach(function(day) {
    var heightPct = Math.max(4, Math.round((day.count / maxCount) * 100));
    var cls = 'lab-bar' + (day.isToday ? ' lab-bar--active' : '');
    barsHtml += '<div class="' + cls + '" style="height:' + heightPct + '%">'
      + '<span class="lab-bar-label">' + (day.count > 0 ? day.count : '') + '</span>'
      + '</div>';
  });
  barsHtml += '</div>';

  var labelsHtml = '<div class="lab-bars-day-labels">';
  days.forEach(function(day) {
    labelsHtml += '<div class="lab-bars-day-label">' + day.label + '</div>';
  });
  labelsHtml += '</div>';

  container.innerHTML = barsHtml + labelsHtml;
}
