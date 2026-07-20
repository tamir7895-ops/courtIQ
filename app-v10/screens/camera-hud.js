/* app-v10/screens/camera-hud.js — v11
   CAMERA HUD — opens the real ShotTrackingScreen (camera + YOLO + pose).

   Designed for 20 feet, which is the only distance that matters here: the
   phone is on a tripod and the user is shooting. The optics are ruthless —
   at 20ft a legible glyph needs ~214pt of cap height (ISO 9241-303's
   16-arcmin floor; ~22 arcmin once you account for glare), which is most
   of the screen. So the HUD is ONE number and nothing else.

   The v10 chrome this replaces — a LIVE COUNT card with an eyebrow, a
   "SHOTS DETECTED" sub-label and a streak line, plus a parquet mini-court
   — measured ~3 arcmin at 20ft. Five times below the legibility floor.
   It spent the entire live UI budget on things the user physically could
   not see, on a screen they weren't looking at anyway (they're watching
   the rim, so the phone is in peripheral vision).

   Two structural consequences:
     · The number is ATTEMPTS, because live mode is counter-only
       (`__v10SessionMode='counter'`, `made:null`). We cannot compute makes
       live, so we don't show a makes counter we'd have to fake.
     · Status is a FULL-SCREEN colour field, not a badge. A corner dot at
       20ft subtends ~9 arcmin — foveally visible, peripherally absent.

   Audio (lib/audio.js) is not a nicety here. It's the only output that
   reaches the shooter.

   The router's `#camera-hud` host stays empty — the real overlay is a fixed
   fullscreen element on body, not inside #app.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, svg = window.V10UI.svg, icon = window.V10UI.icon;

  var pollHandle = null;
  var v10Layer = null;   // floating v10 chrome (sibling of #shot-tracking-screen)

  function setNav(visible) {
    var n = document.querySelector('.v10-nav');
    if (n) n.style.display = visible ? '' : 'none';
  }

  /* ── THE SESSION HUD ─────────────────────────────────────────────
     One number. That's the whole screen.

     The optics allow nothing else: at 20ft a legible glyph needs ~214pt
     of cap height (ISO 9241-303's 16-arcmin floor, ~22 for glare), which
     is most of the screen. The old HUD spent its entire budget on an
     eyebrow, a sub-label, a streak line and a mini-court — every one of
     them invisible from the free-throw line, on a screen the shooter
     isn't even looking at.

     ONE number, and it has to be ATTEMPTS: live mode is counter-only
     (`__v10SessionMode = 'counter'`, `made: null` below), so we cannot
     compute makes at all. HomeCourt shows two counters because HomeCourt
     computes makes live. Copying that would mean shipping a number we
     can't stand behind, or a "Makes: 0" that's wrong all session. */
  function checkRow(key, label) {
    return h('div', { class: 'v11-check', id: 'v11-check-' + key }, [
      h('span', { class: 'v11-check__dot' }),
      h('span', { class: 'v11-check__lbl', text: label })
    ]);
  }

  function hudLayer() {
    return h('div', { id: 'v11-hud', class: 'v11-hud v11-hud--live' }, [
      h('div', { class: 'v11-hud__frame' }),

      /* Right column: compact recording timer + a live checklist of what
         the model is seeing. The camera view itself is the hero now — the
         chrome stays out of the middle of the frame. The giant centre
         clock is gone by request; status reads as a tidy stack instead. */
      h('div', { class: 'v11-hud__side' }, [
        h('div', { class: 'v11-side__timer' }, [
          h('span', { class: 'v11-side__rec', id: 'v11-side-rec' }),
          h('span', { class: 'v11-side__time', id: 'v11-hud-timer', text: '0:00' })
        ]),
        /* progress toward the 5-minute cap, thin, right under the clock */
        h('div', { class: 'v11-side__cap' }, [
          h('div', { class: 'v11-side__capfill', id: 'v11-hud-capfill' })
        ]),
        h('div', { class: 'v11-side__checks' }, [
          checkRow('hoop',   'Hoop'),
          checkRow('ball',   'Ball'),
          checkRow('player', 'Player'),
          checkRow('rec',    'Rec')
        ])
      ]),

      /* Secondary, for when you walk back in. Framed as DETECTED, never as
         a score — the verdicts come from the analysis afterwards. */
      h('div', { class: 'v11-hud__meta' }, [
        h('span', { class: 'v11-hud__chip' }, [
          h('span', { class: 'v11-hud__chipnum', id: 'v10-cam-num', text: '0' }),
          h('span', { class: 'v11-hud__chiplbl', text: 'shots detected' })
        ])
      ]),

      h('div', { class: 'v11-hud__lost', id: 'v11-hud-lost', style: { display: 'none' },
        text: 'Lost the hoop' }),
      /* DIAGNOSTIC: which ORT execution provider actually won on THIS
         device. Desktop Chrome gets webgpu; a phone WebView may silently
         fall back to wasm (~1.4s/inference), which starves the real-time
         path — and that is invisible without saying so out loud. Tiny and
         dimmed so it never competes with the one number that matters. */
      h('div', { id: 'v10-backend-badge', style: {
        position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 8px)', left: '10px',
        font: '10px/1.4 ui-monospace, Menlo, monospace', color: 'rgba(255,255,255,0.55)',
        background: 'rgba(0,0,0,0.35)', padding: '3px 7px', borderRadius: '6px',
        letterSpacing: '0.04em', pointerEvents: 'none', zIndex: '5'
      }, text: 'backend …' })
    ]);
  }

  /* Session clock + cap bar. The cap exists because analysis runs at
     roughly 2-3x the clip length on-device — an uncapped session is an
     unbounded wait afterwards. Shown as extent (a bar) as well as digits,
     because a bar is readable from the free-throw line and digits are not
     once you are past ~15ft. */
  function updateSessionClock() {
    var el = document.getElementById('v11-hud-timer');
    if (!el) return;
    var capMs = window.__COURTIQ_SESSION_MAX_MS || (5 * 60 * 1000);
    var ms = sessionStartAt ? (Date.now() - sessionStartAt) : 0;
    if (ms < 0) ms = 0;
    var total = Math.floor(ms / 1000);
    var txt = Math.floor(total / 60) + ':' + ('0' + (total % 60)).slice(-2);
    if (el.textContent !== txt) el.textContent = txt;
    var frac = Math.max(0, Math.min(1, ms / capMs));
    var fill = document.getElementById('v11-hud-capfill');
    if (fill) {
      fill.style.width = (frac * 100).toFixed(1) + '%';
      fill.classList.toggle('is-near', frac >= 0.8);
    }
  }

  /* The live checklist — what is the model seeing RIGHT NOW.
     Hoop from rimSeen() (live detection freshness), ball/player from the
     engine's freshness stamps, rec from the recorder itself. Ball gets a
     wider window than its detection cadence (~10/s) because a ball is
     legitimately absent between shots — the row should read "recently seen",
     not flicker on every dribble. */
  function updateChecklist() {
    var eng = window.ShotDetectionEngine;
    var now = Date.now();
    function setRow(key, on, warn) {
      var el = document.getElementById('v11-check-' + key);
      if (!el) return;
      el.classList.toggle('is-on', !!on);
      el.classList.toggle('is-warn', !on && !!warn);
    }
    setRow('hoop', rimSeen());
    setRow('ball', eng && eng._diagLastBallAt && (now - eng._diagLastBallAt < 2000));
    setRow('player', eng && eng._diagLastPlayerAt && (now - eng._diagLastPlayerAt < 2000));
    var rec = null;
    try { rec = window.VideoReview && window.VideoReview.recordingState && window.VideoReview.recordingState(); } catch (e) {}
    // rec is a FAULT when off: an unrecorded session cannot be analysed.
    setRow('rec', rec && rec.active, true);
    var recDot = document.getElementById('v11-side-rec');
    if (recDot) recDot.classList.toggle('is-live', !!(rec && rec.active));
  }

  /* Reads the backend + a live diagnostic line: inference cost, how many
     YOLOX runs per second are actually happening, and — the key number —
     what fraction of those runs FIND a ball. A low ball-hit rate means the
     model cannot see the ball (distance / lighting / filming a screen); a
     low run rate means the loop is starved (compute). They point at
     completely different fixes, and this is how the phone tells us which. */
  var _diagWin = { runs: 0, hits: 0, t: 0 };   // window anchor
  var _diagShown = '';                          // last computed rate/ball text
  function backendLabel() {
    var eng = window.ShotDetectionEngine;
    if (!eng) return 'engine —';
    var be = eng._backend || '…';
    var ms = eng._inferMsEMA ? Math.round(eng._inferMsEMA) + 'ms' : '—';
    var now = Date.now();
    var runs = eng._diagYoloxRuns || 0, hits = eng._diagYoloxBallHits || 0;
    // Recompute the rate/ball% only every ~1.5s. Over the 250ms poll a WebGPU
    // loop only does ~2-3 inferences, so ball% would quantise to 0/33/50/100
    // and flicker; a 1.5s window gives a steady, readable number on device.
    if (!_diagWin.t) { _diagWin = { runs: runs, hits: hits, t: now }; }
    else if (now - _diagWin.t >= 1500) {
      var dt = (now - _diagWin.t) / 1000;
      var dr = runs - _diagWin.runs, dh = hits - _diagWin.hits;
      _diagShown = ' · ' + (dr / dt).toFixed(0) + '/s · ball ' +
                   (dr > 0 ? Math.round((dh / dr) * 100) : 0) + '%';
      _diagWin = { runs: runs, hits: hits, t: now };
    }
    var gpu = (typeof navigator !== 'undefined' && navigator.gpu) ? '' : ' no-webgpu';
    return be + ' · ' + ms + _diagShown + gpu;
  }

  /* ── Find engine state at runtime ─────────────────────────────── */
  function readEngineStats() {
    var madeEl = document.getElementById('st-made');
    var attEl  = document.getElementById('st-attempts');
    var made = madeEl ? parseInt(madeEl.textContent, 10) || 0 : 0;
    var att  = attEl  ? parseInt(attEl.textContent,  10) || 0 : 0;
    return { made: made, att: att };
  }

  /* ── v10 calibration banner — reads preflight progress from the
       engine's debug payload (window.__lastPreflight) which we wire from
       ShotTrackingScreen.js. ────────────────────────────────────────── */
  /* ── THE WALK-UP GATE ────────────────────────────────────────────
     Phase 9b hid this banner and stopped gating the COUNT on preflight.
     That reasoning was right — blocking counting on preflight is noise —
     but it removed the wrong gate and left the code behind as a corpse.

     The gate belongs on START. A clip recorded with the rim out of frame
     is unrecoverable: you shoot for twenty minutes, walk back, upload,
     and get "The hoop was not detected in this video" — a failure caused
     at record time and discovered far too late to fix. That's THE
     catastrophic failure mode of a tripod app.

     Rim only. Player and ball recover frame to frame; the rim is static,
     and if it's outside the crop it's outside for the whole clip.
     This is read with the phone in your hand, so it uses normal type. */
  var gateEl = null, rimStreak = 0, gatePassed = false;
  var sessionStartAt = 0;   // set when the user taps Start (not at mount)
  var shotBaseline   = 0;   // attempts already counted during walk-up

  function readPreflight() {
    try { return window.__lastPreflight || {}; } catch (e) { return {}; }
  }

  /* Is the hoop being seen RIGHT NOW?
     This used to be `pf.hoop || pf.rimLocked` — and neither field exists.
     The engine emits preflight as { ready, checks:{ball,hoop,player},
     thresholds }, so both reads were permanently undefined, `seen` was
     permanently false, rimStreak never reached 3, the gate never unlocked
     and the session clock (which starts on the gate's Start tap) never
     began. That is the "timer never started" report.

     Prefer the engine's LIVE hoop detection and treat it as fresh only
     while it keeps changing, so "Lost the hoop" still works. Fall back to
     the preflight tally read in its ACTUAL shape. */
  var _hoopSig = '', _hoopSigAt = 0;
  function rimSeen() {
    var eng = window.ShotDetectionEngine;
    var pf  = readPreflight();
    var pfSeen = !!(pf.rimLocked || pf.hoop ||
                    (pf.checks && pf.checks.hoop >= ((pf.thresholds && pf.thresholds.hoop) || 5)));
    if (!eng) return pfSeen;
    var d = eng._lastHoopDetection;
    if (d) {
      var sig = d.cx + ',' + d.cy + ',' + d.score;
      var now = Date.now();
      if (sig !== _hoopSig) { _hoopSig = sig; _hoopSigAt = now; }
      if (now - _hoopSigAt < 1500) return true;   // still updating = still seen
      return false;                                // frozen = hoop gone
    }
    return pfSeen;
  }

  function gateRow(key, label, iconName) {
    return h('div', { id: 'v11-gate-' + key, class: 'v11-gate__row' }, [
      h('i', { class: 'ph-bold ' + iconName }),
      h('span', { text: label }),
      h('span', { class: 'v11-gate__st', id: 'v11-gate-st-' + key, text: 'searching' })
    ]);
  }

  function audioToggle(key, label) {
    var on = window.V11Audio && window.V11Audio.prefs[key];
    var el = h('div', {
      class: 'v11-gate__tg' + (on ? ' is-on' : ''),
      role: 'button', tabindex: '0',
      onclick: function () {
        if (!window.V11Audio) return;
        var next = !window.V11Audio.prefs[key];
        window.V11Audio.set(key, next);
        el.classList.toggle('is-on', next);
        if (next) window.V11Audio.ok();
      }
    }, [
      h('i', { class: 'ph-fill ph-speaker-high' }),
      h('span', { text: label })
    ]);
    return el;
  }

  function buildGate(onStart) {
    var startBtn = h('button', {
      class: 'v11-cta', type: 'button', disabled: 'disabled',
      style: { opacity: '.45' },
      onclick: function () {
        if (!gatePassed) return;
        if (window.V11Audio) { window.V11Audio.arm(); window.V11Audio.say('Recording'); }
        gateEl.style.display = 'none';
        sessionStartAt = Date.now();   // the clock starts when shooting does
        /* The engine runs during the whole walk-up phase, so by the time the
           user actually taps Start it has already counted the shots taken
           while framing the hoop — the session opened on a non-zero count
           ("it counted a shot I never took"). Zero it at the real start. */
        try {
          var eng0 = window.ShotDetectionEngine;
          if (eng0 && eng0.resetStats) eng0.resetStats();
          /* The count the HUD shows comes from the legacy screen's DOM
             counters (#st-attempts), not from engine.stats, so resetting the
             engine alone leaves the old number on screen. Take a baseline at
             the real start and display the delta. */
          shotBaseline = readEngineStats().att;
          /* The clip is now genuinely being recorded, and the encoder shares
             the chip with YOLOX + pose. The accurate verdicts come from the
             offline pass over that clip, so the live engine can back right
             off — that headroom goes to a cleaner recording, which is what
             the accuracy actually depends on now. */
          if (eng0) eng0._lowPowerMode = true;
          window.__v10SessionShots = [];
          var n0 = document.getElementById('v10-cam-num');
          if (n0) n0.textContent = '0';
        } catch (e) {}
        onStart();
      }
    }, [h('span', { id: 'v11-gate-cta-t', text: 'Point at the hoop' })]);

    gateEl = h('div', { class: 'v11-gate', id: 'v11-gate' }, [
      h('div', { class: 'v11-gate__eye', text: 'SET UP' }),
      h('div', { class: 'v11-gate__t', text: 'Get the hoop in frame' }),
      h('div', { class: 'v11-gate__s',
        text: 'The rim is the only thing that has to be there. Without it the ' +
              'whole clip is unreadable — and you would only find that out afterwards.' }),
      gateRow('hoop', 'Hoop', 'ph-basketball'),
      h('div', { class: 'v11-gate__toggles' }, [
        audioToggle('tick', 'Tick'),
        audioToggle('count', 'Count')
      ]),
      startBtn,
      /* The detector has real failure modes (scan-halfW collapses indoors,
         night footage, under-hoop angles). A hard block turns a detector
         miss into a product wall, so there's always a way through — we
         just flag it so post-session can explain a mystery zero. */
      h('button', {
        class: 'v11-cta v11-cta--ghost', type: 'button',
        onclick: function () {
          window.__v11RimLockAtRecord = false;
          if (window.V11Audio) window.V11Audio.arm();
          gateEl.style.display = 'none';
          onStart();
        }
      }, [h('span', { text: 'Record anyway' })])
    ]);
    document.body.appendChild(gateEl);
    return gateEl;
  }

  /* Asymmetric hysteresis: fast to trust (3 frames), slow to doubt
     (1.5s). Prevents strobing on a single dropped frame. */
  function updateGate() {
    if (gatePassed) return;
    var seen = rimSeen();
    rimStreak = seen ? rimStreak + 1 : 0;

    var row = document.getElementById('v11-gate-hoop');
    var st  = document.getElementById('v11-gate-st-hoop');
    if (row) row.classList.toggle('is-on', seen);
    if (st) st.textContent = seen ? 'locked' : 'searching';

    if (rimStreak >= 3) {
      gatePassed = true;
      window.__v11RimLockAtRecord = true;
      var btn = gateEl && gateEl.querySelector('.v11-cta');
      var t = document.getElementById('v11-gate-cta-t');
      if (btn) { btn.removeAttribute('disabled'); btn.style.opacity = '1'; }
      if (t) t.textContent = 'Start shooting';
      if (window.V11Audio) { window.V11Audio.arm(); window.V11Audio.ok(); }
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
    }
  }

  /* Rim lost DURING a session — the one message worth interrupting for,
     and the only visual that survives 20ft is the full-screen wash. */
  var lostSince = 0, wasLost = false;
  function updateLive() {
    var hud = document.getElementById('v11-hud');
    if (!hud) return;
    var seen = rimSeen();
    var now = Date.now();
    if (seen) { lostSince = 0; }
    else if (!lostSince) { lostSince = now; }

    var lost = !!lostSince && (now - lostSince) > 1500;
    /* Word-level status now lives in the right-side checklist
       (updateChecklist); this keeps only the full-screen lost wash. */
    if (lost !== wasLost) {
      wasLost = lost;
      hud.classList.toggle('v11-hud--lost', lost);
      hud.classList.toggle('v11-hud--live', !lost);
      var lbl = document.getElementById('v11-hud-lost');
      if (lbl) lbl.style.display = lost ? 'block' : 'none';
      if (window.V11Audio) {
        if (lost) window.V11Audio.fault();      // never toggleable — it's an alarm
        else window.V11Audio.say('Got it');
      }
    }
  }

  function startPolling() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = setInterval(function () {
      var s = readEngineStats();
      var numEl = document.getElementById('v10-cam-num');
      var shown = Math.max(0, s.att - shotBaseline);
      if (numEl && numEl.textContent !== String(shown)) numEl.textContent = String(shown);
      updateSessionClock();
      updateChecklist();
      var beEl = document.getElementById('v10-backend-badge');
      if (beEl) {
        var lbl = backendLabel();
        if (beEl.textContent !== lbl) beEl.textContent = lbl;
      }
      if (gatePassed) updateLive(); else updateGate();
    }, 250);
  }

  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
  }

  var v10ShotListener = null;

  function mountChrome() {
    if (v10Layer && v10Layer.parentNode) return;
    rimStreak = 0; gatePassed = false; lostSince = 0; wasLost = false;
    sessionStartAt = 0; shotBaseline = 0;
    v10Layer = document.createElement('div');
    v10Layer.id = 'v10-cam-layer';
    v10Layer.appendChild(hudLayer());
    document.body.appendChild(v10Layer);
    /* The gate sits above the HUD until the rim locks. */
    buildGate(function () { /* the engine is already running; the gate just lifts */ });

    // ── Current-session shot log ────────────────────────────────
    // Post-session reads window.__v10SessionShots to render the recap
    // with ONLY this session's shots (not historical zone aggregates).
    // Reset at session start; append on every shot fire.
    window.__v10SessionShots = [];
    // LIVE sessions are counter-only (M3): made stays null everywhere,
    // and post-session renders the counter recap variant.
    window.__v10SessionMode = 'counter';

    // Live shot-zone push — engine dispatches 'v10:shot' on every shot finalisation
    v10ShotListener = function (ev) {
      if (!ev || !ev.detail) return;
      var detail = Object.assign({}, ev.detail, { made: null });
      // Persist for post-session view
      window.__v10SessionShots.push({
        made:       null,
        v10Zone:    detail.v10Zone || 'top',
        feetXNorm:  detail.feetXNorm,
        feetYNorm:  detail.feetYNorm,
        ts:         detail.ts || Date.now()
      });

      /* Shot registered. The tick is immediate — it's a receipt, not
         feedback, and past ~250ms it stops binding to the shot and starts
         reading as a malfunction. The spoken count lags deliberately. */
      if (window.V11Audio) {
        window.V11Audio.tick();
        window.V11Audio.count(window.__v10SessionShots.length);
      }
      try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}

      /* A ~325pt numeral pulsing 12% is a large-area motion event — the
         only kind that reads at 20ft, in peripheral vision. */
      var numEl = document.getElementById('v10-cam-num');
      if (numEl) {
        numEl.classList.remove('is-pop'); void numEl.offsetWidth;
        numEl.classList.add('is-pop');
      }
    };
    document.body.addEventListener('v10:shot', v10ShotListener);
  }

  function unmountChrome() {
    /* Leaving the session: hand the engine back its full cadence, or the
       next non-recorded use (and the offline analyser, which drives the same
       engine) would inherit the throttle. The clip hook is NOT cleared here:
       enterSummaryPhase captures it synchronously, but the recorder resolves
       async — clearing on unmount would race a legitimate hand-off. It is
       one-shot (nulls itself) and re-registered per mount. */
    try { if (window.ShotDetectionEngine) window.ShotDetectionEngine._lowPowerMode = false; } catch (e) {}
    if (v10Layer && v10Layer.parentNode) v10Layer.parentNode.removeChild(v10Layer);
    v10Layer = null;
    if (gateEl && gateEl.parentNode) gateEl.parentNode.removeChild(gateEl);
    gateEl = null;
    if (v10ShotListener) {
      document.body.removeEventListener('v10:shot', v10ShotListener);
      v10ShotListener = null;
    }
    stopPolling();
  }

  /* ── p11: OFFLINE upload analysis ─────────────────────────────
     An uploaded video is processed FRAME-BY-FRAME (ShotOfflineProcessor)
     instead of the real-time engine. This is the only path that produces
     accurate made/miss on distant footage — the dense per-frame ball
     trajectory lets the polyfit arc predictor decide whether each shot
     actually went through the rim. Shows a progress screen, saves the
     session, then routes to the post-session recap. ANY failure falls
     back to the live real-time path so an upload can never strand the
     user on a blank screen. */
  function saveOfflineSession(res) {
    var now = new Date();
    var sessionId = 'ai_' + now.getTime() + '_' + Math.random().toString(36).slice(2, 8);
    var userId = (window.currentUser && window.currentUser.id) || 'anonymous';
    var total = res.total || 0;
    var made  = res.made || 0;
    var shots = (res.shots || []).map(function (s, i) {
      return {
        session_id:             sessionId,
        user_id:                userId,
        shot_result:            s.result,
        shot_x:                 s.shotX,
        shot_y:                 s.shotY,
        launch_x:               s.launchPoint ? s.launchPoint.x : null,
        launch_y:               s.launchPoint ? s.launchPoint.y : null,
        shot_zone:              s.v10Zone || s.shotZone || 'paint',
        ball_trajectory_points: s.trajectory || [],
        timestamp:              new Date(now.getTime() + Math.round((s.__videoT || 0) * 1000)).toISOString(),
        shot_number:            i + 1
      };
    });
    var sessionPayload = {
      id:             sessionId,
      user_id:        userId,
      session_date:   now.toISOString(),
      session_type:   'ai_tracking',
      duration_ms:    Math.round((res.duration || 0) * 1000),
      total_attempts: total,
      total_made:     made,
      accuracy:       total ? Math.round((made / total) * 100) : 0,
      max_streak:     0,
      xp_earned:      made * 10 + total * 2,
      fg_made: 0, fg_missed: 0, three_made: 0, three_missed: 0,
      ft_made: made, ft_missed: total - made
    };
    if (window.ShotService && window.ShotService.saveSessionAtomic) {
      return window.ShotService.saveSessionAtomic(sessionPayload, shots).catch(function () {});
    }
    return Promise.resolve();
  }

  function runOfflineUpload(file, ctx) {
    var bar = h('div', { style: { height: '100%', width: '0%', background: 'var(--tomato)', borderRadius: '99px', transition: 'width .25s ease' } });
    var pct = h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '13px', opacity: '0.9' }, text: '0%' });
    var stageEl = h('div', { style: { fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '13px', opacity: '0.85', marginTop: '2px' }, text: 'Loading models…' });
    var diagEl = h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '10px', opacity: '0.45', marginTop: '2px' }, text: '' });

    // ── LIVE ANALYSIS VIEW ─────────────────────────────────────
    // The processor hands back every analyzed frame + detections via
    // onFrame; we draw the video with ball circles, the measured ring
    // line/span, player boxes, and pop MADE/MISS the moment each attempt
    // window closes (same classifyRange math as the final results).
    // The canvas fills whatever space the column leaves over (flex area
    // below), so the video is as LARGE as possible on every screen —
    // portrait or landscape — while title/progress stay visible.
    var liveCanvas = h('canvas', { style: {
      width: 'auto', height: 'auto', display: 'block',
      maxWidth: 'min(92vw, 560px)', maxHeight: '100%',
      borderRadius: '12px', border: '3px solid rgba(255,255,255,0.22)', background: '#000'
    } });
    liveCanvas.width = 640; liveCanvas.height = 360;
    var flashEl = h('div', {
      style: {
        position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'var(--font-display)', fontWeight: '900', fontSize: 'clamp(22px, 3.4dvh, 30px)',
        letterSpacing: '0.1em', textShadow: '0 2px 10px rgba(0,0,0,0.75)',
        opacity: '0', transition: 'opacity .25s ease', pointerEvents: 'none'
      }
    });
    // Holder hugs the canvas so the MADE/MISS flash rides ON the video
    var canvasHolder = h('div', { style: { position: 'relative', maxHeight: '100%', display: 'flex' } },
      [liveCanvas, flashEl]);
    var liveWrap = h('div', { style: {
      flex: '1 1 auto', minHeight: '0', width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: 'clamp(6px, 1.2dvh, 12px) 0 clamp(2px, 0.5dvh, 4px)'
    } }, [canvasHolder]);
    var dotsEl = h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', margin: '10px 0 2px', minHeight: '13px' } });
    var liveCount = h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '12px', opacity: '0.85', minHeight: '15px' }, text: '' });

    // Bouncing basketball while models spin up; hides once frames flow
    var loaderEl = h('div', { class: 'v10-ball-loader', style: { marginBottom: '6px' } },
      [h('span', { class: 'v10-ball' })]);

    var overlay = h('div', {
      style: {
        position: 'fixed', inset: '0', background: 'var(--ink)', color: 'var(--cream)', zIndex: '70',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        // Fit-to-viewport: safe-area aware (notch / home indicator),
        // fluid vertical costs — the flex canvas area absorbs the rest.
        padding: 'calc(var(--safe-top, 0px) + clamp(10px, 2dvh, 22px)) 16px calc(var(--safe-bottom, 0px) + clamp(10px, 2dvh, 22px))',
        textAlign: 'center', overflow: 'hidden'
      }
    }, [
      loaderEl,
      h('div', { style: { fontFamily: 'var(--font-display)', fontSize: 'clamp(16px, 2.6dvh, 20px)', fontWeight: '900', letterSpacing: '0.06em', flexShrink: '0' }, text: 'ANALYZING VIDEO' }),
      liveWrap,
      dotsEl,
      liveCount,
      h('div', { style: { width: '72%', maxWidth: '320px', height: 'clamp(7px, 1dvh, 9px)', background: 'rgba(255,255,255,0.15)', borderRadius: '99px', margin: 'clamp(6px, 1.2dvh, 12px) 0 clamp(3px, 0.7dvh, 6px)', overflow: 'hidden', flexShrink: '0' } }, [bar]),
      pct,
      stageEl,
      diagEl
    ]);
    document.body.appendChild(overlay);
    v10Layer = overlay;

    var lctx = liveCanvas.getContext('2d');
    var lastShotCount = 0, lastShotSig = '', flashTimer = null, aspectSet = false;
    function drawLive(fd) {
      if (loaderEl.style.display !== 'none') loaderEl.style.display = 'none';
      var W = liveCanvas.width, H = liveCanvas.height;
      if (!aspectSet && fd.video.videoWidth > 0) {
        liveCanvas.height = Math.round(640 * fd.video.videoHeight / fd.video.videoWidth);
        H = liveCanvas.height; aspectSet = true;
      }
      try { lctx.drawImage(fd.video, 0, 0, W, H); } catch (e) { return; }
      // measured ring: green line + span ticks
      if (fd.ring) {
        var ry = fd.ring.y * H;
        var rl = (fd.ring.cx - fd.ring.halfW) * W;
        var rr = (fd.ring.cx + fd.ring.halfW) * W;
        lctx.strokeStyle = 'rgba(90,255,130,0.95)';
        lctx.lineWidth = 2;
        lctx.beginPath(); lctx.moveTo(rl - 16, ry); lctx.lineTo(rr + 16, ry); lctx.stroke();
        lctx.lineWidth = 3;
        lctx.beginPath(); lctx.moveTo(rl, ry - 10); lctx.lineTo(rl, ry + 10); lctx.stroke();
        lctx.beginPath(); lctx.moveTo(rr, ry - 10); lctx.lineTo(rr, ry + 10); lctx.stroke();
      }
      // ball candidates: yellow circles (brighter = higher confidence)
      var balls = (fd.dets && fd.dets.balls) || [];
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        lctx.strokeStyle = 'rgba(255,214,0,' + Math.min(1, 0.45 + b.s) + ')';
        lctx.lineWidth = 2.5;
        lctx.beginPath(); lctx.arc(b.x * W, b.y * H, 9, 0, Math.PI * 2); lctx.stroke();
      }
      // players: thin white boxes
      var players = (fd.dets && fd.dets.players) || [];
      lctx.strokeStyle = 'rgba(255,255,255,0.45)';
      lctx.lineWidth = 1.5;
      for (var p = 0; p < players.length; p++) {
        var pl = players[p];
        lctx.strokeRect((pl.x - pl.w / 2) * W, (pl.y - pl.h / 2) * H, pl.w * W, pl.h * H);
      }
      // time chip
      lctx.fillStyle = 'rgba(0,0,0,0.55)';
      lctx.fillRect(6, 6, 96, 20);
      lctx.fillStyle = '#fff';
      lctx.font = '11px monospace';
      lctx.fillText(fd.t.toFixed(1) + 's · ' + Math.round(fd.frac * 100) + '%', 12, 20);
      // rim status chip (top-right): searching / locked / approx
      var rimLabel = !fd.ring ? 'RIM: SEARCHING…' : (fd.ring.fb ? 'RIM: APPROX' : 'RIM: LOCKED');
      var rimColor = !fd.ring ? '#FF6B5E' : (fd.ring.fb ? '#FFC24B' : '#5BE37D');
      lctx.font = 'bold 11px monospace';
      var tw = lctx.measureText(rimLabel).width;
      lctx.fillStyle = 'rgba(0,0,0,0.55)';
      lctx.fillRect(W - tw - 18, 6, tw + 12, 20);
      lctx.fillStyle = rimColor;
      lctx.fillText(rimLabel, W - tw - 12, 20);
      // shot dots + verdict flash. Repaint on any SIGNATURE change (early
      // verdicts can self-correct while the ring median converges), flash
      // only when a NEW shot closes.
      var shots = fd.shots || [];
      var sig = shots.map(function (s) { return s.result === 'made' ? 'M' : 'X'; }).join('');
      if (sig !== lastShotSig) {
        dotsEl.innerHTML = '';
        var made = 0;
        for (var si = 0; si < shots.length; si++) {
          if (shots[si].result === 'made') made++;
          dotsEl.appendChild(h('span', {
            style: {
              width: '11px', height: '11px', borderRadius: '50%', display: 'inline-block',
              background: shots[si].result === 'made' ? '#3FA34D' : '#D64541',
              border: '2px solid rgba(255,255,255,0.6)'
            }
          }));
        }
        liveCount.textContent = shots.length + ' shots · ' + made + ' made · ' + (shots.length - made) + ' missed';
        if (shots.length > lastShotCount) {
          var last = shots[shots.length - 1];
          flashEl.textContent = last.result === 'made' ? 'MADE!' : 'MISS';
          flashEl.style.color = last.result === 'made' ? '#5BE37D' : '#FF6B5E';
          flashEl.style.opacity = '1';
          if (flashTimer) clearTimeout(flashTimer);
          flashTimer = setTimeout(function () { flashEl.style.opacity = '0'; }, 900);
        }
        lastShotCount = shots.length;
        lastShotSig = sig;
      }
    }

    function fallbackToRealtime() {
      window.__v10AnalysisOwnsFlow = false;
      try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
      v10Layer = null;
      try {
        window.__v10PendingVideoFile = null;
        if (ctx.data.openFromFile && ctx.data.openFromFile(file)) { mountChrome(); startPolling(); }
      } catch (e) {}
    }

    var analysisT0 = Date.now();
    window.ShotOfflineProcessor.process(file, {
      fps: 30,
      // Show the execution provider alongside progress: on a phone WebView
      // that fell back to wasm this is the whole explanation for a slow
      // analyze, and it is otherwise invisible.
      onProgress: function (f) {
        var p = Math.round(f * 100);
        bar.style.width = p + '%';
        /* Remaining-time estimate from the measured rate so far. Held back
           until 4% so one slow model-load frame cannot produce a wild
           number; simple linear projection is honest enough at this scale. */
        var eta = '';
        if (f > 0.04) {
          var remMs = (Date.now() - analysisT0) * (1 / f - 1);
          var mm = Math.floor(remMs / 60000), ss = Math.round((remMs % 60000) / 1000);
          eta = ' · ~' + (mm > 0 ? mm + 'm ' + ('0' + ss).slice(-2) + 's' : ss + 's') + ' left';
        }
        pct.textContent = p + '%' + eta;
        diagEl.textContent = backendLabel();
      },
      onStage: function (s) { stageEl.textContent = s; },
      onFrame: drawLive
    }).then(function (res) {
      // Device benchmark readout (M2): post-session shows engine + timing —
      // readable straight off an iPhone screen, no Web Inspector needed.
      try {
        var eng2 = window.ShotDetectionEngine;
        window.__v10AnalysisInfo = {
          ms: Date.now() - analysisT0,
          videoSec: (res && res.duration) || 0,
          frames: (res && res.frames) || 0,
          ep: (eng2 && eng2._detectorType) || '?'
        };
      } catch (e) {}
      // If nothing was detected, tell the user WHY instead of a silent
      // "0 of 0" recap. The diag says whether the hoop was ever found /
      // the rim locked — the two reasons a whole clip yields no shots.
      if (!res || res.total === 0) {
        var d = (res && res.diag) || {};
        var reason = !d.rimLocked
          ? 'The hoop was not detected in this video, so no shots could be measured. Make sure the rim is clearly visible in frame.'
          : 'The rim locked, but no shot arcs were detected. The ball may be too small/blurred to track, or no shots occurred.';
        stageEl.textContent = '';
        overlay.innerHTML = '';
        overlay.appendChild(h('i', { class: 'ph-bold ph-basketball', style: { fontSize: '48px', color: 'var(--mustard)', marginBottom: '12px' } }));
        overlay.appendChild(h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '900', letterSpacing: '0.05em' }, text: 'NO SHOTS DETECTED' }));
        overlay.appendChild(h('div', { style: { fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '14px', marginTop: '10px', opacity: '0.85', maxWidth: '320px', lineHeight: '1.5' }, text: reason }));
        overlay.appendChild(h('div', { style: { fontFamily: 'var(--font-mono)', fontSize: '11px', marginTop: '14px', opacity: '0.5' }, text: 'hoop frames: ' + (d.hoopDetections || 0) + ' (max conf ' + (d.hoopMaxConf != null ? d.hoopMaxConf : '?') + ', tier ' + (d.usedTier || '?') + ') · rim: ' + (d.rimLocked ? 'locked' : 'not found') + ' · frames: ' + (d.frames || 0) }));
        var backBtn = h('button', { style: { marginTop: '22px', padding: '12px 28px', background: 'var(--tomato)', color: 'var(--cream)', border: 'none', borderRadius: '10px', fontFamily: 'var(--font-display)', fontWeight: '900', letterSpacing: '0.05em', fontSize: '14px', cursor: 'pointer' }, text: 'BACK' });
        backBtn.addEventListener('click', function () {
          window.__v10AnalysisOwnsFlow = false;
          try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
          v10Layer = null;
          document.body.classList.remove('v10-cam-active');
          setNav(true);
          window.app.go('track');
        });
        overlay.appendChild(backBtn);
        return;
      }
      /* Results are in — say so out loud. The user was told to walk away
         while the clip is analysed; audio + a buzz is what actually reaches
         them when the phone is face-up on a bench. */
      try { if (window.V11Audio && window.V11Audio.say) window.V11Audio.say('Analysis complete'); } catch (e) {}
      try { if (navigator.vibrate) navigator.vibrate([40, 90, 40]); } catch (e) {}
      // Post-session renders ONLY window.__v10SessionShots — populate it
      // from the offline results exactly like the real-time listener does.
      window.__v10SessionMode = 'verdict';   // upload = full made/miss recap
      window.__v10SessionShots = (res.shots || []).map(function (s, i) {
        return {
          made:      s.result === 'made',
          v10Zone:   s.v10Zone || 'top',
          feetXNorm: s.shotX,
          feetYNorm: s.shotY,
          /* `why` was computed and thrown away. It's the uncertainty flag
             we already pay for: classifyRange only returns 'made' on
             POSITIVE evidence (ring-cross / inside-net / dwell), and
             'missed' is the fallthrough — 'no through evidence'. So a
             miss with that reason isn't "I saw it miss", it's "I never
             saw it at all", which is the shot most likely to be wrong and
             worth showing the user. No new model, no calibration. */
          why:       s.why || null,
          videoT:    s.__videoT,
          i:         i
        };
      });
      return saveOfflineSession(res).then(function () {
        window.__v10AnalysisOwnsFlow = false;
        try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
        v10Layer = null;
        document.body.classList.remove('v10-cam-active');
        setNav(true);
        window.app.go('post-session');
      });
    }).catch(function () { fallbackToRealtime(); });
  }

  function render(args) {
    var ctx = args.ctx;

    // The v10 host stays empty — the real overlay is fixed on body.
    setNav(false);
    document.body.classList.add('v10-cam-active');

    // Open the real shot-tracker overlay (camera + YOLO + pose). If the
    // user came via "TEST WITH VIDEO FILE" a pending File is stashed on
    // window.__v10PendingVideoFile — consume it and feed the engine
    // frames from that file instead of opening the live camera.
    var available = false;
    var pendingFile = window.__v10PendingVideoFile;

    // p11: uploaded videos go through the OFFLINE analyzer (accurate
    // made/miss). Live camera keeps the real-time path.
    if (pendingFile && window.ShotOfflineProcessor && window.ShotOfflineProcessor.process) {
      window.__v10PendingVideoFile = null;
      runOfflineUpload(pendingFile, ctx);
      return;   // offline path owns the rest of the flow
    }

    try {
      if (pendingFile && ctx.data.openFromFile) {
        window.__v10PendingVideoFile = null;
        available = !!ctx.data.openFromFile(pendingFile);
      } else {
        available = !!ctx.data.startShotTracking();
      }
    } catch (e) { available = false; }

    if (!available) {
      // Fallback message — tracker module not loaded.
      var msg = h('div', {
        style: {
          position: 'fixed', inset: '0', background: 'var(--ink)', color: 'var(--cream)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '30px', textAlign: 'center', zIndex: '60'
        }
      }, [
        h('i', { class: 'ph-bold ph-camera-slash', style: { fontSize: '56px', color: 'var(--mustard)', marginBottom: '12px' } }),
        h('div', { style: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '900', letterSpacing: '0.06em' }, text: 'CAMERA UNAVAILABLE' }),
        h('div', { style: { fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '14px', marginTop: '8px', opacity: '0.8' }, text: 'The detection engine did not load. Refresh the page.' })
      ]);
      document.body.appendChild(msg);
      v10Layer = msg;
    } else {
      // Mount v10 chrome over the camera; mini-court starts EMPTY and
      // fills live as the engine dispatches v10:shot events per shot.
      mountChrome();
      startPolling();

      /* Record-then-analyse: when the user ends the session,
         ShotTrackingScreen hands the recorded clip here instead of showing
         its legacy summary, and the SAME offline pipeline that scores
         uploads (9/9 on real footage) scores the session. One-shot: the
         hook nulls itself so a stale consumer can never fire twice. */
      window.__v10OnSessionClip = function (data) {
        window.__v10OnSessionClip = null;
        unmountChrome();
        if (data && data.blob) {
          var mime = data.blob.type || 'video/webm';
          var name = 'session.' + (mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm');
          var file;
          try { file = new File([data.blob], name, { type: mime }); }
          catch (e) { file = data.blob; }   // Blob works too — process() only createObjectURLs it
          document.body.classList.add('v10-cam-active');
          runOfflineUpload(file, ctx);
        } else {
          /* No clip captured (recorder unsupported / failed) — the live
             counter recap is all the truth we have; land there instead of
             stranding the user. */
          window.__v10AnalysisOwnsFlow = false;
          document.body.classList.remove('v10-cam-active');
          setNav(true);
          ctx.go('post-session');
        }
      };
    }

    // Watch the tracker close to clean up our chrome too.
    setTimeout(function () {
      var screen = document.getElementById('shot-tracking-screen');
      if (!screen) return;
      var wasActive = screen.classList.contains('active');
      var obs = new MutationObserver(function () {
        var isActive = screen.classList.contains('active');
        if (wasActive && !isActive) {
          obs.disconnect();
          unmountChrome();
          document.body.classList.remove('v10-cam-active');
          setNav(true);
        }
        wasActive = isActive;
      });
      obs.observe(screen, { attributes: true, attributeFilter: ['class'] });
    }, 500);

    // If user uses the v10 nav (rare; nav is hidden) — clean up before route change.
    var leaveObs = new MutationObserver(function () {
      if (window.__v10AnalysisOwnsFlow) return;   // analysis overlay owns v10Layer now
      if (document.body.getAttribute('data-screen') !== 'camera-hud') {
        unmountChrome();
        document.body.classList.remove('v10-cam-active');
        setNav(true);
        leaveObs.disconnect();
      }
    });
    leaveObs.observe(document.body, { attributes: true, attributeFilter: ['data-screen'] });
  }

  window.app.register('camera-hud', render);
})();
