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

    // ── Kinetic Stitch UI — populate live user data ──────────────────────
    (function ksPopulateUser() {
      const u = session.user;
      const firstName  = u.user_metadata?.first_name || '';
      const lastName   = u.user_metadata?.last_name  || '';
      const email      = u.email || '';
      const fullName   = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0] || 'Player';
      const displayName = firstName || fullName;

      // Hero title (Home panel)
      const heroName = document.getElementById('ke-player-name');
      if (heroName) heroName.textContent = displayName;

      // Profile panel full name
      const profileName = document.getElementById('ks-profile-full-name');
      if (profileName) profileName.textContent = fullName;

      // Settings email
      const profileEmail = document.getElementById('ks-profile-email');
      if (profileEmail) profileEmail.textContent = email || '—';

      // Header avatar: replace AI image with initials if no real avatar
      const avatarWrap = document.getElementById('ks-header-avatar');
      const avatarImg  = document.getElementById('ks-header-avatar-img');
      if (avatarWrap && avatarImg) {
        const initials = fullName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?';
        // Use Google avatar URL if available, else show initials circle
        const googlePic = u.user_metadata?.avatar_url || u.user_metadata?.picture || '';
        if (googlePic) {
          avatarImg.src = googlePic;
        } else {
          avatarImg.style.display = 'none';
          const span = document.createElement('span');
          span.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-family:var(--ks-font-headline);font-size:14px;font-weight:700;color:#fff;letter-spacing:0.05em';
          span.textContent = initials;
          avatarWrap.appendChild(span);
        }
      }
    })();

    // Update sidebar user info
    const sidebarName = document.getElementById('db-sidebar-name');
    const sidebarAvatar = document.getElementById('db-sidebar-avatar');
    if (sidebarName) {
      const name = session.user.user_metadata?.first_name || session.user.email;
      sidebarName.textContent = name;

      // Render 2D Memoji-style mini avatar in sidebar
      if (sidebarAvatar) {
        try {
          var obSidebar = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
          if (obSidebar.avatar && typeof AvatarBuilder !== 'undefined') {
            sidebarAvatar.innerHTML = '';
            var miniC = document.createElement('canvas');
            miniC.width = 48; miniC.height = 48;
            miniC.style.width = '100%'; miniC.style.height = '100%';
            miniC.style.borderRadius = '50%';
            sidebarAvatar.appendChild(miniC);
            AvatarBuilder.drawMini(miniC, obSidebar.avatar);
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
    try { await initDashboard(); } catch(e) { /* silently continue */ }

    // Always populate home panel widgets (runs even if initDashboard threw or returned early)
    setTimeout(function() {
      if (typeof ksUpdateHomePanel === 'function') ksUpdateHomePanel();
    }, 200);
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
            // Seed the saveUserData merge cache from the full cloud blob.
            // Without this, the first saveUserData() on a restored device starts
            // from {} and wipes all other user_data keys.
            try { localStorage.setItem('_sb_user_data_cache', JSON.stringify(userData)); } catch(e) {}

            // XP — always sync from cloud (cloud accumulates across all devices)
            if (userData.xp_data) {
              localStorage.setItem('courtiq-xp', JSON.stringify(userData.xp_data));
              if (typeof XPSystem !== 'undefined' && XPSystem.render) XPSystem.render();
            }
            // Onboarding — always sync from cloud (cloud is source of truth on login)
            if (userData.onboarding_data) {
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

            // ── Always sync avatar from cloud → works on ALL devices ──
            // Catches avatar customizations made on any other device
            if (userData.avatar) {
              try {
                const localOb = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
                if (JSON.stringify(localOb.avatar) !== JSON.stringify(userData.avatar)) {
                  localOb.avatar = userData.avatar;
                  localStorage.setItem('courtiq-onboarding-data', JSON.stringify(localOb));
                }
              } catch (e) { /* silent */ }
            }

            // ── Always sync player profile from cloud ──
            if (userData.player_profile) {
              try {
                localStorage.setItem('courtiq-player-profile', JSON.stringify(userData.player_profile));
              } catch (e) { /* silent */ }
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

      // Hide context row by default (only shows on log tab)
      var contextRow = document.getElementById('db-context-row');
      if (contextRow) contextRow.style.display = 'none';

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

        // Update compact topbar profile name
        const topbarName = document.getElementById('db-topbar-profile-name');
        if (topbarName && profile.first_name) topbarName.textContent = profile.first_name;
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

    // Populate new home panel widgets
    ksUpdateHomePanel();
  }

  /* ── Home panel: populate new ks-* widgets ── */
  function ksUpdateHomePanel() {

    // ── Streak & sessions count ──────────────────────────────────────────
    const streakEl   = document.getElementById('ks-home-streak');
    const sessionsEl = document.getElementById('ks-home-sessions');
    if (streakEl) {
      const streakOld = document.getElementById('db-stat-streak');
      streakEl.textContent = (streakOld && streakOld.textContent) ? streakOld.textContent : '0';
    }
    if (sessionsEl) {
      let total = dbSessions.length;
      for (const w of dbWeeks) { total += (w.days || []).length; }
      sessionsEl.textContent = String(total);
    }

    // ── Skill bars from onboarding data ──────────────────────────────────
    try {
      const ob = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}');
      const skills = ob.skills || {};
      const toBarPct = function(v) { return Math.round(((Number(v) || 5) / 10) * 100); };
      const skillMap = [
        { key: 'shooting',  scoreId: 'ks-sb-shooting',  barId: 'ks-sb-shooting-bar'  },
        { key: 'dribbling', scoreId: 'ks-sb-dribbling', barId: 'ks-sb-dribbling-bar' },
        { key: 'defense',   scoreId: 'ks-sb-defense',   barId: 'ks-sb-defense-bar'   },
        { key: 'gameiq',    scoreId: 'ks-sb-gameiq',    barId: 'ks-sb-gameiq-bar'    },
      ];
      skillMap.forEach(function(item) {
        var raw = skills[item.key] || skills['game_iq'] || 5;
        var val = Math.min(10, Math.max(0, Number(raw)));
        var pct = toBarPct(val);
        var scoreEl = document.getElementById(item.scoreId);
        var barEl   = document.getElementById(item.barId);
        if (scoreEl) scoreEl.textContent = val + '/10';
        if (barEl) requestAnimationFrame(function() { barEl.style.width = pct + '%'; });
      });
    } catch (e) { /* no onboarding data yet */ }

    // ── Game Log (DOM-safe, no innerHTML) ────────────────────────────────
    var logList = document.getElementById('ks-game-log-list');
    if (logList) {
      var allSess = [];
      dbSessions.forEach(function(s) { allSess.push({ s: s, weekLabel: 'This Week' }); });
      if (dbWeeks.length > 0) {
        (dbWeeks[dbWeeks.length - 1].days || []).forEach(function(s) {
          allSess.push({ s: s, weekLabel: 'Last Week' });
        });
      }

      while (logList.firstChild) logList.removeChild(logList.firstChild);

      if (allSess.length === 0) {
        var emptyEl = document.createElement('div');
        emptyEl.className = 'ks-game-log-empty';
        emptyEl.textContent = 'Log a session to see your game history';
        logList.appendChild(emptyEl);
      } else {
        var recent = allSess.slice(-5).reverse();
        recent.forEach(function(entry) {
          var s    = entry.s;
          var made = Number(s.shots_made) || 0;
          var att  = Number(s.shots_attempted) || 0;
          var pct  = att > 0 ? Math.round((made / att) * 100) : 0;
          var grade = 'C', gradeClass = 'ks-game-log-grade--c', itemClass = 'ks-game-log-item--avg';
          if (pct >= 60 || made >= 30)     { grade = 'A'; gradeClass = 'ks-game-log-grade--a'; itemClass = 'ks-game-log-item--great'; }
          else if (pct >= 40 || made >= 15){ grade = 'B'; gradeClass = 'ks-game-log-grade--b'; itemClass = 'ks-game-log-item--good'; }

          var row = document.createElement('div');
          row.className = 'ks-game-log-item ' + itemClass;
          row.style.cursor = 'pointer';
          row.addEventListener('click', function() { dbSwitchTab('history'); });

          var daySpan = document.createElement('span');
          daySpan.className = 'ks-game-log-day';
          daySpan.textContent = String(s.day || 'Day').slice(0, 3);

          var infoDiv = document.createElement('div');
          infoDiv.className = 'ks-game-log-info';

          var titleDiv = document.createElement('div');
          titleDiv.className = 'ks-game-log-title';
          titleDiv.textContent = 'Training Session \u2014 ' + entry.weekLabel;

          var subDiv = document.createElement('div');
          subDiv.className = 'ks-game-log-sub';
          if (att > 0) {
            subDiv.textContent = made + '/' + att + ' shots \u2022 ' + pct + '%';
          } else if (s.dribbling_min) {
            subDiv.textContent = s.dribbling_min + ' min dribbling';
          } else {
            subDiv.textContent = 'Training session';
          }

          infoDiv.appendChild(titleDiv);
          infoDiv.appendChild(subDiv);

          var gradeSpan = document.createElement('span');
          gradeSpan.className = 'ks-game-log-grade ' + gradeClass;
          gradeSpan.textContent = grade;

          row.appendChild(daySpan);
          row.appendChild(infoDiv);
          row.appendChild(gradeSpan);
          logList.appendChild(row);
        });
      }
    }

    // ── Personal Bests ────────────────────────────────────────────────────
    var allData = [].concat(dbSessions);
    dbWeeks.forEach(function(w) { allData = allData.concat(w.days || []); });

    if (allData.length > 0) {
      var pbShots    = Math.max.apply(null, allData.map(function(s) { return Number(s.shots_made) || 0; }));
      var pbVertical = Math.max.apply(null, allData.map(function(s) { return Number(s.vertical_in) || 0; }));
      var sprintVals = allData.filter(function(s) { return Number(s.sprint_sec) > 0; }).map(function(s) { return Number(s.sprint_sec); });
      var pbSprint   = sprintVals.length > 0 ? Math.min.apply(null, sprintVals) : 0;

      var shotsEl  = document.getElementById('ks-pb-shots');
      var vertEl   = document.getElementById('ks-pb-vertical');
      var sprintEl = document.getElementById('ks-pb-sprint');

      if (shotsEl  && pbShots > 0)    shotsEl.textContent  = pbShots + ' shots';
      if (vertEl   && pbVertical > 0) vertEl.textContent   = pbVertical + '"';
      if (sprintEl && pbSprint > 0)   sprintEl.textContent = pbSprint + 's';
    }

    // ── Bento stats: live data override ──────────────────────────────────
    if (dbSessions.length > 0) {
      var curr = dbWeekStats({ days: dbSessions });
      var bentoCards = document.querySelectorAll('.ks-bento-grid .ks-stat-card--tall');
      if (bentoCards[0] && curr.shooting_pct > 0) {
        var numEl0 = bentoCards[0].querySelector('.ks-stat-number');
        var barEl0 = bentoCards[0].querySelector('.ks-progress-fill');
        if (numEl0) numEl0.textContent = curr.shooting_pct.toFixed(1);
        if (barEl0) barEl0.style.width = curr.shooting_pct + '%';
      }
      if (bentoCards[1] && curr.vertical_in > 0) {
        var numEl1 = bentoCards[1].querySelector('.ks-stat-number');
        if (numEl1) numEl1.textContent = curr.vertical_in + '"';
      }
      if (bentoCards[2] && curr.dribbling_min > 0) {
        var numEl2 = bentoCards[2].querySelector('.ks-stat-number');
        if (numEl2) numEl2.textContent = (curr.dribbling_min / 60).toFixed(1) + 'h';
      }
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

    // Sync Kinetic Elite bottom nav active state
    document.querySelectorAll('.ke-nav-item').forEach(function(navBtn) {
      navBtn.classList.toggle('active', navBtn.getAttribute('data-tab') === id);
    });

    // Toggle panels
    document.querySelectorAll('.db-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('db-panel-' + id);
    if (panel) {
      panel.classList.add('active');
      // Restart ks-reveal-up animations (CSS animations don't fire on hidden panels)
      setTimeout(() => {
        panel.querySelectorAll('.ks-reveal-up').forEach(el => {
          el.style.animationName = 'none';
          void el.offsetHeight; // force reflow
          el.style.animationName = '';
        });
      }, 16);
    }

    // Update breadcrumb
    // Show/hide context row (only for log panel)
    var contextRow = document.getElementById('db-context-row');
    if (contextRow) contextRow.style.display = (id === 'log') ? '' : 'none';

    var breadcrumbNames = {
      home: 'Home', log: 'Log Session', history: 'History', calendar: 'Calendar',
      drills: 'Drills', workouts: 'Workouts', moves: 'Move Library',
      progress: 'Progress', profile: 'Profile', archetype: 'Archetype',
      shop: 'Avatar Shop', 'daily-challenge': 'Daily Challenge',
      summary: 'Weekly Summary', coach: 'AI Coach', notifications: 'Notifications',
      shots: 'Shot Tracker', social: 'Social Hub'
    };
    var bcEl = document.getElementById('db-breadcrumb-current');
    if (bcEl) bcEl.textContent = breadcrumbNames[id] || id;

    // GSAP tab animation (graceful fallback)
    if (panel && window.CourtIQAnimations && CourtIQAnimations.tabIn) {
      CourtIQAnimations.tabIn(panel);
    }

    // Panel-specific init calls
    if (id === 'history') dbRenderHistory();
    if (id === 'calendar' && typeof calSetSource === 'function') {
      // Auto-pick best source: prefer coach if output exists, fall back to log if sessions exist
      var bestSrc = typeof calSource !== 'undefined' ? calSource : 'coach';
      var hasCoachResult = typeof coachResult !== 'undefined' && coachResult !== null;
      if (bestSrc === 'coach' && !hasCoachResult && dbSessions.length > 0) bestSrc = 'log';
      var calSrcBtn = document.getElementById('cal-src-' + bestSrc);
      calSetSource(bestSrc, calSrcBtn);
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
        if (shopContainer && typeof AvatarBuilder !== 'undefined' && obData.avatar) {
          shopContainer.innerHTML = '';
          var sc = document.createElement('canvas');
          sc.width = 200; sc.height = 280;
          sc.style.width = '100%'; sc.style.height = '100%';
          shopContainer.appendChild(sc);
          AvatarBuilder.draw(sc, Object.assign({}, obData.avatar, { position: obData.position || 'SG' }));
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

    // Award XP for logging a session
    var xpEarned = 25;
    if (typeof XPSystem !== 'undefined' && XPSystem.addXP) {
      try { XPSystem.addXP(xpEarned, 'Session logged'); } catch(e) {}
    }

    // Sync updated XP to cloud (non-blocking, fire-and-forget)
    if (window.currentUser && typeof DataService !== 'undefined') {
      try {
        var xpData = JSON.parse(localStorage.getItem('courtiq-xp') || '{}');
        DataService.saveUserData({ xp_data: xpData }).catch(function() {});
      } catch(e) {}
    }

    showToast('Session logged for ' + day + '! +' + xpEarned + ' XP');
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
      const hasSummary = !!w.summary_json;
      const clickAttr = hasSummary ? ` onclick="dbLoadWeekSummary('${sanitize(String(w.id))}')" style="cursor:pointer"` : '';
      return `
        <div class="db-history-card"${clickAttr} style="${isLatest ? 'border-color:rgba(245,166,35,0.28)' : isInProgress ? 'border-color:rgba(76,163,255,0.28)' : ''}">
          <div class="db-history-header" style="${isLatest ? 'background:linear-gradient(135deg,rgba(245,166,35,0.07) 0%,transparent 60%)' : isInProgress ? 'background:linear-gradient(135deg,rgba(76,163,255,0.07) 0%,transparent 60%)' : ''}">
            <div class="db-history-week" style="color:${isLatest ? '#f5a623' : isInProgress ? '#4ca3ff' : 'var(--c-white)'}">${sanitize(w.week)}${isLatest ? ' <span style="font-size:13px;font-weight:400;">\u00b7 Latest</span>' : isInProgress ? ' <span style="font-size:13px;font-weight:400;">\u00b7 In Progress</span>' : ''}</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="font-size:11px;color:var(--c-dimmer)">${w.days.length} session${w.days.length !== 1 ? 's' : ''}</div>
              ${hasSummary ? '<span style="font-size:11px;font-weight:700;color:#f5a623;letter-spacing:0.05em;">View Summary \u2192</span>' : ''}
            </div>
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

  /* ── load a past week's summary from history card click ── */
  function dbLoadWeekSummary(weekId) {
    const week = dbWeeks.find(w => String(w.id) === String(weekId));
    if (!week || !week.summary_json) return;
    dbResult = week.summary_json;
    dbRenderSummary(dbResult);
    dbSwitchTab('summary');
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

  /* ══════════════════════════════════════════════════════════════════
     FLOATING BOTTOM NAV (5 Main Tabs)
  ══════════════════════════════════════════════════════════════════ */
  (function initGlassNav() {
    // Map main tab -> default sub-panel + sub-nav group
    var mainTabMap = {
      home:    { panel: 'home',      subNav: null },
      train:   { panel: 'log',       subNav: 'glass-sub-nav-train' },
      stats:   { panel: 'summary',   subNav: 'glass-sub-nav-stats' },
      coach:   { panel: 'coach',     subNav: 'glass-sub-nav-coach' },
      profile: { panel: 'archetype', subNav: 'glass-sub-nav-profile' }
    };

    var currentMainTab = 'home';

    function switchMainTab(tabId) {
      currentMainTab = tabId;
      var config = mainTabMap[tabId];
      if (!config) return;

      // Update active state on bottom nav
      document.querySelectorAll('.glass-nav-tab').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.mainTab === tabId);
      });

      // Hide all sub-navs
      document.querySelectorAll('.glass-sub-nav').forEach(function(nav) {
        nav.style.display = 'none';
      });

      // Show relevant sub-nav and reset its active state
      if (config.subNav) {
        var subNav = document.getElementById(config.subNav);
        if (subNav) {
          subNav.style.display = 'flex';
          // Reset sub-nav active to first button
          subNav.querySelectorAll('.glass-sub-nav-btn').forEach(function(b, i) {
            b.classList.toggle('active', i === 0);
          });
        }
      }

      // Show/hide welcome hero + outer elements (only on home)
      var outerEls = document.querySelectorAll('.db-welcome-hero, .db-stats-row, .dc-card, .db-quick-grid, .db-skills-circle-grid, .db-home-stats-row, .db-home-nav-grid, .glass-session-counter, .glass-streak-card, .glass-season-progress, .glass-daily-drills, .glass-recent-sessions, .db-top-widgets, .xp-gain-toast, #streak-toast, .db-donuts-row');
      outerEls.forEach(function(el) {
        el.style.display = (tabId === 'home') ? '' : 'none';
      });

      // Switch to the default sub-panel
      dbSwitchTab(config.panel, null);
    }

    // Bottom nav click handlers
    document.querySelectorAll('.glass-nav-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        switchMainTab(btn.dataset.mainTab);
      });
    });

    // Sub-nav click handlers
    document.querySelectorAll('.glass-sub-nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var parent = btn.parentElement;
        parent.querySelectorAll('.glass-sub-nav-btn').forEach(function(b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        dbSwitchTab(btn.dataset.subTab, null);
      });
    });

    // Initialize: show home
    switchMainTab('home');
  })();

  /* ── Home panel interactive buttons ────────────────────────── */
  (function () {
    function initHomePanelHandlers() {
      /* A) Edit Profile button */
      var editProfileBtn = document.querySelector('#db-panel-home .ks-btn-primary');
      if (editProfileBtn) {
        editProfileBtn.addEventListener('click', function () {
          var modal = document.getElementById('profile-modal-overlay');
          if (modal) modal.classList.add('active');
        });
      }

      /* B) Share button */
      var shareBtn = document.querySelector('#db-panel-home .ks-btn-outline');
      if (shareBtn) {
        shareBtn.addEventListener('click', function () {
          if (navigator.share) {
            navigator.share({
              title: 'CourtIQ',
              text: 'Check out my basketball training profile!',
              url: window.location.href
            });
          } else {
            navigator.clipboard.writeText(window.location.href).then(function () {
              if (typeof showToast === 'function') showToast('Profile link copied!');
            });
          }
        });
      }

      /* C) Info button next to "Start Drill" */
      var infoBtn = document.querySelector('.ks-info-btn');
      if (infoBtn) {
        infoBtn.addEventListener('click', function () {
          if (typeof showToast === 'function') showToast('Daily workout is auto-generated based on your skill profile');
        });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initHomePanelHandlers);
    } else {
      initHomePanelHandlers();
    }
  })();

  /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

  /* ══════════════════════════════════════════════════════════════
     DAILY CHALLENGE SYSTEM — rotates every calendar day
  ══════════════════════════════════════════════════════════════ */
  (function DailyChallengeSystem() {
    var CHALLENGES = [
      { icon:'🎯', title:'Make 25 Mid-Range Shots',         sub:'+40 XP • Shooting Focus',        xp:40, tab:'drills',   filter:'shooting'  },
      { icon:'⚡', title:'Complete 3 Ball Handling Drills', sub:'+30 XP • Unlocks streak bonus',   xp:30, tab:'drills',   filter:'dribbling' },
      { icon:'🏀', title:'Log a Full Shooting Session',     sub:'+50 XP • New Record unlock',      xp:50, tab:'log',      filter:null        },
      { icon:'🔥', title:'5 Defensive Footwork Drills',     sub:'+35 XP • Defense Boost',          xp:35, tab:'drills',   filter:'defense'   },
      { icon:'💪', title:'Vertical Jump Test + 3 Drills',   sub:'+45 XP • Athleticism',            xp:45, tab:'log',      filter:null        },
      { icon:'🏆', title:'Run the Full Weekly Workout',     sub:'+60 XP • Weekly Champion',        xp:60, tab:'workouts', filter:null        },
      { icon:'🎪', title:'3 Court Vision Drills',           sub:'+30 XP • Game IQ Boost',          xp:30, tab:'drills',   filter:'gameiq'    },
      { icon:'🚀', title:'Sprint Drill — Beat Your Time',   sub:'+40 XP • Speed Record',           xp:40, tab:'log',      filter:null        },
      { icon:'🌙', title:'Night Training Session',          sub:'+55 XP • Night Warrior',          xp:55, tab:'home',     filter:'night'     },
      { icon:'🎯', title:'50 Free Throws',                  sub:'+40 XP • Free Throw Pro',         xp:40, tab:'drills',   filter:'shooting'  },
      { icon:'🏃', title:'Agility Ladder — 5 Rounds',       sub:'+35 XP • Agility Boost',          xp:35, tab:'drills',   filter:'defense'   },
      { icon:'🔁', title:'Crossover + Euro-Step Combo',     sub:'+30 XP • Ball Magic',             xp:30, tab:'drills',   filter:'dribbling' },
      { icon:'📊', title:'Log All 5 Stats Today',           sub:'+50 XP • Full Data Day',          xp:50, tab:'log',      filter:null        },
      { icon:'🎪', title:'3-Point Shooting Marathon',       sub:'+45 XP • Perimeter King',         xp:45, tab:'drills',   filter:'shooting'  },
      { icon:'🛡️', title:'On-Ball Defense — 20 Possessions', sub:'+35 XP • Lockdown',             xp:35, tab:'drills',   filter:'defense'   },
      { icon:'🌟', title:'Generate AI Weekly Summary',      sub:'+20 XP • Insight Unlocked',       xp:20, tab:'log',      filter:null        },
      { icon:'🏀', title:'Shoot 30 Catch-and-Shoot Attempts', sub:'+40 XP • Quick Release',       xp:40, tab:'drills',   filter:'shooting'  },
      { icon:'⚡', title:'Full Dribble Workout — 45min',    sub:'+55 XP • Handles Elite',          xp:55, tab:'drills',   filter:'dribbling' },
      { icon:'💡', title:'Study 2 Move Library Breakdowns', sub:'+30 XP • Film Study',             xp:30, tab:'moves',    filter:null        },
      { icon:'🔥', title:'7-Day Streak Challenge',          sub:'+70 XP • Streak Legend',          xp:70, tab:'log',      filter:null        },
    ];

    function getTodayChallenge() {
      return CHALLENGES[Math.floor(Date.now() / 86400000) % CHALLENGES.length];
    }
    function todayKey() {
      var d = new Date();
      return 'ciq-dc-' + d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
    }
    function isDoneToday() { return localStorage.getItem(todayKey()) === '1'; }
    function markDone()    { localStorage.setItem(todayKey(), '1'); }

    function render() {
      var ch = getTodayChallenge(), done = isDoneToday();
      var iconEl  = document.querySelector('.ks-home-challenge-icon');
      var labelEl = document.querySelector('.ks-home-challenge-label');
      var titleEl = document.querySelector('.ks-home-challenge-title');
      var subEl   = document.querySelector('.ks-home-challenge-sub');
      var ctaEl   = document.querySelector('.ks-home-challenge-cta');
      var banner  = document.querySelector('.ks-home-challenge');
      if (!banner) return;
      if (iconEl)  iconEl.textContent  = ch.icon;
      if (titleEl) titleEl.textContent = ch.title;
      if (subEl)   subEl.textContent   = ch.sub;
      if (labelEl) labelEl.textContent = done ? '✅ Completed Today!' : 'Daily Challenge';
      if (done) {
        banner.style.opacity = '0.6';
        if (ctaEl) { ctaEl.textContent = '✓ Done'; ctaEl.disabled = true; }
      } else {
        banner.style.opacity = '';
        if (ctaEl) { ctaEl.textContent = 'Start'; ctaEl.disabled = false; }
      }
      banner.onclick = function() { startChallenge(ch); };
      if (ctaEl) ctaEl.onclick = function(e) { e.stopPropagation(); startChallenge(ch); };
    }

    function startChallenge(ch) {
      if (isDoneToday()) return;
      if (ch.tab === 'home' && ch.filter === 'night') {
        if (typeof NightTraining !== 'undefined') NightTraining.open();
      } else if (typeof dbSwitchTab === 'function') {
        dbSwitchTab(ch.tab);
        if (ch.filter && ch.tab === 'drills') {
          setTimeout(function() {
            if (typeof drillsSetFilter === 'function') drillsSetFilter(ch.filter);
          }, 250);
        }
      }
      markDone();
      if (typeof XPSystem !== 'undefined' && XPSystem.award) XPSystem.award(ch.xp, 'Daily Challenge');
      render();
    }

    function init() { render(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.DailyChallengeSystem = { render: render, startChallenge: startChallenge, getTodayChallenge: getTodayChallenge };
  })();

// ── THE LAB SYSTEM ─────────────────────────────────────────────────────────
(function TheLabSystem() {
  var ARCHETYPE_PRO = {
    scorer: {
      name: 'Kevin Durant', sub: 'Elite Scorer', note: 'That is your benchmark to beat.',
      s1l: 'Points/GM', s1v: '27.2', s2l: 'FG%', s2v: '52.1%'
    },
    playmaker: {
      name: 'Chris Paul', sub: 'Floor General', note: 'Run the game like CP3.',
      s1l: 'Assists/GM', s1v: '8.9', s2l: 'Ball IQ', s2v: '97th %ile'
    },
    defender: {
      name: 'Kawhi Leonard', sub: 'Two-Way Anchor', note: 'Lock down every possession.',
      s1l: 'Def Rating', s1v: '98.4', s2l: 'Steals/GM', s2v: '1.8'
    },
    'two-way': {
      name: 'Jaylen Brown', sub: 'Two-Way Force', note: 'Dominant on both ends.',
      s1l: 'Net Rating', s1v: '+8.2', s2l: 'Efficiency', s2v: '58.3%'
    },
    'rim-runner': {
      name: 'Anthony Davis', sub: 'Interior Beast', note: 'Control the paint.',
      s1l: 'Rebounds/GM', s1v: '12.1', s2l: 'FG% (Paint)', s2v: '68.4%'
    },
    default: {
      name: 'LeBron James', sub: 'All-Around Elite', note: 'The gold standard.',
      s1l: 'Points/GM', s1v: '27.0', s2l: 'Efficiency', s2v: '64.2%'
    }
  };

  function renderStatCards() {
    var sessions = window.dbSessions || [];
    var avgShots = sessions.length
      ? (sessions.reduce(function(a, s) { return a + (s.made || 0); }, 0) / sessions.length).toFixed(1)
      : null;
    var totalMade = sessions.reduce(function(a, s) { return a + (s.made || 0); }, 0);
    var totalAtt  = sessions.reduce(function(a, s) { return a + (s.attempts || 0); }, 0);
    var fgPct = totalAtt > 0 ? ((totalMade / totalAtt) * 100).toFixed(1) + '%' : null;
    var volHrs = sessions.length
      ? ((sessions.reduce(function(a, s) { return a + (s.duration_sec || 0); }, 0) / 3600)).toFixed(1) + 'h'
      : null;
    var bestVert = null;
    sessions.forEach(function(s) {
      if (s.vertical_cm && (!bestVert || s.vertical_cm > bestVert)) bestVert = s.vertical_cm;
    });
    var pts = document.getElementById('lab-stat-pts');
    var fg  = document.getElementById('lab-stat-fg');
    var vol = document.getElementById('lab-stat-vol');
    var vrt = document.getElementById('lab-stat-vert');
    if (pts) pts.textContent = avgShots !== null ? avgShots : '\u2014';
    if (fg)  fg.textContent  = fgPct    !== null ? fgPct    : '\u2014';
    if (vol) vol.textContent = volHrs   !== null ? volHrs   : '\u2014';
    if (vrt) vrt.textContent = bestVert !== null ? bestVert + 'cm' : '\u2014';
    var trends = ['lab-stat-pts-trend','lab-stat-fg-trend','lab-stat-vol-trend','lab-stat-vert-trend'];
    trends.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.textContent = sessions.length ? '' : 'No data yet';
    });
  }

  function renderProCompare() {
    var arch = localStorage.getItem('courtiq-archetype') || 'default';
    var pro  = ARCHETYPE_PRO[arch] || ARCHETYPE_PRO['default'];
    var nameEl = document.getElementById('lab-pro-name');
    var descEl = document.getElementById('lab-pro-desc');
    var s1l    = document.getElementById('lab-pro-stat1-label');
    var s1v    = document.getElementById('lab-pro-stat1-val');
    var s2l    = document.getElementById('lab-pro-stat2-label');
    var s2v    = document.getElementById('lab-pro-stat2-val');
    if (nameEl) nameEl.textContent = pro.name;
    if (descEl) descEl.textContent = pro.sub + ' \u2022 ' + pro.note;
    if (s1l) s1l.textContent = pro.s1l;
    if (s1v) s1v.textContent = pro.s1v;
    if (s2l) s2l.textContent = pro.s2l;
    if (s2v) s2v.textContent = pro.s2v;
  }

  function renderInsights() {
    var sessions = window.dbSessions || [];
    var insights = [];
    if (sessions.length === 0) {
      insights = [
        { icon: '\u26a1', title: 'Start Your First Session', body: 'Complete a drill or shot tracking session to unlock AI insights.' },
        { icon: '\ud83d\udcca', title: 'Track Your Progress', body: 'Your shooting stats, volume, and trends will appear here after sessions.' },
        { icon: '\ud83c\udfaf', title: 'Set a Daily Challenge', body: 'Complete today\'s challenge to start building your performance baseline.' }
      ];
    } else {
      var best = sessions.reduce(function(a, s) { return (s.made || 0) > (a.made || 0) ? s : a; }, sessions[0]);
      var recent = sessions.slice(-5);
      var recentAvg = recent.reduce(function(a, s) { return a + (s.made || 0); }, 0) / recent.length;
      var overallAvg = sessions.reduce(function(a, s) { return a + (s.made || 0); }, 0) / sessions.length;
      var trend = recentAvg > overallAvg ? '\ud83d\udcc8 Improving' : '\ud83d\udcc9 Slipping';
      insights = [
        { icon: '\ud83c\udfc6', title: 'Best Session', body: 'Your peak was ' + (best.made || 0) + ' shots made. Keep chasing that high.' },
        { icon: '\ud83d\udcc8', title: 'Shooting Trend', body: trend + ' \u2014 recent avg ' + recentAvg.toFixed(1) + ' vs overall ' + overallAvg.toFixed(1) + '.' },
        { icon: '\u23f1', title: 'Volume', body: 'You have logged ' + sessions.length + ' sessions. Consistency is your edge.' }
      ];
    }
    insights.forEach(function(ins, i) {
      var n = i + 1;
      var iconEl  = document.getElementById('lab-insight' + n + '-icon');
      var titleEl = document.getElementById('lab-insight' + n + '-title');
      var bodyEl  = document.getElementById('lab-insight' + n + '-body');
      if (iconEl)  iconEl.textContent  = ins.icon;
      if (titleEl) titleEl.textContent = ins.title;
      if (bodyEl)  bodyEl.textContent  = ins.body;
    });
  }

  function clearDemoShotMap() {
    var svg = document.querySelector('.ast-shot-map svg, #ast-shot-svg, .shot-map-svg');
    if (!svg) return;
    svg.querySelectorAll('circle[data-demo], circle.demo-shot').forEach(function(c) { c.remove(); });
    if (svg.querySelectorAll('circle').length === 0) {
      var empty = document.querySelector('.ast-shot-map-empty, .shot-map-empty');
      if (empty) empty.style.display = 'flex';
    }
  }

  function init() {
    renderStatCards();
    renderProCompare();
    renderInsights();
    clearDemoShotMap();
  }

  var _origSwitch = typeof dbSwitchTab === 'function' ? dbSwitchTab : null;
  if (_origSwitch) {
    window.dbSwitchTab = function(tab) {
      _origSwitch(tab);
      if (tab === 'shots') setTimeout(init, 100);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.TheLabSystem = { render: init };
})();

// ── PROFILE SYSTEM ─────────────────────────────────────────────────────────
(function ProfileSystem() {
  var POSITION_MAP = { PG:'Point Guard', SG:'Shooting Guard', SF:'Small Forward', PF:'Power Forward', C:'Center' };
  var ARCH_BIO = {
    scorer:      'An elite scorer with an unstoppable offensive arsenal and a deadly shooting touch.',
    playmaker:   'A floor general who elevates teammates and controls the game with elite vision.',
    defender:    'A lockdown defender anchoring the defensive end with intensity and high IQ.',
    'two-way':   'Dominant on both ends of the floor — a versatile two-way force every team needs.',
    'rim-runner':'An interior beast who controls the paint and changes the game at the rim.'
  };

  function loadXP() {
    try { return JSON.parse(localStorage.getItem('courtiq-xp') || '{}'); } catch(e) { return {}; }
  }
  function loadOB() {
    try { return JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}'); } catch(e) { return {}; }
  }
  function loadArch() {
    try { var a = JSON.parse(localStorage.getItem('courtiq-archetype') || '{}'); return a.key || ''; } catch(e) { return ''; }
  }

  function renderHeader() {
    var xpData = loadXP(), xp = xpData.xp || 0;
    var level = (typeof XPSystem !== 'undefined' && XPSystem.getLevel) ? XPSystem.getLevel(xp) : { name: 'Rookie', icon: '\ud83c\udfc0' };
    var ob = loadOB(), arch = loadArch();
    var badge = document.getElementById('ks-profile-level-badge');
    if (badge) badge.textContent = level.icon + ' ' + level.name;
    var posTag = document.getElementById('ks-profile-position-tag');
    if (posTag) {
      var pos = ob.position ? (POSITION_MAP[ob.position.toUpperCase()] || ob.position) : (arch ? arch.charAt(0).toUpperCase() + arch.slice(1) : null);
      posTag.textContent = pos || '\u2014';
    }
    var bioEl = document.getElementById('ks-profile-bio');
    if (bioEl && ARCH_BIO[arch]) bioEl.textContent = ARCH_BIO[arch];
  }

  function renderQuickStats() {
    var sessions = window.dbSessions || [];
    var count = sessions.length;
    var totalMade = sessions.reduce(function(a, s) { return a + (s.made || 0); }, 0);
    var totalAtt  = sessions.reduce(function(a, s) { return a + (s.attempts || 0); }, 0);
    var avgShots  = count ? (totalMade / count).toFixed(1) : '\u2014';
    var fgPct     = totalAtt > 0 ? ((totalMade / totalAtt) * 100).toFixed(1) + '%' : '\u2014';
    var v1 = document.getElementById('prof-stat1-val');
    var v2 = document.getElementById('prof-stat2-val');
    var v3 = document.getElementById('prof-stat3-val');
    if (v1) v1.textContent = count || '\u2014';
    if (v2) v2.textContent = avgShots;
    if (v3) v3.textContent = fgPct;
  }

  function gradeFromFG(made, attempts) {
    if (!attempts) return 'C';
    var pct = made / attempts;
    if (pct >= 0.70) return 'A+';
    if (pct >= 0.60) return 'A';
    if (pct >= 0.55) return 'A-';
    if (pct >= 0.50) return 'B+';
    if (pct >= 0.40) return 'B';
    return 'C';
  }

  function relDate(isoStr) {
    var days = Math.floor((Date.now() - new Date(isoStr)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return days + ' days ago';
  }

  function renderActivity() {
    var list = document.getElementById('ks-activity-list');
    if (!list) return;
    var sessions = (window.dbSessions || []).slice().reverse().slice(0, 3);
    if (!sessions.length) {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:rgba(229,226,225,0.4);font-size:13px">No sessions yet \u2014 complete a drill to see activity here</div>';
      return;
    }
    list.innerHTML = sessions.map(function(s, i) {
      var grade = gradeFromFG(s.made || 0, s.attempts || 0);
      var gcls  = grade.charAt(0) === 'A' ? 'ks-activity-grade--a' : 'ks-activity-grade--b';
      var hi    = i === 0 ? ' ks-activity-item--highlight' : '';
      var name  = s.drill_name || s.type || 'Training Session';
      var date  = s.created_at ? relDate(s.created_at) : 'Recent';
      return '<div class="ks-activity-item' + hi + '">' +
        '<div><div class="ks-activity-name">' + name + '</div>' +
        '<div class="ks-activity-date">' + date + '</div></div>' +
        '<div style="text-align:right">' +
        '<div class="ks-activity-grade ' + gcls + '">' + grade + '</div>' +
        '<div class="ks-label" style="font-size:9px;letter-spacing:0">Performance Score</div>' +
        '</div></div>';
    }).join('');
  }

  function renderTrophies() {
    var grid = document.getElementById('ks-trophy-grid');
    if (!grid) return;
    var sessions  = window.dbSessions || [];
    var xp        = (loadXP().xp) || 0;
    var totalMade = sessions.reduce(function(a, s) { return a + (s.made || 0); }, 0);
    var totalAtt  = sessions.reduce(function(a, s) { return a + (s.attempts || 0); }, 0);
    var bestFG    = totalAtt > 0 ? totalMade / totalAtt : 0;
    var TROPHIES = [
      { icon: 'workspace_premium', label: 'First Session',   unlocked: sessions.length >= 1  },
      { icon: 'sports_basketball', label: 'Dedicated (10+)', unlocked: sessions.length >= 10 },
      { icon: 'target',            label: 'Sniper Mode',     unlocked: bestFG >= 0.50        },
      { icon: 'military_tech',     label: 'All-Star Rank',   unlocked: xp >= 600             }
    ];
    grid.innerHTML = TROPHIES.map(function(t) {
      var cls  = t.unlocked ? 'ks-trophy-item' : 'ks-trophy-item ks-trophy-item--locked';
      var icon = t.unlocked ? t.icon : 'lock';
      return '<div class="' + cls + '">' +
        '<span class="material-symbols-outlined">' + icon + '</span>' +
        '<span class="ks-label" style="font-size:9px;line-height:1.3">' + t.label + '</span>' +
        '</div>';
    }).join('');
  }

  function init() {
    renderHeader();
    renderQuickStats();
    renderActivity();
    renderTrophies();
  }

  var _origP = typeof dbSwitchTab === 'function' ? dbSwitchTab : null;
  if (_origP) {
    window.dbSwitchTab = function(tab) {
      _origP(tab);
      if (tab === 'archetype') setTimeout(init, 100);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.ProfileSystem = { render: init };
})();

// ── DRILLS SYSTEM ──────────────────────────────────────────────────────────
(function DrillsSystem() {
  var ARCH_HERO = {
    scorer: {
      tag: 'ELITE SCORER PROGRAM',
      title: 'ISO SHOT\u003cbr\u003eCREATION',
      meta: ['\ud83d\udd25 ADVANCED', '\u23f1 45 MIN', '\ud83c\udfaf SHOOTING']
    },
    playmaker: {
      tag: 'PLAYMAKER PROGRAM',
      title: 'VISION \u0026\u003cbr\u003ePASSING MASTERY',
      meta: ['\u26a1 INTERMEDIATE', '\u23f1 40 MIN', '\ud83c\udfc0 HANDLES']
    },
    defender: {
      tag: 'LOCKDOWN PROGRAM',
      title: 'DEFENSIVE\u003cbr\u003eDOMINANCE',
      meta: ['\ud83d\udee1\ufe0f ADVANCED', '\u23f1 35 MIN', '\ud83d\udd12 DEFENSE']
    },
    'two-way': {
      tag: 'TWO-WAY ELITE PROGRAM',
      title: 'TWO-WAY\u003cbr\u003eELITE PROTOCOL',
      meta: ['\u26a1 ADVANCED', '\u23f1 50 MIN', '\ud83c\udfaf ALL-AROUND']
    },
    'rim-runner': {
      tag: 'INTERIOR BEAST PROGRAM',
      title: 'PAINT\u003cbr\u003eDOMINATION',
      meta: ['\ud83d\udcaa ADVANCED', '\u23f1 40 MIN', '\ud83e\udda5 VERTICAL']
    },
    default: {
      tag: "TODAY'S ELITE PROGRAM",
      title: 'HYPER-ELITE\u003cbr\u003eISO SHOT CREATION',
      meta: ['\ud83d\udd25 ADVANCED', '\u23f1 45 MIN', '\ud83c\udfaf SHOOTING']
    }
  };

  function renderHero() {
    var arch;
    try { arch = JSON.parse(localStorage.getItem('courtiq-archetype') || '{}').key || 'default'; } catch(e) { arch = 'default'; }
    var h = ARCH_HERO[arch] || ARCH_HERO['default'];
    var tagEl  = document.getElementById('drills-hero-tag');
    var titleEl = document.getElementById('drills-hero-title');
    var metaEl  = document.getElementById('drills-hero-meta');
    if (tagEl)  tagEl.textContent = h.tag;
    if (titleEl) titleEl.innerHTML = h.title;
    if (metaEl)  metaEl.innerHTML = h.meta.map(function(m) {
      return '<span class="glass-hero-meta-item">' + m + '</span>';
    }).join('');
  }

  function renderFocusCounts() {
    if (typeof _DRILLS_DB === 'undefined') return;
    var counts = { Shooting: 0, 'Ball Handling': 0, Defense: 0, Conditioning: 0 };
    _DRILLS_DB.forEach(function(d) {
      if (counts[d.focus_area] !== undefined) counts[d.focus_area]++;
    });
    var s = document.getElementById('focus-count-shooting');
    var h = document.getElementById('focus-count-handles');
    var d = document.getElementById('focus-count-defense');
    var v = document.getElementById('focus-count-vertical');
    if (s) s.textContent = counts['Shooting'] + ' drills';
    if (h) h.textContent = counts['Ball Handling'] + ' drills';
    if (d) d.textContent = counts['Defense'] + ' drills';
    if (v) v.textContent = counts['Conditioning'] + ' drills';
  }

  function autoFillGenerator() {
    var ob;
    try { ob = JSON.parse(localStorage.getItem('courtiq-onboarding-data') || '{}'); } catch(e) { ob = {}; }
    if (!ob.position) return;
    var posEl = document.getElementById('drill-position');
    if (posEl) posEl.value = ob.position.toUpperCase();
    if (ob.skill_level) {
      var lvlEl = document.getElementById('drill-level');
      if (lvlEl) lvlEl.value = ob.skill_level;
    }
  }

  function init() {
    renderHero();
    renderFocusCounts();
    autoFillGenerator();
  }

  var _origD = typeof dbSwitchTab === 'function' ? dbSwitchTab : null;
  if (_origD) {
    window.dbSwitchTab = function(tab) {
      _origD(tab);
      if (tab === 'drills') setTimeout(init, 100);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.DrillsSystem = { render: init };
})();
