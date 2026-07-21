/* CourtIQ v10 — Data Bridge (M4 rewrite)
   Every number on screen is REAL or absent — never a fixture.

   Sources, merged everywhere:
   - Signed-in: Supabase rows (ai_shot_sessions / ai_shots / profiles).
   - Always:    localStorage offline records (anonymous sessions land in
                'courtiq-ai-sessions-offline' / 'courtiq-ai-shots-offline'),
                local XP ('courtiq-xp' via XPSystem) and streak (StreakSystem).

   session_type awareness: 'live_counter' rows carry total_made=null —
   they count toward attempts/volume but NEVER toward accuracy math.
   ============================================================ */
(function () {
  'use strict';

  var LS_SESSIONS = 'courtiq-ai-sessions-offline';
  var LS_SHOTS    = 'courtiq-ai-shots-offline';

  function safe(fn, fallback) {
    try {
      var r = fn();
      if (r && typeof r.then === 'function') {
        return r.catch(function () { return fallback !== undefined ? fallback : null; });
      }
      return Promise.resolve(r);
    } catch (e) {
      return Promise.resolve(fallback !== undefined ? fallback : null);
    }
  }

  function readLS(key) {
    try {
      var raw = localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  // ─── sessions (merged remote + local) ────────────────────
  function getSessions(limit) {
    limit = limit || 50;
    var locals = readLS(LS_SESSIONS);
    var remoteP = Promise.resolve([]);
    if (window.currentUser && window.ShotService && window.ShotService.fetchSessions) {
      remoteP = safe(function () {
        return window.ShotService.fetchSessions(window.currentUser.id, limit);
      }, []);
    }
    return remoteP.then(function (remote) {
      var seen = {};
      var all = [];
      (remote || []).concat(locals).forEach(function (s) {
        if (!s || !s.id || seen[s.id]) return;
        seen[s.id] = 1;
        all.push(s);
      });
      all.sort(function (a, b) {
        return new Date(b.session_date || b.created_at || 0) - new Date(a.session_date || a.created_at || 0);
      });
      return all.slice(0, limit);
    });
  }

  function isCounterSession(s) {
    return s && (s.session_type === 'live_counter' || s.total_made == null);
  }
  function sAtt(s)  { return s.total_attempts != null ? s.total_attempts : 0; }
  function sMade(s) { return isCounterSession(s) ? null : (s.total_made || 0); }

  // ─── shots (merged, for zone maps) ───────────────────────
  var V10_ZONES = { lc:1, rc:1, ml:1, mr:1, topmid:1, lw:1, rw:1, top:1, pnt:1 };
  var LEGACY_ZONE_MAP = { paint: 'pnt', freeThrow: 'pnt', midrange: 'topmid', threePoint: 'top' };

  function normZone(z) {
    if (!z) return null;
    if (V10_ZONES[z]) return z;
    return LEGACY_ZONE_MAP[z] || null;
  }

  function getShots(days) {
    days = days || 30;
    var cutoff = Date.now() - days * 86400000;
    var locals = readLS(LS_SHOTS).filter(function (s) {
      var t = new Date(s.timestamp || 0).getTime();
      return !t || t >= cutoff;
    });
    var remoteP = Promise.resolve([]);
    if (window.currentUser && typeof sb !== 'undefined' && sb.from) {
      remoteP = safe(function () {
        return sb.from('ai_shots')
          .select('shot_zone, shot_result, timestamp')
          .eq('user_id', window.currentUser.id)
          .gte('timestamp', new Date(cutoff).toISOString())
          .limit(2000)
          .then(function (res) { return res.data || []; });
      }, []);
    }
    return remoteP.then(function (remote) {
      return (remote || []).concat(locals);
    });
  }

  /* Zones: att = every shot, made/vatt = verdict shots only (upload
     analysis). Counter shots grow the bubbles, not the percentages. */
  var ZONE_LABELS = {
    lc: 'L Corner 3', rc: 'R Corner 3', lw: 'L Wing 3', rw: 'R Wing 3',
    top: 'Top 3', topmid: 'Top Mid', ml: 'Mid L', mr: 'Mid R', pnt: 'Paint'
  };

  function getZones(days) {
    return safe(function () {
      return getShots(days || 30).then(function (shots) {
        var zones = {};
        Object.keys(V10_ZONES).forEach(function (k) {
          zones[k] = { made: 0, att: 0, vatt: 0, label: ZONE_LABELS[k] };
        });
        shots.forEach(function (s) {
          var k = normZone(s.shot_zone);
          if (!k) return;
          zones[k].att += 1;
          if (s.shot_result === 'made' || s.shot_result === 'missed') {
            zones[k].vatt += 1;
            if (s.shot_result === 'made') zones[k].made += 1;
          }
        });
        return zones;
      });
    }, null);
  }

  // ─── profile ────────────────────────────────────────────
  function localXP() {
    try {
      var d = (window.XPSystem && window.XPSystem.load) ? window.XPSystem.load() : null;
      return d && typeof d.xp === 'number' ? d.xp : 0;
    } catch (e) { return 0; }
  }
  function localStreak() {
    try { return (window.StreakSystem && window.StreakSystem.get) ? window.StreakSystem.get() : 0; }
    catch (e) { return 0; }
  }
  function levelOf(xp) {
    try {
      if (window.XPSystem && window.XPSystem.getLevel) {
        var l = window.XPSystem.getLevel(xp);
        return (l && l.level) || (typeof l === 'number' ? l : 1);
      }
    } catch (e) {}
    return 1;
  }

  function guestProfile() {
    var name = '';
    try { name = localStorage.getItem('courtiq_profile_name') || ''; } catch (e) {}
    var pos = '';
    try { pos = localStorage.getItem('courtiq_profile_position') || ''; } catch (e) {}
    var xp = localXP();
    var lvl = levelOf(xp);
    var avatarUrl = null;
    try { avatarUrl = localStorage.getItem('courtiq_avatar_url') || null; } catch (e) {}
    return {
      name:     name || 'Rookie',
      initial:  ((name || 'R')[0] || 'R').toUpperCase(),
      position: (pos || 'PLAYER').toUpperCase(),
      level:    lvl,
      xp:       xp,
      xpNext:   null,
      streak:   localStreak(),
      avatarUrl: avatarUrl,
      guest:    true
    };
  }

  function getProfile() {
    return safe(function () {
      var DS = (typeof DataService !== 'undefined') ? DataService : null;
      if (DS && DS.getProfile && window.currentUser) {
        return DS.getProfile().then(function (p) {
          if (!p) return guestProfile();
          var ud = p.user_data || {};
          var xpData = (ud && ud.xp_data) || {};
          var xp = xpData.xp || ud.xp || localXP() || 0;
          return {
            name:     p.first_name || (window.currentUser.email || '').split('@')[0] || 'Player',
            initial:  ((p.first_name || window.currentUser.email || 'P')[0] || 'P').toUpperCase(),
            position: (p.position || 'PLAYER').toUpperCase(),
            level:    ud.level || levelOf(xp),
            xp:       xp,
            xpNext:   ud.xp_next || null,
            streak:   p.streak != null ? p.streak : localStreak(),
            avatarUrl: ud.dicebear_avatar_url || null,
            guest:    false
          };
        }).catch(function () { return guestProfile(); });
      }
      return guestProfile();
    }, guestProfile());
  }

  // ─── today ──────────────────────────────────────────────
  function aggregate(sessions) {
    var att = 0, made = 0, vatt = 0, threeMade = 0, threeAtt = 0;
    sessions.forEach(function (s) {
      att += sAtt(s);
      if (!isCounterSession(s)) {
        vatt += sAtt(s);
        made += sMade(s) || 0;
        threeMade += (s.three_made || 0);
        threeAtt  += (s.three_made || 0) + (s.three_missed || 0);
      }
    });
    return {
      attempted:   att,
      made:        vatt ? made : null,
      shootingPct: vatt ? Math.round(made * 100 / vatt) : null,
      verdictAtt:  vatt,
      threePt:     threeAtt ? Math.round(threeMade * 100 / threeAtt) : null,
      threeMade:   threeMade,
      sessions:    sessions.length
    };
  }

  function getTodayStats() {
    return safe(function () {
      return getSessions(50).then(function (rows) {
        var today = new Date().toISOString().slice(0, 10);
        var todays = rows.filter(function (r) {
          return (r.session_date || r.created_at || '').slice(0, 10) === today;
        });
        return aggregate(todays);
      });
    }, aggregate([]));
  }

  // ─── week (strip + challenges) ──────────────────────────
  function getWeekStats() {
    return safe(function () {
      return getSessions(100).then(function (rows) {
        var weekAgo = Date.now() - 7 * 86400000;
        var weekRows = rows.filter(function (r) {
          return new Date(r.session_date || r.created_at || 0).getTime() >= weekAgo;
        });
        var days = {};   // 'YYYY-MM-DD' → aggregate
        weekRows.forEach(function (r) {
          var d = (r.session_date || r.created_at || '').slice(0, 10);
          if (!d) return;
          (days[d] = days[d] || []).push(r);
        });
        Object.keys(days).forEach(function (d) { days[d] = aggregate(days[d]); });
        var agg = aggregate(weekRows);
        var hot = weekRows.filter(function (r) {
          return !isCounterSession(r) && sAtt(r) >= 5 && (r.accuracy != null ? r.accuracy : 0) >= 70;
        }).length;
        return {
          sessions: weekRows.length,
          goal: 5,
          days: days,
          attempts: agg.attempted,
          threes: agg.threeMade,
          hotSessions: hot
        };
      });
    }, { sessions: 0, goal: 5, days: {}, attempts: 0, threes: 0, hotSessions: 0 });
  }

  // ─── lifetime totals (me screen) ────────────────────────
  function getTotals() {
    return safe(function () {
      return getSessions(200).then(function (rows) {
        var agg = aggregate(rows);
        return { sessions: rows.length, shots: agg.attempted };
      });
    }, { sessions: 0, shots: 0 });
  }

  // ─── coach verdict (derived from REAL zone data) ────────
  function getCoachVerdict() {
    return safe(function () {
      return getZones(30).then(function (zones) {
        if (!zones) return null;
        var worst = null;
        Object.keys(zones).forEach(function (k) {
          var z = zones[k];
          if (z.vatt < 4) return;   // not enough evidence to nag about
          var pct = z.made / z.vatt;
          if (!worst || pct < worst.pct) worst = { key: k, pct: pct, z: z };
        });
        if (!worst) return null;
        var pctStr = Math.round(worst.pct * 100) + '%';
        return {
          verdict: 'Your ' + worst.z.label.toLowerCase() + ' sits at ' + pctStr +
                   ' (' + worst.z.made + '/' + worst.z.vatt + '). Spend 30 reps there today.',
          highlight: 'Your ' + worst.z.label.toLowerCase(),
          projection: null
        };
      });
    }, null);
  }

  // ─── drills (real content DB — 200 drills) ──────────────
  function getDrills(count) {
    var N = count || 3;
    return safe(function () {
      var DB = (typeof _DRILLS_DB !== 'undefined') ? _DRILLS_DB : null;
      if (DB && DB.length) {
        var accents = ['orange', 'sage', 'mustard'];
        var preferred = DB.filter(function (d) {
          return d && (d.focus_area === 'Shooting' || d.focus_area === 'Ball Handling');
        });
        var pool = preferred.length >= N ? preferred : DB;
        var picks = [];
        var step = Math.max(1, Math.floor(pool.length / N));
        for (var i = 0; i < N && picks.length < N; i++) {
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
      return [];
    }, []);
  }

  /* Plan-aware drill selection. Reads courtiq_plan_prefs (written by
     onboarding / the plan editor) and prescribes a session that honors
     the player's chosen focus areas and fits their session length —
     roughly one 8-minute drill per 8 minutes, 2–6 drills. Falls back to
     the generic getDrills when there are no prefs or no matching pool. */
  var FOCUS_TO_AREA = {
    shooting: 'Shooting', handles: 'Ball Handling', finishing: 'Finishing',
    defense: 'Defense', conditioning: 'Conditioning', passing: 'Passing'
  };
  function getPlanPrefs() {
    try {
      var raw = localStorage.getItem('courtiq_plan_prefs');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }
  function getPlanDrills() {
    /* Prefer the v12 plan console's schedule: prescribe TODAY's focus. */
    try {
      if (window.V12Plan) {
        var p = window.V12Plan.load();
        var td = window.V12Plan.todaysDrills(p);
        if (td && td.length) return Promise.resolve(td);
        // a scheduled rest day → still give something light to browse
      }
    } catch (e) {}
    var prefs = getPlanPrefs();
    var minutes = (prefs && prefs.minutes) || 30;
    var N = Math.max(2, Math.min(6, Math.round(minutes / 8)));
    if (!prefs || !prefs.focus || !prefs.focus.length) return getDrills(N);

    return safe(function () {
      var DB = (typeof _DRILLS_DB !== 'undefined') ? _DRILLS_DB : null;
      if (!DB || !DB.length) return getDrills(N);
      var accents = ['orange', 'sage', 'mustard'];
      var areas = prefs.focus.map(function (f) { return FOCUS_TO_AREA[f]; }).filter(Boolean);
      var picks = [], usedIds = {};
      // round-robin across focus areas, in priority order, so the top
      // focus leads and every chosen area is represented
      var poolByArea = areas.map(function (area) {
        return DB.filter(function (d) { return d && d.focus_area === area; });
      });
      var cursor = 0;
      while (picks.length < N && cursor < 40) {
        var area = cursor % Math.max(1, areas.length);
        var pool = poolByArea[area] || [];
        var d = pool[Math.floor(cursor / Math.max(1, areas.length)) % Math.max(1, pool.length)];
        cursor++;
        if (!d || usedIds[d.id]) continue;
        usedIds[d.id] = 1;
        picks.push({
          id: d.id || ('plan-' + picks.length),
          name: d.name || ('Drill ' + (picks.length + 1)),
          reps: d.reps_or_sets ? parseInt(String(d.reps_or_sets), 10) || 30 : 30,
          mins: d.duration_minutes || 6,
          accent: accents[picks.length % accents.length],
          focus: d.focus_area || 'Skill',
          description: d.description || ''
        });
      }
      return picks.length ? picks : getDrills(N);
    }, getDrills(N));
  }

  // ─── latest session ─────────────────────────────────────
  function getLatestSession() {
    return safe(function () {
      return getSessions(1).then(function (rows) {
        if (!rows || !rows.length) return null;
        var s = rows[0];
        var counter = isCounterSession(s);
        var made = sMade(s);
        var att  = sAtt(s);
        return {
          id:          s.id,
          counter:     counter,
          made:        made,
          attempted:   att,
          accuracy:    counter ? null
                       : (s.accuracy != null ? Math.round(s.accuracy)
                          : (att ? Math.round((made || 0) * 100 / att) : 0)),
          maxStreak:   s.max_streak || 0,
          durationMs:  s.duration_ms || 0,
          sessionDate: s.session_date || s.created_at,
          xpEarned:    s.xp_earned || 0
        };
      });
    }, null);
  }

  // ─── shot tracking (unchanged plumbing) ─────────────────
  function watchTrackerClose() {
    setTimeout(function () {
      var screen = document.getElementById('shot-tracking-screen');
      if (!screen) return;
      var wasActive = screen.classList.contains('active');
      var obs = new MutationObserver(function () {
        var isActive = screen.classList.contains('active');
        if (wasActive && !isActive) {
          obs.disconnect();
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

  function pickAndOpenFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
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
        openFromFile(file);
      }
    });
    document.body.appendChild(input);
    input.click();
  }

  // ─── auth passthrough (V10Auth owns auth since M3) ──────
  function isSignedIn() { return !!window.currentUser; }

  window.V10Data = {
    getProfile:        getProfile,
    getTodayStats:     getTodayStats,
    getWeekStats:      getWeekStats,
    getCoachVerdict:   getCoachVerdict,
    getDrills:         getDrills,
    getPlanDrills:     getPlanDrills,
    getPlanPrefs:      getPlanPrefs,
    getZones:          getZones,
    getShots:          getShots,
    getSessions:       getSessions,
    getTotals:         getTotals,
    getLatestSession:  getLatestSession,
    startShotTracking: startShotTracking,
    openFromFile:      openFromFile,
    pickAndOpenFile:   pickAndOpenFile,
    isSignedIn:        isSignedIn
  };
})();
