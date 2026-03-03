     AI PERFORMANCE DASHBOARD
  ══════════════════════════════════════════════════════════════ */

  /* ── Seed data: 3 prior weeks ── */
  const DB_SEED = [
    { week:'Week 1', label:'W1', days:[
      {day:'Mon',shots_made:18,shots_attempted:42,dribbling_min:12,vertical_in:22,sprint_sec:4.9},
      {day:'Tue',shots_made:15,shots_attempted:38,dribbling_min:14,vertical_in:21,sprint_sec:5.0},
      {day:'Wed',shots_made:21,shots_attempted:44,dribbling_min:11,vertical_in:23,sprint_sec:4.8},
      {day:'Thu',shots_made:17,shots_attempted:39,dribbling_min:16,vertical_in:22,sprint_sec:4.9},
      {day:'Fri',shots_made:23,shots_attempted:46,dribbling_min:18,vertical_in:24,sprint_sec:4.7},
    ]},
    { week:'Week 2', label:'W2', days:[
      {day:'Mon',shots_made:22,shots_attempted:42,dribbling_min:15,vertical_in:24,sprint_sec:4.7},
      {day:'Tue',shots_made:20,shots_attempted:40,dribbling_min:17,vertical_in:23,sprint_sec:4.7},
      {day:'Wed',shots_made:26,shots_attempted:45,dribbling_min:13,vertical_in:25,sprint_sec:4.6},
      {day:'Thu',shots_made:21,shots_attempted:41,dribbling_min:19,vertical_in:24,sprint_sec:4.6},
      {day:'Fri',shots_made:28,shots_attempted:47,dribbling_min:21,vertical_in:26,sprint_sec:4.5},
    ]},
    { week:'Week 3', label:'W3', days:[
      {day:'Mon',shots_made:25,shots_attempted:43,dribbling_min:19,vertical_in:26,sprint_sec:4.5},
      {day:'Tue',shots_made:23,shots_attempted:41,dribbling_min:21,vertical_in:25,sprint_sec:4.5},
      {day:'Wed',shots_made:29,shots_attempted:47,dribbling_min:17,vertical_in:27,sprint_sec:4.4},
      {day:'Thu',shots_made:27,shots_attempted:45,dribbling_min:23,vertical_in:27,sprint_sec:4.3},
      {day:'Fri',shots_made:31,shots_attempted:49,dribbling_min:24,vertical_in:28,sprint_sec:4.2},
    ]},
  ];

  const DB_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let dbWeeks    = [...DB_SEED];
  let dbSessions = [];
  let dbResult   = null;
  let dbCharts   = {};
  let dbLoading  = false;

  /* ── helpers ── */
  function dbMean(arr, fn) { return arr.reduce((s,x) => s + fn(x), 0) / arr.length; }
  function dbWeekStats(w) {
    const d = w.days;
    return {
      shooting_pct: Math.round(dbMean(d, r => (r.shots_made/r.shots_attempted)*100)),
      dribbling_min: +dbMean(d, r => r.dribbling_min).toFixed(1),
      vertical_in:   +dbMean(d, r => r.vertical_in).toFixed(1),
      sprint_sec:    +dbMean(d, r => r.sprint_sec).toFixed(2),
      shots_made:    Math.round(dbMean(d, r => r.shots_made)),
    };
  }
  function dbPctChange(curr, prev) {
    return prev === 0 ? 0 : Math.round(((curr - prev) / Math.abs(prev)) * 100);
  }
  function dbWeekNum() { return dbWeeks.length + 1; }
  function dbPrevStats() { return dbWeeks.length > 0 ? dbWeekStats(dbWeeks[dbWeeks.length-1]) : null; }

  /* ── tab switching ── */
  function dbSwitchTab(id, btn) {
    document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.db-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('db-panel-' + id).classList.add('active');
    if (id === 'history') dbRenderHistory();
  }
  function dbSwitchTabById(id) {
    const tabs = document.querySelectorAll('.db-tab');
    const ids = ['log','summary','history'];
    tabs.forEach((t,i) => t.classList.toggle('active', ids[i] === id));
    document.querySelectorAll('.db-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('db-panel-' + id).classList.add('active');
  }

  /* ── update header labels ── */
  function dbUpdateLabels() {
    const wn = dbWeekNum();
    document.getElementById('db-week-label').textContent = 'Week ' + wn;
    document.getElementById('db-week-num').textContent = wn;
    document.getElementById('db-session-count').textContent = dbSessions.length + ' session' + (dbSessions.length !== 1 ? 's' : '') + ' logged';
    const dayLabel = DB_DAYS[dbSessions.length] || 'Extra Day';
    document.getElementById('db-session-label').textContent = 'Session ' + (dbSessions.length + 1) + ' — ' + dayLabel;
    const rem = Math.max(0, 5 - dbSessions.length);
    document.getElementById('db-remaining-label').textContent = dbSessions.length === 0
      ? 'Add your first session →'
      : (rem > 0 ? rem + ' session' + (rem > 1 ? 's' : '') + ' left this week' : 'Week complete!');
  }

  /* ── render session list ── */
  function dbRenderSessions() {
    const list = document.getElementById('db-session-list');
    if (dbSessions.length === 0) {
      list.innerHTML = `<div class="db-empty"><div class="db-empty-icon">📋</div><div class="db-empty-text">No sessions logged yet.<br>Fill the form and tap <strong>Add Session</strong>.</div></div>`;
      return;
    }
    list.innerHTML = dbSessions.map((s, i) => {
      const pct = Math.round((s.shots_made / s.shots_attempted) * 100);
      const bc  = pct >= 65 ? '#56d364' : pct >= 50 ? '#f5a623' : '#f85149';
      return `
        <div class="db-session-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <div class="db-session-day">${s.day}</div>
            <div style="font-size:10px;color:var(--c-dimmer);">Session ${i+1}</div>
          </div>
          <div class="db-session-bar">
            <div class="db-session-bar-fill" style="width:${pct}%;background:${bc};"></div>
          </div>
          <div class="db-session-metrics">
            <div class="db-metric-mini"><div class="db-metric-mini-label">Shot%</div><div class="db-metric-mini-val" style="color:${bc}">${pct}%</div></div>
            <div class="db-metric-mini"><div class="db-metric-mini-label">Drib</div><div class="db-metric-mini-val" style="color:#4ca3ff">${s.dribbling_min}m</div></div>
            <div class="db-metric-mini"><div class="db-metric-mini-label">Vert</div><div class="db-metric-mini-val" style="color:#bc8cff">${s.vertical_in}"</div></div>
            <div class="db-metric-mini"><div class="db-metric-mini-label">Sprint</div><div class="db-metric-mini-val" style="color:#3ddbd9">${s.sprint_sec}s</div></div>
          </div>
        </div>`;
    }).join('');
    // Show generate button
    const btn = document.getElementById('db-gen-btn');
    if (dbSessions.length >= 2) {
      btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
    }
  }

  /* ── add session ── */
  function dbAddSession() {
    const sm  = parseFloat(document.getElementById('db-shots-made').value);
    const sa  = parseFloat(document.getElementById('db-shots-att').value);
    const dr  = parseFloat(document.getElementById('db-dribbling').value);
    const ve  = parseFloat(document.getElementById('db-vertical').value);
    const sp  = parseFloat(document.getElementById('db-sprint').value);
    const err = document.getElementById('db-error');

    err.style.display = 'none';
    if (isNaN(sm) || isNaN(sa) || isNaN(dr) || isNaN(ve) || isNaN(sp)) {
      err.textContent = '⚠ Fill in all 5 performance fields.'; err.style.display = 'block'; return;
    }
    if (sm > sa) {
      err.textContent = '⚠ Shots made can\'t exceed shots attempted.'; err.style.display = 'block'; return;
    }

    dbSessions.push({
      day: DB_DAYS[dbSessions.length] || ('Day ' + (dbSessions.length + 1)),
      shots_made: sm, shots_attempted: sa,
      dribbling_min: dr, vertical_in: ve, sprint_sec: sp,
      notes: document.getElementById('db-notes').value,
    });

    // clear form
    ['db-shots-made','db-shots-att','db-dribbling','db-vertical','db-sprint','db-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    dbUpdateLabels();
    dbRenderSessions();
    showToast('Session logged for ' + dbSessions[dbSessions.length-1].day + '!');
  }

  /* ── chart helpers ── */
  const DB_CHART_DEFAULTS = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: '#181c26', borderColor: 'rgba(255,255,255,0.07)',
      borderWidth: 1, titleColor: 'rgba(240,237,230,0.45)', bodyColor: '#f0ede6',
      padding: 10, titleFont: { size: 10 }, bodyFont: { size: 13, weight: 700 },
    }},
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(240,237,230,0.45)', font: { size: 11 } }, border: { display: false } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(240,237,230,0.45)', font: { size: 11 } }, border: { display: false } },
    },
  };

  function dbDestroyChart(key) {
    if (dbCharts[key]) { dbCharts[key].destroy(); delete dbCharts[key]; }
  }

  function dbBuildCharts(result) {
    // ── Line: daily shooting % ──
    dbDestroyChart('line');
    const lineCtx = document.getElementById('db-chart-line');
    if (lineCtx) {
      dbCharts.line = new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: result.chart_data.daily.map(d => d.day),
          datasets: [{
            label: 'Shooting %', data: result.chart_data.daily.map(d => d.shooting_pct),
            borderColor: '#f5a623', backgroundColor: 'rgba(245,166,35,0.12)',
            borderWidth: 2.5, fill: true, tension: 0.4,
            pointBackgroundColor: '#f5a623', pointRadius: 5, pointHoverRadius: 7,
          }],
        },
        options: { ...DB_CHART_DEFAULTS, scales: { ...DB_CHART_DEFAULTS.scales, y: { ...DB_CHART_DEFAULTS.scales.y, min: 20, max: 100 } } },
      });
    }

    // ── Bar: weekly shooting % all weeks ──
    dbDestroyChart('bar');
    const trendData = [...dbWeeks.slice(-3).map(w => ({ name: w.label, val: dbWeekStats(w).shooting_pct })),
                       { name: 'W' + dbWeekNum(), val: result.weekly_summary.averages.shooting_pct }];
    const barCtx = document.getElementById('db-chart-bar');
    if (barCtx) {
      dbCharts.bar = new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: trendData.map(d => d.name),
          datasets: [{
            label: 'Shooting %', data: trendData.map(d => d.val),
            backgroundColor: trendData.map((d,i) => i === trendData.length-1 ? '#f5a623' : 'rgba(245,166,35,0.3)'),
            borderRadius: 5, borderSkipped: false,
          }],
        },
        options: { ...DB_CHART_DEFAULTS, scales: { ...DB_CHART_DEFAULTS.scales, y: { ...DB_CHART_DEFAULTS.scales.y, min: 0, max: 100 } } },
      });
    }

    // ── Line: vertical trend ──
    dbDestroyChart('vert');
    const allWeeksVert = [...dbWeeks.slice(-3).map(w => ({ name: w.label, val: dbWeekStats(w).vertical_in })),
                          { name: 'W' + dbWeekNum(), val: result.weekly_summary.averages.vertical_in }];
    const vertCtx = document.getElementById('db-chart-vert');
    if (vertCtx) {
      dbCharts.vert = new Chart(vertCtx, {
        type: 'line',
        data: {
          labels: allWeeksVert.map(d => d.name),
          datasets: [{
            label: 'Vertical (in)', data: allWeeksVert.map(d => d.val),
            borderColor: '#bc8cff', backgroundColor: 'rgba(188,140,255,0.1)',
            borderWidth: 2.5, fill: true, tension: 0.4,
            pointBackgroundColor: '#bc8cff', pointRadius: 5,
          }],
        },
        options: DB_CHART_DEFAULTS,
      });
    }

    // ── Line: sprint trend ──
    dbDestroyChart('sprint');
    const allWeeksSprint = [...dbWeeks.slice(-3).map(w => ({ name: w.label, val: dbWeekStats(w).sprint_sec })),
                            { name: 'W' + dbWeekNum(), val: result.weekly_summary.averages.sprint_sec }];
    const sprintCtx = document.getElementById('db-chart-sprint');
    if (sprintCtx) {
      dbCharts.sprint = new Chart(sprintCtx, {
        type: 'line',
        data: {
          labels: allWeeksSprint.map(d => d.name),
          datasets: [{
            label: 'Sprint (s)', data: allWeeksSprint.map(d => d.val),
            borderColor: '#3ddbd9', backgroundColor: 'rgba(61,219,217,0.1)',
            borderWidth: 2.5, fill: true, tension: 0.4,
            pointBackgroundColor: '#3ddbd9', pointRadius: 5,
          }],
        },
        options: DB_CHART_DEFAULTS,
      });
    }
  }

  /* ── render summary from result ── */
  function dbRenderSummary(result) {
    const wn   = dbWeekNum();
    const prev = dbPrevStats();

    document.getElementById('db-summary-empty').style.display   = 'none';
    document.getElementById('db-summary-content').style.display = 'block';

    // tag + trend badge
    document.getElementById('db-fb-tag').textContent = 'AI Coach · Week ' + (wn - 1);
    document.getElementById('db-kpi-title').textContent = 'Week ' + (wn - 1) + ' — Averages';
    document.getElementById('db-json-filename').textContent = 'week_' + (wn - 1) + '_performance.json';

    const trend  = result.comparison.overall_trend;
    const badge  = document.getElementById('db-trend-badge');
    const tColor = trend === 'improving' ? '#56d364' : trend === 'declining' ? '#f85149' : '#4ca3ff';
    badge.textContent = trend;
    badge.style.background = `rgba(${tColor === '#56d364' ? '86,211,100' : tColor === '#f85149' ? '248,81,73' : '76,163,255'},0.12)`;
    badge.style.border     = `1px solid rgba(${tColor === '#56d364' ? '86,211,100' : tColor === '#f85149' ? '248,81,73' : '76,163,255'},0.3)`;
    badge.style.borderRadius = '100px'; badge.style.padding = '3px 10px';
    badge.style.fontSize = '11px'; badge.style.fontWeight = '700'; badge.style.letterSpacing = '0.1em';
    badge.style.color = tColor;

    // feedback text
    document.getElementById('db-headline').textContent     = result.feedback.headline;
    document.getElementById('db-summary-text').textContent = result.feedback.summary;
    document.getElementById('db-strengths').innerHTML = result.feedback.strengths.map(s => `<div class="db-feedback-item">· ${s}</div>`).join('');
    document.getElementById('db-focus').innerHTML     = result.feedback.focus_areas.map(f => `<div class="db-feedback-item">· ${f}</div>`).join('');
    document.getElementById('db-drill').textContent   = result.feedback.drill_recommendation;
    document.getElementById('db-coach-note').textContent = '"' + result.feedback.coach_note + '"';

    // KPIs
    const avg = result.weekly_summary.averages;
    function setKPI(valId, deltaId, curr, prevVal, lowerBetter) {
      document.getElementById(valId).childNodes[0].textContent = curr;
      if (prev && prevVal !== undefined) {
        const d = dbPctChange(curr, prevVal);
        const pos = lowerBetter ? d <= 0 : d >= 0;
        const el = document.getElementById(deltaId);
        el.textContent = (pos ? '▲ ' : '▼ ') + Math.abs(d) + '% vs prev week';
        el.style.color = pos ? '#56d364' : '#f85149';
      }
    }
    setKPI('kpi-shot',   'kpi-shot-d',   avg.shooting_pct,  prev?.shooting_pct,  false);
    setKPI('kpi-drib',   'kpi-drib-d',   avg.dribbling_min, prev?.dribbling_min, false);
    setKPI('kpi-vert',   'kpi-vert-d',   avg.vertical_in,   prev?.vertical_in,   false);
    setKPI('kpi-sprint', 'kpi-sprint-d', avg.sprint_sec,    prev?.sprint_sec,    true);

    // JSON pane
    document.getElementById('db-json-body').textContent = JSON.stringify(result, null, 2);

    // charts (slight delay so canvas is visible)
    setTimeout(() => dbBuildCharts(result), 80);
  }

  /* ── render history ── */
  function dbRenderHistory() {
    const list = document.getElementById('db-history-list');
    document.getElementById('db-history-count').textContent = dbWeeks.length + ' week' + (dbWeeks.length !== 1 ? 's' : '') + ' tracked';
    if (dbWeeks.length === 0) {
      list.innerHTML = `<div class="db-empty"><div class="db-empty-icon">📅</div><div class="db-empty-text">No history yet. Complete a week to see it here.</div></div>`;
      return;
    }
    list.innerHTML = [...dbWeeks].reverse().map((w, i) => {
      const s = dbWeekStats(w);
      const isLatest = i === 0 && dbResult;
      return `
        <div class="db-history-card" style="${isLatest ? 'border-color:rgba(245,166,35,0.28)' : ''}">
          <div class="db-history-header" style="${isLatest ? 'background:linear-gradient(135deg,rgba(245,166,35,0.07) 0%,transparent 60%)' : ''}">
            <div class="db-history-week" style="color:${isLatest ? '#f5a623' : 'var(--c-white)'}">${w.week}${isLatest ? ' <span style="font-size:13px;font-weight:400;">· Latest</span>' : ''}</div>
            <div style="font-size:11px;color:var(--c-dimmer)">${w.days.length} sessions</div>
          </div>
          <div class="db-history-body">
            <div class="db-history-stats">
              ${[
                {l:'Shooting%', v:s.shooting_pct+'%'},
                {l:'Avg Dribble', v:s.dribbling_min+'m'},
                {l:'Avg Vertical', v:s.vertical_in+'"'},
                {l:'Avg Sprint', v:s.sprint_sec+'s'},
                {l:'Sessions', v:w.days.length},
              ].map(({l,v}) => `<div class="db-history-stat"><div class="db-history-stat-label">${l}</div><div class="db-history-stat-val">${v}</div></div>`).join('')}
            </div>
            <div class="db-day-bars">
              ${w.days.map(d => {
                const pct = Math.round((d.shots_made/d.shots_attempted)*100);
                const bc  = pct>=65?'rgba(86,211,100,0.45)':pct>=50?'rgba(245,166,35,0.45)':'rgba(248,81,73,0.4)';
                return `<div class="db-day-bar-wrap"><div class="db-day-bar-bg"><div class="db-day-bar-fill" style="height:${pct}%;background:${bc}"></div></div><div class="db-day-bar-label">${d.day}</div></div>`;
              }).join('')}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ── copy JSON ── */
  function dbCopyJSON() {
    if (!dbResult) return;
    const text = JSON.stringify(dbResult, null, 2);
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    const btn = document.querySelector('.db-copy-btn');
    btn.textContent = '✓ Copied!';
    btn.style.color  = '#56d364';
    setTimeout(() => { btn.textContent = 'Copy JSON'; btn.style.color = ''; }, 2000);
  }

  /* ── GENERATE via Anthropic API ── */
  async function dbGenerate() {
    if (dbSessions.length < 2) return;
    if (dbLoading) return;
    dbLoading = true;

    const btn = document.getElementById('db-gen-btn');
    btn.textContent = '⚙️ Analyzing with AI…';
    btn.disabled = true;

    const wn   = dbWeekNum();
    const prev = dbPrevStats();
    const player   = document.getElementById('db-player').value || 'Athlete';
    const position = document.getElementById('db-position').value || 'Point Guard';

    const prompt = `You are an elite basketball performance analytics AI for CourtIQ.

Player: ${player} | Position: ${position} | Analyzing: Week ${wn}

Week ${wn} sessions (${dbSessions.length} days):
${JSON.stringify(dbSessions, null, 2)}

Previous weeks stats:
${JSON.stringify(dbWeeks.map(w => ({ week: w.week, stats: dbWeekStats(w) })), null, 2)}

Return ONLY valid JSON with this exact schema — no markdown, no extra text:
{
  "player": "${player}",
  "position": "${position}",
  "week": "Week ${wn}",
  "generated_at": "<ISO 8601>",
  "weekly_summary": {
    "sessions_logged": <number>,
    "consistency_score": <0-100>,
    "averages": {
      "shooting_pct": <number>,
      "dribbling_min": <number>,
      "vertical_in": <number>,
      "sprint_sec": <number>,
      "shots_made": <number>
    },
    "best_session": { "day": "<string>", "reason": "<max 12 words>" },
    "weakest_session": { "day": "<string>", "reason": "<max 12 words>" }
  },
  "comparison": {
    "vs_prev_week": {
      "shooting_pct":  { "delta": <number>, "pct_change": <number>, "trend": "up|down|flat" },
      "dribbling_min": { "delta": <number>, "pct_change": <number>, "trend": "up|down|flat" },
      "vertical_in":   { "delta": <number>, "pct_change": <number>, "trend": "up|down|flat" },
      "sprint_sec":    { "delta": <number>, "pct_change": <number>, "trend": "up|down|flat" }
    },
    "overall_trend": "improving|plateauing|declining"
  },
  "chart_data": {
    "daily": [
      { "day": "<string>", "shooting_pct": <number>, "dribbling_min": <number>, "vertical_in": <number>, "sprint_sec": <number> }
    ]
  },
  "feedback": {
    "headline": "<8-10 word punchy headline>",
    "summary": "<2-3 sentences of specific data-driven analysis>",
    "strengths": ["<strength 1>", "<strength 2>"],
    "focus_areas": ["<area 1>", "<area 2>"],
    "drill_recommendation": "<one specific drill + brief reason, max 20 words>",
    "coach_note": "<one motivational sentence, max 15 words>"
  }
}`;

    try {
      const res = await fetch('https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      const text = (data.content || []).map(b => b.text || '').join('');
      const result = JSON.parse(text.replace(/```json|```/g, '').trim());

      dbResult = result;
      dbWeeks  = [...dbWeeks, { week: 'Week ' + wn, label: 'W' + wn, days: dbSessions }];
      dbSessions = [];

      dbUpdateLabels();
      dbRenderSessions();
      dbRenderSummary(result);

      // switch to summary
      dbSwitchTabById('summary');
      document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch(e) {
      const err = document.getElementById('db-error');
      err.textContent = '⚠ AI analysis failed — check your connection and try again.';
      err.style.display = 'block';
      console.error(e);
    } finally {
      dbLoading = false;
      btn.textContent = '🤖 Generate AI Summary →';
      btn.disabled = dbSessions.length < 2;
      if (dbSessions.length < 2) { btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed'; }
    }
  }

  /* init labels on load */
  dbUpdateLabels();
  dbRenderHistory();

  /* ══════════════════════════════════════════════════════════════
     NOTIFICATIONS TAB — AI-generated push & email content
     Prompt: Generate push notifications and emails for upcoming
     workouts including day, exercises, and motivation as JSON.
  ══════════════════════════════════════════════════════════════ */

  let notifResult = null;
  let notifLoading = false;

  /* The exact system prompt as specified */
  const NOTIF_SYSTEM_PROMPT = `You are an AI assistant. Generate text for push notifications and emails for upcoming workouts:
- Include day, exercises, and motivation
- Example: "Hey [Name], today's workout: 5 shooting drills + 15 minutes conditioning. Let's improve your 3-point shot!"
Output as JSON array of notifications per day.`;

  function notifBuildUserPrompt(name, goal, channel) {
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const drillSets = [
      ['3-point shooting circuit','catch & shoot reps','pull-up jumper series','spot-up 3s','off-screen shooting'],
      ['crossover dribble drill','behind-the-back combo','tennis ball ball-handling','figure-8 dribble','speed dribble sprints'],
      ['box jump series','lateral hurdle hops','depth jump protocol','single-leg squat jumps','sprint intervals'],
      ['defensive slide drill','closeout technique','on-ball pressure drill','help-side rotations','box-out footwork'],
      ['full-court layup series','euro step finishing','floater practice','reverse layup reps','contact finishing'],
      ['active recovery stretching','film review session','light shooting warmup'],
    ];
    const weekDays = days.map((d, i) => ({
      day: d,
      exercises: drillSets[i].slice(0, i === 5 ? 3 : 4),
      intensity: i === 5 ? 'Recovery' : i % 2 === 0 ? 'High' : 'Medium',
    }));

    return `Generate a full week of workout notifications for the following athlete:

Name: ${name}
Goal: ${goal}
Channel: ${channel}
Week: Week ${dbWeeks.length + 1}

Training schedule:
${JSON.stringify(weekDays, null, 2)}

Return ONLY a valid JSON array — no markdown, no extra text. Each element must have:
{
  "day": "Monday",
  "date": "Mar 3, 2025",
  "exercises": ["exercise 1", "exercise 2", ...],
  "intensity": "High|Medium|Recovery",
  "push_notification": {
    "title": "Short title (max 8 words)",
    "body": "Full push text mentioning name, exercises, motivation (max 30 words)"
  },
  "email": {
    "subject": "Email subject line (max 10 words)",
    "preview_text": "Preview snippet shown in inbox (max 20 words)",
    "body": "Full email body — 3-4 sentences. Mention name, specific exercises, the goal (${goal}), and a motivational close."
  },
  "motivation_quote": "One short punchy motivational line (max 12 words)"
}`;
  }

  async function notifGenerate() {
    if (notifLoading) return;
    notifLoading = true;

    const name    = document.getElementById('notif-name').value.trim() || 'Athlete';
    const goal    = document.getElementById('notif-goal').value;
    const channel = document.getElementById('notif-channel').value;

    const btn = document.getElementById('notif-gen-btn');
    btn.textContent = '⚙️ Generating…';
    btn.disabled = true;

    document.getElementById('notif-empty').style.display    = 'none';
    document.getElementById('notif-results').style.display  = 'none';
    document.getElementById('notif-loading').style.display  = 'block';
    document.getElementById('notif-error').style.display    = 'none';

    const userPrompt = notifBuildUserPrompt(name, goal, channel);

    // Store prompt for display
    const fullPrompt = NOTIF_SYSTEM_PROMPT + '\n\n---\n\n' + userPrompt;

    try {
      const res = await fetch('https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: NOTIF_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      const data   = await res.json();
      const text   = (data.content || []).map(b => b.text || '').join('');
      const clean  = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      notifResult = result;

      document.getElementById('notif-loading').style.display  = 'none';
      document.getElementById('notif-results').style.display  = 'block';
      document.getElementById('notif-prompt-box').textContent = fullPrompt;
      document.getElementById('notif-week-label').textContent = `Week ${dbWeeks.length + 1} — Notification Schedule`;
      document.getElementById('notif-json-body').textContent  = JSON.stringify(result, null, 2);

      notifRenderCards(result, channel);

    } catch(e) {
      document.getElementById('notif-loading').style.display = 'none';
      document.getElementById('notif-empty').style.display   = 'block';
      const errEl = document.getElementById('notif-error');
      errEl.textContent = '⚠ Failed to generate notifications. Check your connection and try again.';
      errEl.style.display = 'block';
      console.error(e);
    } finally {
      notifLoading = false;
      btn.textContent = '🔔 Regenerate';
      btn.disabled = false;
    }
  }

  function notifRenderCards(days, channel) {
    const container = document.getElementById('notif-cards');
    const showPush  = channel !== 'email';
    const showEmail = channel !== 'push';

    const intensityColor = { High:'#f85149', Medium:'#f5a623', Recovery:'#56d364' };

    container.innerHTML = days.map(d => {
      const ic = intensityColor[d.intensity] || '#f5a623';
      return `
        <div class="notif-card">
          <div class="notif-card-header">
            <div>
              <div class="notif-day-name">${d.day}</div>
              <div class="notif-day-date">${d.date || ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-left:12px;">
              <span style="font-size:10px;font-weight:700;letter-spacing:0.1em;padding:3px 9px;border-radius:100px;background:rgba(${ic==='#f85149'?'248,81,73':ic==='#f5a623'?'245,166,35':'86,211,100'},0.1);color:${ic};border:1px solid rgba(${ic==='#f85149'?'248,81,73':ic==='#f5a623'?'245,166,35':'86,211,100'},0.25);">${d.intensity}</span>
            </div>
            <div class="notif-channels">
              ${showPush  ? '<span class="notif-chip push">📱 Push</span>'  : ''}
              ${showEmail ? '<span class="notif-chip email">✉ Email</span>' : ''}
            </div>
          </div>

          <div class="notif-card-body">

            <!-- Exercises -->
            <div>
              <div class="notif-message-label">🏀 Exercises</div>
              <div class="notif-exercises">
                ${(d.exercises || []).map(ex => `<span class="notif-ex-tag">${ex}</span>`).join('')}
              </div>
            </div>

            ${showPush && d.push_notification ? `
            <!-- Push notification -->
            <div class="notif-message-block">
              <div class="notif-message-label">📱 Push Notification</div>
              <div class="notif-push-bubble">
                <div class="notif-push-title">${d.push_notification.title || ''}</div>
                <div class="notif-push-body">${d.push_notification.body || ''}</div>
              </div>
            </div>` : ''}

            ${showEmail && d.email ? `
            <!-- Email -->
            <div class="notif-message-block">
              <div class="notif-message-label">✉ Email</div>
              <div class="notif-email-block">
                <div class="notif-email-subject">Subject: ${d.email.subject || ''}</div>
                ${d.email.preview_text ? `<div style="font-size:11px;color:var(--c-dimmer);margin-bottom:8px;font-style:italic;">Preview: ${d.email.preview_text}</div>` : ''}
                <div class="notif-email-preview">${d.email.body || ''}</div>
              </div>
            </div>` : ''}

            <!-- Motivation -->
            ${d.motivation_quote ? `
            <div class="notif-motivation">"${d.motivation_quote}"</div>` : ''}

          </div>
        </div>`;
    }).join('');
  }

  function notifTogglePrompt() {
    const box   = document.getElementById('notif-prompt-box');
    const arrow = document.getElementById('notif-prompt-arrow');
    const open  = box.style.display === 'block';
    box.style.display  = open ? 'none' : 'block';
    arrow.textContent  = open ? '▼' : '▲';
  }

  function notifCopyJSON() {
    if (!notifResult) return;
    const text = JSON.stringify(notifResult, null, 2);
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    const btn = document.querySelector('#db-panel-notifications .db-copy-btn');
    if (!btn) return;
    btn.textContent = '✓ Copied!';
    btn.style.color  = '#56d364';
    setTimeout(() => { btn.textContent = 'Copy JSON'; btn.style.color = ''; }, 2000);
  }

  /* patch dbSwitchTab to handle notifications panel */
  const _origSwitch = dbSwitchTab;
  function dbSwitchTab(id, btn) {
    document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.db-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('db-panel-' + id).classList.add('active');
    if (id === 'history') dbRenderHistory();
  }


  function submitNewsletter() {
    const name  = document.getElementById('sb-name').value.trim();
    const email = document.getElementById('sb-email').value.trim();
    if (!email || !email.includes('@')) {
      document.getElementById('sb-email').style.borderColor = '#e84040';
      document.getElementById('sb-email').focus();
      setTimeout(() => document.getElementById('sb-email').style.borderColor = '', 2000);
      return;
    }
    document.getElementById('sb-form').style.display = 'none';
    document.getElementById('sb-success').style.display = 'block';
    showToast('You\'re on the list! Check your inbox for a welcome email.');
  }

  /* ══════════════════════════════════════════════════════════════
