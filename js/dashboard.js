/* ══════════════════════════════════════════════════════════════
   AI PERFORMANCE DASHBOARD — Supabase-backed
   ══════════════════════════════════════════════════════════════ */

  const DB_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let dbWeeks    = [];
  let dbSessions = [];
  let dbResult   = null;
  let dbCharts   = {};
  let dbLoading  = false;
  let currentWeekId  = null;
  let currentWeekNum = 1;

  /* ══════════════════════════════════════════════════════════════
     AUTH GUARD — redirect if not logged in
  ══════════════════════════════════════════════════════════════ */
  (async function authGuard() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return;
    }
    window.currentUser = session.user;
    window.currentSession = session;

    // Update sidebar user info
    const sidebarName = document.getElementById('db-sidebar-name');
    const sidebarAvatar = document.getElementById('db-sidebar-avatar');
    if (sidebarName) {
      const name = session.user.user_metadata?.first_name || session.user.email;
      sidebarName.textContent = name;

      // Render 3D mini avatar in sidebar
      if (sidebarAvatar && typeof AvatarBridge !== 'undefined') {
        try {
          var obSidebar = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
          if (obSidebar.avatar) {
            AvatarBridge.renderMini(sidebarAvatar, obSidebar.avatar);
          } else {
            // No avatar data yet — show initials
            if (typeof name === 'string') {
              const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
              sidebarAvatar.textContent = initials || name[0]?.toUpperCase() || '?';
            }
          }
        } catch (e) {
          if (typeof name === 'string') {
            const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
            sidebarAvatar.textContent = initials || name[0]?.toUpperCase() || '?';
          }
        }
      } else if (sidebarAvatar && typeof name === 'string') {
        const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
        sidebarAvatar.textContent = initials || name[0]?.toUpperCase() || '?';
      }
    }

    // Also update old nav elements (backwards compat)
    const greeting = document.getElementById('nav-user-greeting');
    const signoutBtn = document.getElementById('nav-signout-btn');
    const signinLink = document.getElementById('nav-signin-link');
    const trialBtn = document.getElementById('nav-trial-btn');
    const drawerSignout = document.getElementById('drawer-signout');
    if (greeting) {
      const name = session.user.user_metadata?.first_name || session.user.email;
      greeting.textContent = name;
      greeting.style.display = '';
    }
    if (signoutBtn) signoutBtn.style.display = '';
    if (signinLink) signinLink.style.display = 'none';
    if (trialBtn) trialBtn.style.display = 'none';
    if (drawerSignout) drawerSignout.style.display = '';

    // Listen for session expiry
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = 'index.html';
      }
    });

    // Load data
    await initDashboard();
  })();

  /* ══════════════════════════════════════════════════════════════
     INIT — load profile + weeks from Supabase
  ══════════════════════════════════════════════════════════════ */
  async function initDashboard() {
    try {
      // ── Sync user_data from Supabase → localStorage (new device restore) ──
      if (typeof DataService !== 'undefined') {
        try {
          const userData = await DataService.getUserData();
          if (userData) {
            // Restore XP if not already in localStorage
            if (userData.xp_data && !localStorage.getItem('courtiq-xp')) {
              localStorage.setItem('courtiq-xp', JSON.stringify(userData.xp_data));
              if (typeof XPSystem !== 'undefined' && XPSystem.render) XPSystem.render();
            }
            // Restore onboarding if not already done on this device
            if (userData.onboarding_data && !localStorage.getItem('courtiq-onboarding-complete')) {
              const ob = userData.onboarding_data;
              localStorage.setItem('courtiq-onboarding-data', JSON.stringify(ob));
              localStorage.setItem('courtiq-onboarding-complete', String(ob.ts || Date.now()));
              if (ob.archetype) {
                localStorage.setItem('courtiq-archetype', JSON.stringify({ key: ob.archetype, ts: Date.now() }));
              }
              if (ob.position) {
                const vals = Object.values(ob.skills || {});
                const skillAvg = vals.length ? vals.reduce(function (s, v) { return s + v; }, 0) / vals.length : 5;
                const skillLevel = skillAvg >= 7 ? 'Advanced' : skillAvg >= 4 ? 'Intermediate' : 'Beginner';
                localStorage.setItem('courtiq-player-profile', JSON.stringify({
                  position: ob.position || '',
                  height: String(ob.height || ''),
                  age: String(ob.age || ''),
                  skillLevel: skillLevel,
                  primaryGoal: ob.goals ? ob.goals[0] : ''
                }));
              }
            }
          }
        } catch (e) { /* silently skip — user still gets localStorage version */ }
      }
      // ── End Supabase sync ─────────────────────────────────

      // ── Onboarding check ─────────────────────────────────
      const onboardingDone = localStorage.getItem('courtiq-onboarding-complete');
      if (!onboardingDone && typeof Onboarding !== 'undefined') {
        Onboarding.launch();
        return;
      }
      // ── End onboarding check ─────────────────────────────

      // Set topbar date
      var dateEl = document.getElementById('db-topbar-date');
      if (dateEl) {
        var now = new Date();
        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }

      // Load profile → populate player name & position
      const profile = await DataService.getProfile();
      const positionMap = { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' };
      if (profile) {
        const playerEl = document.getElementById('db-player');
        const posEl    = document.getElementById('db-position');
        if (playerEl && profile.first_name) playerEl.value = profile.first_name;
        if (posEl && profile.position) {
          const posKey = profile.position.toUpperCase();
          posEl.value = positionMap[posKey] || profile.position;
        }

        // Pre-fill notification name with actual player name
        const notifNameEl = document.getElementById('notif-name');
        if (notifNameEl) {
          const onboarding = (() => { try { return JSON.parse(localStorage.getItem('courtiq-onboarding-data')); } catch(e) { return null; } })();
          const playerName = profile.first_name || (onboarding && onboarding.name) || '';
          if (playerName) notifNameEl.value = playerName;
        }
      }

      // Load all weeks with sessions
      const weeks = await DataService.getWeeks();

      // Find weeks that have a summary (completed) vs the current in-progress week
      const completedWeeks = weeks.filter(w => w.summary_json);
      const inProgressWeek = weeks.find(w => !w.summary_json);

      // Map completed weeks to display format
      dbWeeks = completedWeeks.map(w => ({
        id: w.id,
        week: 'Week ' + w.week_number,
        label: w.label || ('W' + w.week_number),
        days: (w.training_sessions || []).map(s => ({
          day: s.day,
          shots_made: Number(s.shots_made),
          shots_attempted: Number(s.shots_attempted),
          dribbling_min: Number(s.dribbling_min),
          vertical_in: Number(s.vertical_in),
          sprint_sec: Number(s.sprint_sec),
          notes: s.notes || '',
        })),
        summary_json: w.summary_json,
      }));

      // Set up current week
      if (inProgressWeek) {
        currentWeekId  = inProgressWeek.id;
        currentWeekNum = inProgressWeek.week_number;
        dbSessions = (inProgressWeek.training_sessions || []).map(s => ({
          day: s.day,
          shots_made: Number(s.shots_made),
          shots_attempted: Number(s.shots_attempted),
          dribbling_min: Number(s.dribbling_min),
          vertical_in: Number(s.vertical_in),
          sprint_sec: Number(s.sprint_sec),
          notes: s.notes || '',
        }));
      } else {
        // Create a new week
        currentWeekNum = completedWeeks.length + 1;
        const newWeek = await DataService.createWeek(currentWeekNum, 'W' + currentWeekNum);
        currentWeekId = newWeek.id;
        dbSessions = [];
      }

      // If the last completed week has a stored AI result, restore it
      if (completedWeeks.length > 0) {
        const lastWeek = completedWeeks[completedWeeks.length - 1];
        if (lastWeek.summary_json) {
          dbResult = lastWeek.summary_json;
        }
      }

    } catch (e) {
      console.error('Failed to load dashboard data:', e);
      showToast('Failed to load your data. Please refresh.', true);
    }

    dbUpdateLabels();
    dbRenderSessions();
    dbRenderHistory();

    // If we have a previous AI result, show the summary
    if (dbResult) {
      dbRenderSummary(dbResult);
    }
  }

  /* ── helpers ── */
  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function clampLength(str, max) { return str.length > max ? str.slice(0, max) : str; }
  function dbMean(arr, fn) { return arr.reduce((s,x) => s + fn(x), 0) / arr.length; }
  function dbWeekStats(w) {
    const d = w.days;
    if (!d || d.length === 0) return { shooting_pct:0, dribbling_min:0, vertical_in:0, sprint_sec:0, shots_made:0 };
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
  function dbWeekNum() { return currentWeekNum; }
  function dbPrevStats() { return dbWeeks.length > 0 ? dbWeekStats(dbWeeks[dbWeeks.length-1]) : null; }

  /* ── tab switching ── */
  function dbSwitchTab(id, btn) {
    // Update sidebar active state
    document.querySelectorAll('.db-sidebar-item').forEach(i => i.classList.remove('active'));
    // Also clear old tab buttons if any exist
    document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));

    if (btn) {
      btn.classList.add('active');
    } else {
      const sidebarBtn = document.querySelector('.db-sidebar-item[data-tab="' + id + '"]');
      if (sidebarBtn) sidebarBtn.classList.add('active');
    }

    // Toggle panels
    document.querySelectorAll('.db-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('db-panel-' + id);
    if (panel) panel.classList.add('active');

    // Toggle home-active state: hide sidebar on home, show on others
    var layoutRoot = document.querySelector('.db-layout-root');
    if (layoutRoot) {
      if (id === 'home') {
        layoutRoot.classList.add('db-home-active');
      } else {
        layoutRoot.classList.remove('db-home-active');
      }
    }

    // Update breadcrumb
    var breadcrumbNames = {
      home: 'Home', summary: 'Weekly Summary', shots: 'Shot Tracker', coach: 'AI Coach',
      log: 'Log Session', history: 'History', calendar: 'Calendar',
      drills: 'Drills', workouts: 'Workouts', moves: 'Move Library',
      progress: 'Progress', profile: 'Profile', archetype: 'Archetype',
      shop: 'Avatar Shop', 'daily-challenge': 'Daily Challenge'
    };
    var bcEl = document.getElementById('db-breadcrumb-current');
    if (bcEl) bcEl.textContent = breadcrumbNames[id] || id;

    // Hide breadcrumb on home panel
    var topbar = document.getElementById('db-topbar');
    if (topbar) {
      var bc = topbar.querySelector('.db-breadcrumb');
      if (bc) bc.style.display = (id === 'home') ? 'none' : '';
    }

    // GSAP tab animation (graceful fallback)
    if (panel && window.CourtIQAnimations && CourtIQAnimations.tabIn) {
      CourtIQAnimations.tabIn(panel);
    }

    // Panel-specific init calls
    if (id === 'history') dbRenderHistory();
    if (id === 'calendar' && typeof calSetSource === 'function') {
      calSetSource(typeof calSource !== 'undefined' ? calSource : 'coach',
        document.getElementById('cal-src-' + (typeof calSource !== 'undefined' ? calSource : 'coach')));
    }
    if (id === 'moves' && typeof movesInit === 'function' && !window._movesInitialized) {
      window._movesInitialized = true; movesInit();
    }
    if (id === 'workouts' && typeof workoutsInit === 'function' && !window._workoutsInitialized) {
      window._workoutsInitialized = true; workoutsInit();
    }
    if (id === 'drills' && typeof drillsInit === 'function') drillsInit();
    if (id === 'archetype' && typeof archetypeInit === 'function') archetypeInit();
    if (id === 'shop') {
      if (typeof AvatarShop !== 'undefined' && AvatarShop.render) AvatarShop.render();
      try {
        var shopContainer = document.getElementById('shop-avatar-container');
        var obData = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
        if (shopContainer && typeof AvatarBridge !== 'undefined' && obData.avatar) {
          AvatarBridge.render(shopContainer, Object.assign({}, obData.avatar, { position: obData.position || 'SG' }), { width: 200, height: 280, interactive: true, animate: true });
        }
      } catch (e) {}
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('db-sidebar');
    const overlay = document.getElementById('db-sidebar-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('visible');
  }
  function dbSwitchTabById(id) {
    dbSwitchTab(id, null);
  }

  /* ── update header labels ── */
  function dbUpdateLabels() {
    const wn = dbWeekNum();
    const weekLabel = document.getElementById('db-week-label');
    const weekNum = document.getElementById('db-week-num');
    if (weekLabel) weekLabel.textContent = 'Week ' + wn;
    if (weekNum) weekNum.textContent = wn;
    document.getElementById('db-session-count').textContent = dbSessions.length + ' session' + (dbSessions.length !== 1 ? 's' : '') + ' logged';
    const dayLabel = DB_DAYS[dbSessions.length] || 'Extra Day';
    document.getElementById('db-session-label').textContent = 'Session ' + (dbSessions.length + 1) + ' — ' + dayLabel;
    const rem = Math.max(0, 5 - dbSessions.length);
    document.getElementById('db-remaining-label').textContent = dbSessions.length === 0
      ? 'Add your first session \u2192'
      : (rem > 0 ? rem + ' session' + (rem > 1 ? 's' : '') + ' left this week' : 'Week complete!');

    // Update week progress bar
    const progressText = document.getElementById('db-progress-text');
    const progressFill = document.getElementById('db-progress-fill');
    if (progressText) {
      const pct = Math.min(100, Math.round((dbSessions.length / 5) * 100));
      progressText.textContent = 'Sessions this week: ' + dbSessions.length + ' / 5' + (rem > 0 ? ' \u2014 ' + rem + ' more to unlock your weekly summary' : ' \u2014 Ready to generate!');
      if (progressFill) progressFill.style.width = pct + '%';
    }
  }

  /* ── render session list ── */
  function dbRenderSessions() {
    const list = document.getElementById('db-session-list');
    if (dbSessions.length === 0) {
      list.innerHTML = '<div class="db-empty"><div class="db-empty-icon">\ud83d\udccb</div><div class="db-empty-text">No sessions logged yet.<br>Fill the form and tap <strong>Add Session</strong>.</div></div>';
      return;
    }
    list.innerHTML = dbSessions.map((s, i) => {
      const pct = Math.round((s.shots_made / s.shots_attempted) * 100);
      const bc  = pct >= 65 ? '#56d364' : pct >= 50 ? '#f5a623' : '#f85149';
      return `
        <div class="db-session-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
            <div class="db-session-day">${sanitize(s.day)}</div>
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

  /* ── add session (with validation + DB save) ── */
  async function dbAddSession() {
    const sm  = parseFloat(document.getElementById('db-shots-made').value);
    const sa  = parseFloat(document.getElementById('db-shots-att').value);
    const dr  = parseFloat(document.getElementById('db-dribbling').value);
    const ve  = parseFloat(document.getElementById('db-vertical').value);
    const sp  = parseFloat(document.getElementById('db-sprint').value);
    const err = document.getElementById('db-error');

    err.style.display = 'none';

    // Validation
    if (isNaN(sm) || isNaN(sa) || isNaN(dr) || isNaN(ve) || isNaN(sp)) {
      err.textContent = '\u26a0 Fill in all 5 performance fields.'; err.style.display = 'block'; return;
    }
    if (sm < 0 || sa < 0 || dr < 0 || ve < 0 || sp < 0) {
      err.textContent = '\u26a0 Values cannot be negative.'; err.style.display = 'block'; return;
    }
    if (sm > sa) {
      err.textContent = '\u26a0 Shots made can\u2019t exceed shots attempted.'; err.style.display = 'block'; return;
    }
    if (sa > 500) {
      err.textContent = '\u26a0 Shots attempted seems too high (max 500).'; err.style.display = 'block'; return;
    }
    if (dr > 480) {
      err.textContent = '\u26a0 Dribbling minutes seems too high (max 480).'; err.style.display = 'block'; return;
    }
    if (ve > 60 || ve < 3) {
      err.textContent = '\u26a0 Vertical should be between 3 and 60 inches.'; err.style.display = 'block'; return;
    }
    if (sp > 15 || sp < 1) {
      err.textContent = '\u26a0 Sprint time should be between 1.0 and 15.0 seconds.'; err.style.display = 'block'; return;
    }

    const notes = clampLength(document.getElementById('db-notes').value || '', 500);
    const day = DB_DAYS[dbSessions.length] || ('Day ' + (dbSessions.length + 1));

    const sessionData = {
      day, shots_made: sm, shots_attempted: sa,
      dribbling_min: dr, vertical_in: ve, sprint_sec: sp,
      notes,
    };

    // Save to Supabase
    try {
      await DataService.addSession(currentWeekId, sessionData);
    } catch (e) {
      err.textContent = '\u26a0 Failed to save session. Please try again.';
      err.style.display = 'block';
      console.error(e);
      return;
    }

    dbSessions.push(sessionData);

    // clear form
    ['db-shots-made','db-shots-att','db-dribbling','db-vertical','db-sprint','db-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    dbUpdateLabels();
    dbRenderSessions();
    if (typeof SFX !== 'undefined') SFX.success();
    showToast('Session logged for ' + day + '!');
  }

  /* ── chart helpers ── */
  const DB_CHART_DEFAULTS = {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 800, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(24,28,38,0.95)', borderColor: 'rgba(245,166,35,0.15)',
        borderWidth: 1, titleColor: 'rgba(240,237,230,0.5)', bodyColor: '#f0ede6',
        padding: 12, cornerRadius: 8, displayColors: false,
        titleFont: { size: 10, family: "'Space Grotesk', sans-serif", weight: 600 },
        bodyFont: { size: 14, family: "'Space Grotesk', sans-serif", weight: 700 },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, ticks: { color: 'rgba(240,237,230,0.4)', font: { size: 11, family: "'Space Grotesk', sans-serif" } }, border: { display: false } },
      y: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, ticks: { color: 'rgba(240,237,230,0.4)', font: { size: 11, family: "'Space Grotesk', sans-serif" } }, border: { display: false } },
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
    const prev = dbPrevStats();
    const weekLabel = result.week || ('Week ' + dbWeekNum());

    document.getElementById('db-summary-empty').style.display   = 'none';
    document.getElementById('db-summary-content').style.display = 'block';

    // tag + trend badge
    document.getElementById('db-fb-tag').textContent = 'AI Coach \u00b7 ' + weekLabel;
    document.getElementById('db-kpi-title').textContent = weekLabel + ' \u2014 Averages';
    document.getElementById('db-json-filename').textContent = weekLabel.toLowerCase().replace(/\s/g, '_') + '_performance.json';

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
    document.getElementById('db-strengths').innerHTML = result.feedback.strengths.map(s => `<div class="db-feedback-item">\u00b7 ${sanitize(s)}</div>`).join('');
    document.getElementById('db-focus').innerHTML     = result.feedback.focus_areas.map(f => `<div class="db-feedback-item">\u00b7 ${sanitize(f)}</div>`).join('');
    document.getElementById('db-drill').textContent   = result.feedback.drill_recommendation;
    document.getElementById('db-coach-note').textContent = '\u201c' + result.feedback.coach_note + '\u201d';

    // KPIs
    const avg = result.weekly_summary.averages;
    function setKPI(valId, deltaId, curr, prevVal, lowerBetter) {
      document.getElementById(valId).childNodes[0].textContent = curr;
      if (prev && prevVal !== undefined) {
        const d = dbPctChange(curr, prevVal);
        const pos = lowerBetter ? d <= 0 : d >= 0;
        const el = document.getElementById(deltaId);
        el.textContent = (pos ? '\u25b2 ' : '\u25bc ') + Math.abs(d) + '% vs prev week';
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

    // Build display list: completed weeks + current in-progress week
    const allWeeks = [...dbWeeks];
    if (dbSessions.length > 0) {
      allWeeks.push({
        id: currentWeekId,
        week: 'Week ' + currentWeekNum,
        label: 'W' + currentWeekNum,
        days: dbSessions,
        summary_json: null,
        _inProgress: true,
      });
    }

    const totalCount = allWeeks.length;
    document.getElementById('db-history-count').textContent = totalCount + ' week' + (totalCount !== 1 ? 's' : '') + ' tracked';
    if (totalCount === 0) {
      list.innerHTML = '<div class="db-empty"><div class="db-empty-icon">\ud83d\udcc5</div><div class="db-empty-text">No history yet.<br><button class="db-generate-btn" style="width:auto;padding:10px 24px;margin-top:12px;font-size:13px;" onclick="dbSwitchTabById(\'log\')">Log Your First Session \u2192</button></div></div>';
      return;
    }
    list.innerHTML = [...allWeeks].reverse().map((w, i) => {
      const s = dbWeekStats(w);
      const isLatest = i === 0 && dbResult;
      const isInProgress = w._inProgress;
      return `
        <div class="db-history-card" style="${isLatest ? 'border-color:rgba(245,166,35,0.28)' : isInProgress ? 'border-color:rgba(76,163,255,0.28)' : ''}">
          <div class="db-history-header" style="${isLatest ? 'background:linear-gradient(135deg,rgba(245,166,35,0.07) 0%,transparent 60%)' : isInProgress ? 'background:linear-gradient(135deg,rgba(76,163,255,0.07) 0%,transparent 60%)' : ''}">
            <div class="db-history-week" style="color:${isLatest ? '#f5a623' : isInProgress ? '#4ca3ff' : 'var(--c-white)'}">${sanitize(w.week)}${isLatest ? ' <span style="font-size:13px;font-weight:400;">\u00b7 Latest</span>' : isInProgress ? ' <span style="font-size:13px;font-weight:400;">\u00b7 In Progress</span>' : ''}</div>
            <div style="font-size:11px;color:var(--c-dimmer)">${w.days.length} session${w.days.length !== 1 ? 's' : ''}</div>
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
    btn.textContent = '\u2713 Copied!';
    btn.style.color  = '#56d364';
    setTimeout(() => { btn.textContent = 'Copy JSON'; btn.style.color = ''; }, 2000);
  }

  /* ── helper: get auth header for API calls ── */
  async function getAuthHeaders() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return {}; }
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token,
    };
  }

  /* ══════════════════════════════════════════════════════════════
     GENERATE via Anthropic API (with error handling + DB save)
  ══════════════════════════════════════════════════════════════ */
  async function dbGenerate() {
    if (dbSessions.length < 2) return;
    if (dbLoading) return;
    dbLoading = true;

    const btn = document.getElementById('db-gen-btn');
    btn.textContent = '\u2699\ufe0f Analyzing with AI\u2026';
    btn.disabled = true;

    const wn   = dbWeekNum();
    const prev = dbPrevStats();
    const player   = document.getElementById('db-player').value || 'Athlete';
    const position = document.getElementById('db-position').value || 'Point Guard';

    const prompt = `You are an elite basketball performance analytics AI for CourtIQ.

Player: ${sanitize(player)} | Position: ${sanitize(position)} | Analyzing: Week ${wn}

Week ${wn} sessions (${dbSessions.length} days):
${JSON.stringify(dbSessions, null, 2)}

Previous weeks stats:
${JSON.stringify(dbWeeks.map(w => ({ week: w.week, stats: dbWeekStats(w) })), null, 2)}

Return ONLY valid JSON with this exact schema \u2014 no markdown, no extra text:
{
  "player": "${sanitize(player)}",
  "position": "${sanitize(position)}",
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
      const headers = await getAuthHeaders();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errBody = await res.text();
        throw { status: res.status, message: errBody };
      }

      const data = await res.json();
      if (data.error) throw { message: data.error.message || 'AI service error' };

      const text = (data.content || []).map(b => b.text || '').join('');
      const result = JSON.parse(text.replace(/```json|```/g, '').trim());

      dbResult = result;

      // Save summary to DB
      try {
        await DataService.saveWeekSummary(currentWeekId, result);
      } catch (saveErr) {
        console.error('Failed to save summary to DB:', saveErr);
      }

      // Move current week to completed list
      dbWeeks = [...dbWeeks, { id: currentWeekId, week: 'Week ' + wn, label: 'W' + wn, days: dbSessions, summary_json: result }];
      dbSessions = [];

      // Create next week
      currentWeekNum = wn + 1;
      try {
        const newWeek = await DataService.createWeek(currentWeekNum, 'W' + currentWeekNum);
        currentWeekId = newWeek.id;
      } catch (weekErr) {
        console.error('Failed to create next week:', weekErr);
      }

      dbUpdateLabels();
      dbRenderSessions();
      dbRenderSummary(result);

      // switch to summary
      dbSwitchTabById('summary');
      document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch(e) {
      const err = document.getElementById('db-error');
      if (e.name === 'AbortError') {
        err.textContent = '\u26a0 Request timed out. Please try again.';
      } else if (!navigator.onLine) {
        err.textContent = '\u26a0 You appear to be offline. Check your connection.';
      } else if (e.status === 401) {
        err.textContent = '\u26a0 Session expired. Please sign in again.';
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);
      } else if (e.status === 429) {
        err.textContent = '\u26a0 Too many requests. Please wait a moment and try again.';
      } else {
        err.textContent = '\u26a0 AI analysis failed \u2014 check your connection and try again.';
      }
      err.style.display = 'block';
      console.error(e);
    } finally {
      dbLoading = false;
      btn.textContent = '\ud83e\udd16 Generate AI Summary \u2192';
      btn.disabled = dbSessions.length < 2;
      if (dbSessions.length < 2) { btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed'; }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     NOTIFICATIONS TAB
  ══════════════════════════════════════════════════════════════ */

  let notifResult = null;
  let notifLoading = false;

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

Name: ${sanitize(name)}
Goal: ${goal}
Channel: ${channel}
Week: Week ${dbWeeks.length + 1}

Training schedule:
${JSON.stringify(weekDays, null, 2)}

Return ONLY a valid JSON array \u2014 no markdown, no extra text. Each element must have:
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
    "body": "Full email body \u2014 3-4 sentences. Mention name, specific exercises, the goal (${goal}), and a motivational close."
  },
  "motivation_quote": "One short punchy motivational line (max 12 words)"
}`;
  }

  async function notifGenerate() {
    if (notifLoading) return;
    notifLoading = true;

    const name    = clampLength(document.getElementById('notif-name').value.trim() || 'Athlete', 50);
    const goal    = document.getElementById('notif-goal').value;
    const channel = document.getElementById('notif-channel').value;

    const btn = document.getElementById('notif-gen-btn');
    btn.textContent = '\u2699\ufe0f Generating\u2026';
    btn.disabled = true;

    document.getElementById('notif-empty').style.display    = 'none';
    document.getElementById('notif-results').style.display  = 'none';
    document.getElementById('notif-loading').style.display  = 'block';
    document.getElementById('notif-error').style.display    = 'none';

    const userPrompt = notifBuildUserPrompt(name, goal, channel);
    const fullPrompt = NOTIF_SYSTEM_PROMPT + '\n\n---\n\n' + userPrompt;

    try {
      const headers = await getAuthHeaders();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('https://txnsuzlgfafjdipfqkqe.supabase.co/functions/v1/claude-proxy', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: NOTIF_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errBody = await res.text();
        throw { status: res.status, message: errBody };
      }

      const data   = await res.json();
      if (data.error) throw { message: data.error.message || 'AI service error' };

      const text   = (data.content || []).map(b => b.text || '').join('');
      const clean  = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);

      notifResult = result;

      document.getElementById('notif-loading').style.display  = 'none';
      document.getElementById('notif-results').style.display  = 'block';
      document.getElementById('notif-prompt-box').textContent = fullPrompt;
      document.getElementById('notif-week-label').textContent = `Week ${dbWeeks.length + 1} \u2014 Notification Schedule`;
      document.getElementById('notif-json-body').textContent  = JSON.stringify(result, null, 2);

      notifRenderCards(result, channel);

    } catch(e) {
      document.getElementById('notif-loading').style.display = 'none';
      document.getElementById('notif-empty').style.display   = 'block';
      const errEl = document.getElementById('notif-error');
      if (e.name === 'AbortError') {
        errEl.textContent = '\u26a0 Request timed out. Please try again.';
      } else if (!navigator.onLine) {
        errEl.textContent = '\u26a0 You appear to be offline. Check your connection.';
      } else if (e.status === 401) {
        errEl.textContent = '\u26a0 Session expired. Please sign in again.';
      } else {
        errEl.textContent = '\u26a0 Failed to generate notifications. Check your connection and try again.';
      }
      errEl.style.display = 'block';
      console.error(e);
    } finally {
      notifLoading = false;
      btn.textContent = '\ud83d\udd14 Regenerate';
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
              <div class="notif-day-name">${sanitize(d.day)}</div>
              <div class="notif-day-date">${sanitize(d.date || '')}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-left:12px;">
              <span style="font-size:10px;font-weight:700;letter-spacing:0.1em;padding:3px 9px;border-radius:100px;background:rgba(${ic==='#f85149'?'248,81,73':ic==='#f5a623'?'245,166,35':'86,211,100'},0.1);color:${ic};border:1px solid rgba(${ic==='#f85149'?'248,81,73':ic==='#f5a623'?'245,166,35':'86,211,100'},0.25);">${sanitize(d.intensity)}</span>
            </div>
            <div class="notif-channels">
              ${showPush  ? '<span class="notif-chip push">\ud83d\udcf1 Push</span>'  : ''}
              ${showEmail ? '<span class="notif-chip email">\u2709 Email</span>' : ''}
            </div>
          </div>

          <div class="notif-card-body">

            <div>
              <div class="notif-message-label">\ud83c\udfc0 Exercises</div>
              <div class="notif-exercises">
                ${(d.exercises || []).map(ex => `<span class="notif-ex-tag">${sanitize(ex)}</span>`).join('')}
              </div>
            </div>

            ${showPush && d.push_notification ? `
            <div class="notif-message-block">
              <div class="notif-message-label">\ud83d\udcf1 Push Notification</div>
              <div class="notif-push-bubble">
                <div class="notif-push-title">${sanitize(d.push_notification.title || '')}</div>
                <div class="notif-push-body">${sanitize(d.push_notification.body || '')}</div>
              </div>
            </div>` : ''}

            ${showEmail && d.email ? `
            <div class="notif-message-block">
              <div class="notif-message-label">\u2709 Email</div>
              <div class="notif-email-block">
                <div class="notif-email-subject">Subject: ${sanitize(d.email.subject || '')}</div>
                ${d.email.preview_text ? `<div style="font-size:11px;color:var(--c-dimmer);margin-bottom:8px;font-style:italic;">Preview: ${sanitize(d.email.preview_text)}</div>` : ''}
                <div class="notif-email-preview">${sanitize(d.email.body || '')}</div>
              </div>
            </div>` : ''}

            ${d.motivation_quote ? `
            <div class="notif-motivation">\u201c${sanitize(d.motivation_quote)}\u201d</div>` : ''}

          </div>
        </div>`;
    }).join('');
  }

  function notifTogglePrompt() {
    const box   = document.getElementById('notif-prompt-box');
    const arrow = document.getElementById('notif-prompt-arrow');
    const open  = box.style.display === 'block';
    box.style.display  = open ? 'none' : 'block';
    arrow.textContent  = open ? '\u25bc' : '\u25b2';
  }

  function notifCopyJSON() {
    if (!notifResult) return;
    const text = JSON.stringify(notifResult, null, 2);
    if (navigator.clipboard) navigator.clipboard.writeText(text);
    const btn = document.querySelector('#db-panel-notifications .db-copy-btn');
    if (!btn) return;
    btn.textContent = '\u2713 Copied!';
    btn.style.color  = '#56d364';
    setTimeout(() => { btn.textContent = 'Copy JSON'; btn.style.color = ''; }, 2000);
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
     SIDEBAR NAVIGATION
  ══════════════════════════════════════════════════════════════ */
  (function initSidebar() {
    // Sidebar nav click handlers
    document.querySelectorAll('.db-sidebar-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        dbSwitchTab(tab, btn);
      });
    });

    // Collapse toggle (desktop)
    const collapseBtn = document.getElementById('db-sidebar-toggle');
    const sidebar = document.getElementById('db-sidebar');
    if (collapseBtn && sidebar) {
      collapseBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        // Store preference
        localStorage.setItem('courtiq-sidebar-collapsed', sidebar.classList.contains('collapsed'));
      });
      // Restore preference
      if (localStorage.getItem('courtiq-sidebar-collapsed') === 'true') {
        sidebar.classList.add('collapsed');
      }
    }

    // Mobile toggle
    const mobileToggle = document.getElementById('db-sidebar-mobile-toggle');
    const overlay = document.getElementById('db-sidebar-overlay');
    if (mobileToggle && sidebar) {
      mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        if (overlay) overlay.classList.toggle('visible');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('mobile-open');
        overlay.classList.remove('visible');
      });
    }
  })();

  /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
