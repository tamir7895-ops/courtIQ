/* CourtIQ v10 — Data Bridge
   Thin wrapper around existing engine services. Each method returns a Promise.
   Falls back to FIXTURE when a service is missing or throws.
   ============================================================ */
(function () {
  'use strict';

  // ─── helpers ────────────────────────────────────────────
  function safe(fn) {
    try {
      var r = fn();
      if (r && typeof r.then === 'function') {
        return r.catch(function () { return null; });
      }
      return Promise.resolve(r);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  // Services declared with `const`/`let` at script top-level live in script
  // scope (shared across classic scripts) — accessible by bare name, not via
  // `window.X`. `typeof` on an undeclared identifier returns 'undefined'
  // without throwing, so we can probe safely.
  function getDataService() {
    return (typeof DataService !== 'undefined') ? DataService : null;
  }
  function getAICoach() {
    return (typeof AICoach !== 'undefined') ? AICoach : null;
  }
  function getDrillEngine() {
    return (typeof DrillEngine !== 'undefined') ? DrillEngine : null;
  }
  function getDrillsDB() {
    return (typeof _DRILLS_DB !== 'undefined') ? _DRILLS_DB : null;
  }

  // ─── fixture (fallback) ─────────────────────────────────
  var FIXTURE = {
    profile: {
      name: 'Alex Rivera',
      initial: 'A',
      position: 'SNIPER',
      level: 14,
      xp: 11200,
      xpNext: 15000,
      streak: 7,
      avatarUrl: null
    },
    today:  { shootingPct: 76, made: 23, attempted: 30, threePt: 42, trend: 6 },
    week:   { sessions: 3, goal: 5 },
    coach:  {
      verdict: 'Your left wing is leaking. Spend 50 reps there today.',
      highlight: 'Your left wing is leaking.',
      projection: '+3%'
    },
    drills: [
      { id: 'form-shoot',  name: 'Form Shooting', reps: 50, mins: 8, accent: 'orange'  },
      { id: 'catch-shoot', name: 'Catch & Shoot', reps: 30, mins: 6, accent: 'sage'    },
      { id: 'quick-draw',  name: 'Quick Draw',    reps: 20, mins: 4, accent: 'mustard' }
    ],
    zones: {
      lc:     { made: 2, att: 2,  label: 'L Corner 3' },
      lw:     { made: 2, att: 4,  label: 'L Wing 3' },
      top:    { made: 3, att: 4,  label: 'Top 3' },
      rw:     { made: 7, att: 9,  label: 'R Wing 3' },
      rc:     { made: 1, att: 2,  label: 'R Corner 3' },
      ml:     { made: 1, att: 3,  label: 'Mid L' },
      mr:     { made: 1, att: 2,  label: 'Mid R' },
      topmid: { made: 0, att: 0,  label: 'Top Mid' },
      pnt:    { made: 5, att: 7,  label: 'Paint' }
    }
  };

  // ─── profile ────────────────────────────────────────────
  function getProfile() {
    return safe(function () {
      var DS = getDataService();
      if (DS && DS.getProfile && window.currentUser) {
        return DS.getProfile().then(function (p) {
          if (!p) return FIXTURE.profile;
          var pos = (p.position || FIXTURE.profile.position).toUpperCase();
          // user_data is a JSONB blob — XP / streak may live there if the
          // top-level columns aren't populated yet on legacy rows.
          var ud = p.user_data || {};
          var xpData = (ud && ud.xp_data) || {};
          return {
            name:     p.first_name || p.full_name || FIXTURE.profile.name,
            initial:  ((p.first_name || p.full_name || 'A')[0] || 'A').toUpperCase(),
            position: pos,
            level:    p.level || ud.level || FIXTURE.profile.level,
            xp:       p.xp || xpData.xp || ud.xp || FIXTURE.profile.xp,
            xpNext:   p.xp_next || ud.xp_next || FIXTURE.profile.xpNext,
            streak:   p.streak_days || ud.streak_days || FIXTURE.profile.streak,
            avatarUrl: p.dicebear_avatar_url || ud.dicebear_avatar_url || null
          };
        });
      }
      return FIXTURE.profile;
    });
  }

  // ─── today's stats ──────────────────────────────────────
  function getTodayStats() {
    return safe(function () {
      var ST = window.ShotService;
      if (ST && ST.fetchSessions && window.currentUser) {
        return ST.fetchSessions(50).then(function (rows) {
          if (!rows || !rows.length) return FIXTURE.today;
          var today = new Date().toISOString().slice(0, 10);
          var todays = rows.filter(function (r) {
            return (r.session_date || '').slice(0, 10) === today;
          });
          if (!todays.length) return FIXTURE.today;
          var made = 0, att = 0;
          todays.forEach(function (s) {
            made += (s.made_count || 0);
            att  += (s.shot_count || (s.made_count || 0) + (s.miss_count || 0));
          });
          var pct = att ? Math.round(made * 100 / att) : 0;
          return { shootingPct: pct, made: made, attempted: att, threePt: FIXTURE.today.threePt, trend: 0 };
        });
      }
      return FIXTURE.today;
    });
  }

  // ─── week / streak ──────────────────────────────────────
  function getWeekStats() {
    return safe(function () {
      var ST = window.ShotService;
      if (ST && ST.fetchSessions && window.currentUser) {
        return ST.fetchSessions(50).then(function (rows) {
          if (!rows) return FIXTURE.week;
          var weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
          var n = rows.filter(function (r) {
            return new Date(r.session_date || r.created_at).getTime() >= weekAgo;
          }).length;
          return { sessions: n, goal: 5 };
        });
      }
      return FIXTURE.week;
    });
  }

  // ─── coach verdict ──────────────────────────────────────
  function getCoachVerdict() {
    return safe(function () {
      var AI = getAICoach();
      if (AI && AI.getDailyVerdict) {
        var v = AI.getDailyVerdict();
        if (v) return v;
      }
      return FIXTURE.coach;
    });
  }

  // ─── drills ─────────────────────────────────────────────
  // DrillEngine.suggestPlan() doesn't exist in the legacy engine.
  // Sample 3 drills directly from _DRILLS_DB (200 drills available)
  // and map to the V10 tile shape. Vary the accent color per slot.
  function getDrills() {
    return safe(function () {
      var DB = getDrillsDB();
      if (DB && DB.length) {
        var accents = ['orange', 'sage', 'mustard'];
        // Pick 3 distinct drills, biased toward Shooting + Ball Handling.
        var preferred = DB.filter(function (d) {
          return d && (d.focus_area === 'Shooting' || d.focus_area === 'Ball Handling');
        });
        var pool = preferred.length >= 3 ? preferred : DB;
        var picks = [];
        var step = Math.max(1, Math.floor(pool.length / 3));
        for (var i = 0; i < 3 && picks.length < 3; i++) {
          var d = pool[i * step];
          if (!d) continue;
          picks.push({
            id:    d.id || ('drill-' + i),
            name:  d.name || ('Drill ' + (i + 1)),
            reps:  d.reps_or_sets ? parseInt(String(d.reps_or_sets), 10) || 30 : 30,
            mins:  d.duration_minutes || 6,
            accent: accents[i % accents.length],
            focus: d.focus_area || 'Skill',
            description: d.description || ''
          });
        }
        if (picks.length) return picks;
      }
      return FIXTURE.drills;
    });
  }

  // ─── zone history ───────────────────────────────────────
  function getZones() {
    return safe(function () {
      var ST = window.ShotService;
      if (ST && ST.fetchZoneHistory && window.currentUser) {
        return ST.fetchZoneHistory({ days: 30 }).then(function (z) {
          if (!z) return FIXTURE.zones;
          return Object.assign({}, FIXTURE.zones, z);
        });
      }
      return FIXTURE.zones;
    });
  }

  // ─── shot tracking ──────────────────────────────────────
  // Observe the #shot-tracking-screen overlay; when its .active class
  // disappears (engine auto-closed after save, or user clicked Done/X),
  // route to v10 post-session for the recap.
  function watchTrackerClose() {
    setTimeout(function () {
      var screen = document.getElementById('shot-tracking-screen');
      if (!screen) return;
      var wasActive = screen.classList.contains('active');
      var obs = new MutationObserver(function () {
        var isActive = screen.classList.contains('active');
        if (wasActive && !isActive) {
          obs.disconnect();
          // Briefly defer so any save IO completes
          setTimeout(function () {
            if (window.app && window.app.go) window.app.go('post-session');
          }, 150);
        }
        wasActive = isActive;
      });
      obs.observe(screen, { attributes: true, attributeFilter: ['class'] });
    }, 400);
  }

  function startShotTracking() {
    if (window.ShotTrackingScreen && window.ShotTrackingScreen.open) {
      try {
        window.ShotTrackingScreen.open();
        watchTrackerClose();
        return true;
      }
      catch (e) { console.error('[v10] startShotTracking:', e); }
    }
    console.warn('[v10] ShotTrackingScreen unavailable');
    return false;
  }

  function openFromFile(file) {
    if (window.ShotTrackingScreen && window.ShotTrackingScreen.openFromFile) {
      try {
        window.ShotTrackingScreen.openFromFile(file);
        watchTrackerClose();
        return true;
      }
      catch (e) { console.error('[v10] openFromFile:', e); }
    }
    return false;
  }

  // Show a video file picker, then navigate to the camera-hud screen so
  // the v10 chrome (LIVE COUNT card + mini-court) mounts around the
  // engine — same as the normal camera flow, just fed by an uploaded
  // file instead of the live webcam. The camera-hud render reads
  // window.__v10PendingVideoFile and prefers it over startShotTracking()
  // when present.
  function pickAndOpenFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    // hidden but attached — some mobile browsers require the element be
    // in the DOM before .click() will show the picker
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      document.body.removeChild(input);
      if (!file) return;
      window.__v10PendingVideoFile = file;
      if (window.app && window.app.go) {
        window.app.go('camera-hud');
      } else {
        // fallback: no router available — open directly
        openFromFile(file);
      }
    });
    document.body.appendChild(input);
    input.click();
  }

  // ─── latest session (for post-session recap) ────────────
  function getLatestSession() {
    return safe(function () {
      var ST = window.ShotService;
      if (ST && ST.fetchSessions && window.currentUser) {
        return ST.fetchSessions(1).then(function (rows) {
          if (!rows || !rows.length) return null;
          var s = rows[0];
          var made = s.total_made != null ? s.total_made : (s.made_count || 0);
          var att  = s.total_attempts != null ? s.total_attempts : (made + (s.miss_count || 0));
          return {
            id:         s.id,
            made:       made,
            attempted:  att,
            accuracy:   s.accuracy != null ? Math.round(s.accuracy * 100) : (att ? Math.round(made * 100 / att) : 0),
            maxStreak:  s.max_streak || 0,
            durationMs: s.duration_ms || 0,
            sessionDate: s.session_date || s.created_at,
            xpEarned:   s.xp_earned || 0,
            threeMade:  s.three_made || 0,
            threeMissed: s.three_missed || 0,
            fgMade:     s.fg_made || 0,
            fgMissed:   s.fg_missed || 0,
            ftMade:     s.ft_made || 0,
            ftMissed:   s.ft_missed || 0
          };
        });
      }
      return null;
    });
  }

  // ─── auth helpers ──────────────────────────────────────
  function isSignedIn() { return !!window.currentUser; }

  function signIn(email, password) {
    if (typeof sb === 'undefined' || !sb.auth) return Promise.reject(new Error('sb not loaded'));
    return sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) throw res.error;
      window.currentUser = res.data.user;
      window.__PREVIEW_MODE__ = false;
      return res.data.user;
    });
  }

  function signOut() {
    if (typeof sb === 'undefined' || !sb.auth) return Promise.reject(new Error('sb not loaded'));
    return sb.auth.signOut().then(function () {
      window.currentUser = null;
      window.__PREVIEW_MODE__ = true;
    });
  }

  window.V10Data = {
    getProfile:        getProfile,
    getTodayStats:     getTodayStats,
    getWeekStats:      getWeekStats,
    getCoachVerdict:   getCoachVerdict,
    getDrills:         getDrills,
    getZones:          getZones,
    getLatestSession:  getLatestSession,
    startShotTracking: startShotTracking,
    openFromFile:      openFromFile,
    pickAndOpenFile:   pickAndOpenFile,
    isSignedIn:        isSignedIn,
    signIn:            signIn,
    signOut:           signOut,
    FIXTURE:           FIXTURE
  };
})();
