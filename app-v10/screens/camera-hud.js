/* app-v10/screens/camera-hud.js
   CAMERA HUD — opens the real ShotTrackingScreen (camera + YOLO + pose) and
   skins it with v10 chrome: LIVE COUNT card top-right + parquet mini-court
   bottom-right. Old debug HUD + stat row are hidden via CSS scope.

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

  /* ── Mini half-court (LIVE) ──────────────────────────────────────
     Accurate NBA proportions in a 500×350 viewBox (1 unit = 0.1 ft).
       • Half-court width  : 50 ft → x = 0..500
       • Baseline to shown : ~35 ft → y = 0..350 (covers paint + 3PT arc + buffer)
       • Rim centre        : (250, 53)
       • 3PT arc radius    : 237.5 (23.75 ft from rim centre)
       • Paint             : 16 ft wide × 19 ft deep → x=170..330, y=0..190
       • Free-throw circle : r=60 at (250, 190)
       • Corner straight   : 3 ft from sideline, extends to y=140
     Starts EMPTY — dots are pushed live by the v10:shot DOM event. */
  var ZONE_CENTERS = {
    lc:     { x: 15,  y: 70  },
    rc:     { x: 485, y: 70  },
    ml:     { x: 90,  y: 100 },
    mr:     { x: 410, y: 100 },
    topmid: { x: 250, y: 200 },
    lw:     { x: 95,  y: 280 },
    rw:     { x: 405, y: 280 },
    top:    { x: 250, y: 295 },
    pnt:    { x: 250, y: 95  }
  };

  function miniCourt() {
    var line = { fill: 'none', stroke: '#F0E6D2', 'stroke-width': '2.5', opacity: '0.95',
                 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    var soft = { fill: 'none', stroke: '#F0E6D2', 'stroke-width': '1.8', opacity: '0.75' };

    return svg('svg', {
      viewBox: '0 0 500 350',
      preserveAspectRatio: 'xMidYMid meet',
      style: 'width:100%;height:100%;display:block'
    }, [
      // Outer half-court boundary (baseline + sidelines, top-clipped by viewBox)
      svg('rect', Object.assign({ x: '4', y: '4', width: '492', height: '342' }, line)),
      // 3PT corner straight lines (3 ft from sideline, baseline to 14 ft)
      svg('line', Object.assign({ x1: '30', y1: '0', x2: '30', y2: '142' }, line)),
      svg('line', Object.assign({ x1: '470', y1: '0', x2: '470', y2: '142' }, line)),
      // 3PT arc — centred at rim (250, 53), radius 237.5, from (30,142) to (470,142)
      svg('path', Object.assign({
        d: 'M 30 142 A 237.5 237.5 0 0 0 470 142'
      }, line)),
      // Paint (key) rectangle — 16ft × 19ft
      svg('rect', Object.assign({ x: '170', y: '0', width: '160', height: '190' }, soft)),
      // Free-throw circle — 6 ft radius at top of paint
      svg('circle', Object.assign({ cx: '250', cy: '190', r: '60' }, soft)),
      // Rim — 18 inch diameter (9 unit radius), centred (250, 53)
      svg('circle', { cx: '250', cy: '53', r: '9', fill: 'none', stroke: '#FF4F1F', 'stroke-width': '3.2' }),
      // Backboard — 6 ft wide, 4 ft from baseline (y=40)
      svg('line', { x1: '220', y1: '40', x2: '280', y2: '40', stroke: '#F0E6D2', 'stroke-width': '3' }),
      // Live shot dots get appended here
      svg('g', { id: 'v10-mini-dots' })
    ]);
  }

  /* Push a shot dot onto the mini-court. Called by the v10:shot listener.
     Maps zone → ZONE_CENTERS coords, with optional precise feet-on-court
     coords when the engine provides them. Green = MADE, Orange = MISS. */
  function pushShotToMiniCourt(detail) {
    var g = document.getElementById('v10-mini-dots');
    if (!g) return;
    var zone = detail && detail.v10Zone;
    var center = ZONE_CENTERS[zone] || ZONE_CENTERS.top;

    // Prefer precise position if engine supplied it (normalised feet coords).
    // We fold the player's normalised x into the zone's horizontal "lane" —
    // keeps the dot anchored to the zone but with a small lateral offset that
    // hints at where exactly the shooter was standing.
    var cx = center.x, cy = center.y;
    if (typeof detail.feetXNorm === 'number') {
      var lateral = (detail.feetXNorm - 0.5) * 80; // ±40 from zone centre
      cx = Math.max(20, Math.min(480, center.x + lateral));
    }

    // Counter mode (live): no verdict — neutral mustard dot marks the zone.
    var fill = (detail.made === null || detail.made === undefined)
      ? '#E0A82E'
      : (detail.made ? '#3D7A53' : '#FF4F1F');

    // Outer ripple ring (animation)
    var ring = svg('circle', {
      cx: '' + cx, cy: '' + cy, r: '6', fill: 'none',
      stroke: fill, 'stroke-width': '2', opacity: '0.85'
    });
    ring.style.transformOrigin = cx + 'px ' + cy + 'px';
    ring.style.animation = 'v10MiniRipple 700ms ease-out 1';

    // Solid dot
    var dot = svg('circle', {
      cx: '' + cx, cy: '' + cy, r: '8',
      fill: fill, stroke: '#FBF5E8', 'stroke-width': '1.5'
    });

    g.appendChild(ring);
    g.appendChild(dot);

    // Clean up ring after animation
    setTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 800);
  }

  /* ── LIVE COUNT card (top-right) ─────────────────────────────────
     Counter mode (M3): live counts ATTEMPTS only — verdicts come from
     the upload analyzer. Big number = shots detected. */
  function counterCard() {
    return h('div', { id: 'v10-cam-counter', class: 'v10-cam-counter' }, [
      h('div', { class: 'v10-cam-counter__eyebrow', text: 'LIVE COUNT' }),
      h('div', { class: 'v10-cam-counter__num', id: 'v10-cam-num', text: '0' }),
      h('div', { class: 'v10-cam-counter__sub', text: 'SHOTS DETECTED' }),
      h('div', { class: 'v10-cam-counter__streak' }, [
        h('i', { class: 'ph-bold ph-film-slate' }),
        h('span', { id: 'v10-cam-streak', text: 'UPLOAD FOR MADE/MISS' })
      ])
    ]);
  }

  /* ── Mini-court chip (bottom-right) ────────────────────────────── */
  function miniCourtCard() {
    return h('div', { id: 'v10-cam-mini', class: 'v10-cam-mini' }, [
      h('div', { class: 'v10-cam-mini__eyebrow' }, [
        icon('ph-basketball'),
        h('span', { text: 'ZONES LIVE' })
      ]),
      miniCourt()
    ]);
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
  function calibrationBanner() {
    var rows = [
      { key: 'hoop',   label: 'HOOP',   icon: 'ph-basketball' },
      { key: 'player', label: 'PLAYER', icon: 'ph-person' },
      { key: 'ball',   label: 'BALL',   icon: 'ph-circle' }
    ];
    var rowEls = rows.map(function (r) {
      return h('div', { id: 'v10-cal-row-' + r.key, class: 'v10-cal-row' }, [
        h('i', { class: 'ph-bold ' + r.icon }),
        h('span', { class: 'v10-cal-label', text: r.label }),
        h('span', { class: 'v10-cal-status', text: 'searching' })
      ]);
    });
    return h('div', { id: 'v10-cal-banner', class: 'v10-cal-banner' }, [
      h('div', { class: 'v10-cal-eyebrow', text: 'GETTING READY' }),
      h('div', { class: 'v10-cal-title', text: 'CALIBRATING' }),
      h('div', { class: 'v10-cal-sub', text: 'Aim camera at rim + player' })
    ].concat(rowEls));
  }

  function updateCalibration() {
    // Phase 9b: CALIBRATING banner permanently hidden. Radical mode no
    // longer gates counting on preflight — the engine records shots as
    // soon as pose triggers, so a "calibration" modal blocking the view
    // is just noise. If the banner element exists, force it off; we
    // don't even reason about pf.ready anymore.
    var banner = document.getElementById('v10-cal-banner');
    if (banner) banner.style.display = 'none';
  }

  function startPolling() {
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = setInterval(function () {
      var s = readEngineStats();
      var numEl = document.getElementById('v10-cam-num');
      if (numEl) numEl.textContent = String(s.att);
      updateCalibration();
    }, 500);
  }

  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
  }

  var v10ShotListener = null;

  function mountChrome() {
    if (v10Layer && v10Layer.parentNode) return;
    v10Layer = document.createElement('div');
    v10Layer.id = 'v10-cam-layer';
    v10Layer.appendChild(counterCard());
    v10Layer.appendChild(miniCourtCard());
    v10Layer.appendChild(calibrationBanner());
    document.body.appendChild(v10Layer);

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
      pushShotToMiniCourt(detail);
      // Persist for post-session view
      window.__v10SessionShots.push({
        made:       null,
        v10Zone:    detail.v10Zone || 'top',
        feetXNorm:  detail.feetXNorm,
        feetYNorm:  detail.feetYNorm,
        ts:         detail.ts || Date.now()
      });
    };
    document.body.addEventListener('v10:shot', v10ShotListener);
  }

  function unmountChrome() {
    if (v10Layer && v10Layer.parentNode) v10Layer.parentNode.removeChild(v10Layer);
    v10Layer = null;
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
      stageEl
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
      onProgress: function (f) { var p = Math.round(f * 100); bar.style.width = p + '%'; pct.textContent = p + '%'; },
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
          try { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); } catch (e) {}
          v10Layer = null;
          document.body.classList.remove('v10-cam-active');
          setNav(true);
          window.app.go('track');
        });
        overlay.appendChild(backBtn);
        return;
      }
      // Post-session renders ONLY window.__v10SessionShots — populate it
      // from the offline results exactly like the real-time listener does.
      window.__v10SessionMode = 'verdict';   // upload = full made/miss recap
      window.__v10SessionShots = (res.shots || []).map(function (s) {
        return {
          made:      s.result === 'made',
          v10Zone:   s.v10Zone || 'top',
          feetXNorm: s.shotX,
          feetYNorm: s.shotY
        };
      });
      return saveOfflineSession(res).then(function () {
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
