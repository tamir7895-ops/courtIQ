/* ══════════════════════════════════════════════════════════════
   SHOT OFFLINE PROCESSOR  (p12 — timeline classifier)
   ────────────────────────────────────────────────────────────────
   Two-pass analyzer for uploaded videos. Replaces the real-time
   state machine entirely for uploads.

   PASS 1 — collection: seek the video frame-by-frame; the engine
   runs YOLOX on every frame (awaited, nothing skipped) and hands
   back ALL detections per frame via onFrameDetections (low-floor
   ball candidates ≥0.02, refined hoops, players). Every ~24 frames
   the RING is measured from pixels: a red-biased color mask over
   the hoop-bbox area, longest-contiguous-run per row → exact ring
   line y + x-span. (The rim bbox alone is NOT the ring: it hugs
   rim+net and sits offset from the true ring span.)

   PASS 2 — classification (validated 14/14 vs hand-annotated
   ground truth on the Dr.Dish eval clip, sequence
   M-M-M-X-M-M-M-M-X-M-M-M-X-X):
     * attempts  = ARRIVALS: ball appears ABOVE the ring plane after
       ≥0.8s without above-ring presence; window runs to the next
       arrival, capped at 2.6s (covers rim-bounce sequences).
     * verdict   = MADE if any consecutive-frame pair crosses the
       ring plane downward with interpolated x inside 0.95×ring
       half-width, or a detection sits INSIDE the net cone
       (y ≤ ring+0.062, |x-cx| ≤ 0.70×halfW). Otherwise MISS.
   Rationale: on return-net setups (Dr.Dish/APEX) EVERY ball ends up
   below the rim — "ball went down" proves nothing. The ring-span
   crossing is the only honest made/miss discriminator.

   Public API (unchanged from p11):
     window.ShotOfflineProcessor.process(file, { fps, onProgress,
       onStage, signal }) → Promise<{ shots, total, made, missed,
       rawTotal, duration, frames, rim, diag }>
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function seekTo(video, t) {
    return new Promise(function (resolve) {
      // Same-time seeks fire NO 'seeked' event — resolve straight away or
      // we would hang on the stall-guard timer (≥1s in background tabs).
      if (Math.abs((video.currentTime || 0) - t) < 0.001) { resolve(); return; }
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        video.removeEventListener('seeked', finish);
        resolve();
      }
      video.addEventListener('seeked', finish);
      try { video.currentTime = t; } catch (e) { finish(); return; }
      setTimeout(finish, 400);   // codec-stall guard (fires only on stall)
    });
  }

  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /* Longest run of true values allowing gaps ≤ maxGap.
     Returns [startIdx, endIdx, trueCount]. */
  function longestRun(row, maxGap) {
    var best = [0, -1, 0];
    var i = 0, n = row.length;
    while (i < n) {
      if (!row[i]) { i++; continue; }
      var j = i, gap = 0, trues = 0, lastTrue = i;
      while (j < n) {
        if (row[j]) { trues++; lastTrue = j; gap = 0; }
        else if (++gap > maxGap) break;
        j++;
      }
      if (trues > best[2]) best = [i, lastTrue, trues];
      i = lastTrue + 1;
    }
    return best;
  }

  /* Measure the ring from pixels at NATIVE VIDEO RESOLUTION: red-biased
     mask (the ring is the only saturated red/orange band in the hoop
     area; foliage/nets fail the g/b gates), longest contiguous run on the
     peak row → ring y + x span.

     Resolution matters: the verdict boundary between a make and a rim-
     grazing miss is ~10-15 full-res pixels. Scanning the blurred ~360p
     proc canvas measured the span 40% wide (±row band unions too much of
     the ring arc) or fragmented it — both flipped verdicts. Drawing the
     rim REGION of the source video 1:1 onto a small offscreen canvas
     reproduces the validated full-res measurement exactly (same
     constants: peak row ≥10 red px, band ±3 rows, gap ≤6, run ≥12). */
  var _ringCanvas = null, _ringCtx = null;
  function scanRingFull(video, boxFull) {
    var vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    var x0 = Math.max(0, Math.round(boxFull.cx - boxFull.bw));
    var x1 = Math.min(vw, Math.round(boxFull.cx + boxFull.bw));
    var y0 = Math.max(0, Math.round(boxFull.cy - boxFull.bh));
    var y1 = Math.min(vh, Math.round(boxFull.cy + boxFull.bh * 0.5));
    var w = x1 - x0, h = y1 - y0;
    if (w < 24 || h < 10) return null;
    if (!_ringCanvas) {
      _ringCanvas = document.createElement('canvas');
      _ringCtx = _ringCanvas.getContext('2d', { willReadFrequently: true });
    }
    if (_ringCanvas.width !== w || _ringCanvas.height !== h) {
      _ringCanvas.width = w; _ringCanvas.height = h;
    }
    var data;
    try {
      _ringCtx.drawImage(video, x0, y0, w, h, 0, 0, w, h);
      data = _ringCtx.getImageData(0, 0, w, h).data;
    } catch (e) { return null; }
    // Two mask passes, strict first:
    //   1) RED — saturated painted rims (validated 14/14 on the eval clip).
    //      Runs first because it is far more selective: orange balls,
    //      autumn foliage and warm wood all FAIL its g<105 gate.
    //   2) ORANGE — standard rims under daylight/night lighting (g 60-160)
    //      that red misses entirely. Only consulted when red finds nothing,
    //      so it can never contaminate footage where red works.
    function passScan(mode) {
      var counts = new Int32Array(h);
      var mask = new Uint8Array(w * h);
      for (var y = 0; y < h; y++) {
        var off = y * w * 4, c = 0;
        for (var x = 0; x < w; x++) {
          var r = data[off + x * 4], g = data[off + x * 4 + 1], b = data[off + x * 4 + 2];
          var hit = mode === 'red'
            ? (r > 110 && g < 105 && b < 105 && r > g * 1.45 && r > b * 1.35)
            : (r > 120 && g >= 60 && g < 160 && b < 110 && r > g * 1.25 && r > b * 1.7);
          if (hit) { mask[y * w + x] = 1; c++; }
        }
        counts[y] = c;
      }
      var bestRow = 0;
      for (var yy = 1; yy < h; yy++) if (counts[yy] > counts[bestRow]) bestRow = yy;
      if (counts[bestRow] < 10) return null;
      var band = new Uint8Array(w);
      for (var by = Math.max(0, bestRow - 3); by <= Math.min(h - 1, bestRow + 3); by++) {
        for (var bx2 = 0; bx2 < w; bx2++) if (mask[by * w + bx2]) band[bx2] = 1;
      }
      var run = longestRun(band, 6);
      if (run[2] < 12) return null;
      return {
        y: (y0 + bestRow) / vh,
        left: (x0 + run[0]) / vw,
        right: (x0 + run[1]) / vw
      };
    }
    return passScan('red') || passScan('orange');
  }

  /* ── Ball-track gap interpolation (bridge detection dropout at the rim) ──
     The made/miss classifier is only as good as the ball signal it sees.
     YOLOX drops the ball for a handful of frames at the exact through-rim
     moment (net occlusion, motion blur, tiny distant ball) — measured on
     the night_c 1.1s make: a 6-frame gap at the crossing (f46→f52) broke the
     dwell-run continuity and the make was scored a miss. Competitor trackers
     (avishah3, chonyy, NEX/HomeCourt) all agree: don't classify off raw
     per-frame detections — associate them into a track and interpolate the
     gap, then decide against the continuous trajectory.

     Greedy constant-velocity association over the near-rim obs; for each pair
     of consecutive REAL anchors in a track separated by a short gap, insert
     linearly-interpolated points into the intervening frames. We ONLY bridge
     BETWEEN two real detections — never extrapolate past the last one (that
     is the L31 ghost bug where a constant-velocity phantom sailed off-frame
     and fired false triggers). Interpolated points carry a modest synthetic
     score so they clear the ball floor but never dominate a real detection.
     Validated on GT (scratch/score_batch.py SB_TRACKFILL): 15/17 → 16/17
     with zero regressions; stable for maxGap 6-12. obs is mutated in place
     (new arrays are pushed onto the per-frame lists). */
  function bridgeTrackGaps(obs, N, maxGap, synthS) {
    maxGap = maxGap || 8; synthS = synthS || 0.12;
    var openT = [], tracks = [];
    for (var f = 0; f < N; f++) {
      var cand = obs[f].slice().sort(function (a, b) { return b.s - a.s; });
      var used = new Array(cand.length);
      for (var ti = 0; ti < openT.length; ti++) {
        var tr = openT[ti];
        var last = tr.pts[tr.pts.length - 1];
        var dt = f - tr.lastF;
        var px = last.x + tr.vx * dt, py = last.y + tr.vy * dt;
        var gate = 0.045 + 0.02 * (dt - 1);
        var best = -1, bd = gate;
        for (var ci = 0; ci < cand.length; ci++) {
          if (used[ci]) continue;
          var dist = Math.abs(cand[ci].x - px) + Math.abs(cand[ci].y - py);
          if (dist < bd) { best = ci; bd = dist; }
        }
        if (best >= 0) {
          used[best] = true;
          var d = cand[best], step = Math.max(1, f - last.frame);
          tr.vx = 0.4 * tr.vx + 0.6 * (d.x - last.x) / step;
          tr.vy = 0.4 * tr.vy + 0.6 * (d.y - last.y) / step;
          tr.pts.push({ frame: f, x: d.x, y: d.y }); tr.lastF = f;
        }
      }
      for (var ci2 = 0; ci2 < cand.length; ci2++) {
        if (!used[ci2] && cand[ci2].s >= 0.05) {
          openT.push({ pts: [{ frame: f, x: cand[ci2].x, y: cand[ci2].y }],
                       vx: 0, vy: 0, lastF: f });
        }
      }
      var keep = [];
      for (var ki = 0; ki < openT.length; ki++) {
        if (f - openT[ki].lastF > maxGap) tracks.push(openT[ki]);
        else keep.push(openT[ki]);
      }
      openT = keep;
    }
    for (var oi = 0; oi < openT.length; oi++) tracks.push(openT[oi]);
    for (var tj = 0; tj < tracks.length; tj++) {
      var pts = tracks[tj].pts;
      if (pts.length < 2) continue;
      for (var a = 0; a < pts.length - 1; a++) {
        var pa = pts[a], pb = pts[a + 1], gap = pb.frame - pa.frame;
        if (gap < 2 || gap > maxGap) continue;
        for (var g = 1; g < gap; g++) {
          var r = g / gap, fi = pa.frame + g;
          var xf = pa.x + r * (pb.x - pa.x), yf = pa.y + r * (pb.y - pa.y);
          var dup = false;
          for (var pi = 0; pi < obs[fi].length; pi++) {
            if (Math.abs(obs[fi][pi].x - xf) + Math.abs(obs[fi][pi].y - yf) < 0.02) { dup = true; break; }
          }
          if (!dup) obs[fi].push({ x: xf, y: yf, s: synthS, filled: true });
        }
      }
    }
    return obs;
  }

  /* Verdict for one attempt window — PURE function shared by the final
     pass-2 classification AND the live display layer, so what the user
     watches during analysis is the exact same math as the saved result.
     obsArr: per-frame arrays of rim-area ball obs {x,y,s} (normalized). */
  function classifyRange(obsArr, ring, f0, f1) {
    function bestOf(i) {
      var arr = obsArr[i];
      if (!arr || !arr.length) return null;
      var best = arr[0];
      for (var k = 1; k < arr.length; k++) if (arr[k].s > best.s) best = arr[k];
      return best;
    }
    // M6 recal: in-and-out veto — the ball momentarily dips through the
    // plane, then STRONG obs reappear ABOVE the ring and roll off (dish
    // 49.4s under m6: crossing, then s 0.87-0.91 obs at dy −0.02..−0.03).
    // A true make is inside the net after its evidence — nothing strong
    // reappears above the plane. Mirrors the track chain's re-rise kill.
    // Restored dish 14/14 in the lab; zero collateral on the full battery.
    function reRose(crossF) {
      var kEnd = Math.min(crossF + 9, f1 + 1, obsArr.length);
      for (var k = crossF + 1; k < kEnd; k++) {
        var arrR = obsArr[k] || [];
        for (var m = 0; m < arrR.length; m++) {
          var oR = arrR[m];
          if (oR.s >= 0.30 && (oR.y - ring.y) <= -0.02 &&
              Math.abs(oR.x - ring.cx) <= ring.halfW * 2.5) return true;
        }
      }
      return false;
    }
    // 1) downward ring-plane crossings within the ring span
    var prevF = -1, prevB = null;
    for (var i = f0; i <= f1; i++) {
      var b = bestOf(i);
      if (!b) continue;
      if (prevB && (i - prevF) <= 6 && prevB.y < ring.y && b.y >= ring.y) {
        var r = (ring.y - prevB.y) / Math.max(b.y - prevB.y, 1e-6);
        var xAt = prevB.x + r * (b.x - prevB.x);
        if (Math.abs(xAt - ring.cx) <= ring.halfW * 0.95 && !reRose(i)) {
          return { v: 'made', why: 'ring-cross x=' + xAt.toFixed(3) + ' f=' + i };
        }
      }
      prevF = i; prevB = b;
    }
    // 2) inside-net evidence (any candidate)
    for (var j = f0; j <= f1; j++) {
      var arr2 = obsArr[j] || [];
      for (var k2 = 0; k2 < arr2.length; k2++) {
        var o = arr2[k2];
        if (o.y >= ring.y + 0.008 && o.y <= ring.y + 0.062 &&
            Math.abs(o.x - ring.cx) <= ring.halfW * 0.70 && !reRose(j)) {
          return { v: 'made', why: 'inside-net (' + o.x.toFixed(3) + ',' + o.y.toFixed(3) + ') f=' + j };
        }
      }
    }
    return { v: 'missed', why: 'no through evidence' };
  }

  var ShotOfflineProcessor = {
    _running: false,

    process: function (file, opts) {
      opts = opts || {};
      var fps  = opts.fps || 30;
      var self = this;
      // Progress + stage are mirrored onto the processor object so the
      // console can always answer "where is it stuck?" (self._stage/_frac).
      var onProgress = function (f) { self._frac = f; try { (opts.onProgress || function () {})(f); } catch (e) {} };
      var onStage    = function (s) { self._stage = s; try { (opts.onStage || function () {})(s); } catch (e) {} };
      // Live-view hook: called after every processed frame with the seeked
      // video element + this frame's detections + current ring estimate +
      // shots classified so far — the UI draws the analysis as it happens.
      var onFrame    = typeof opts.onFrame === 'function'
        ? function (d) { try { opts.onFrame(d); } catch (e) {} }
        : null;
      var signal     = opts.signal || null;
      self._stage = 'video-load'; self._frac = 0; self._liveShots = [];

      return new Promise(function (resolve, reject) {
        if (self._running) { reject(new Error('offline processing already running')); return; }
        self._running = true;

        var eng = window.ShotDetectionEngine;
        if (!eng) { self._running = false; reject(new Error('ShotDetectionEngine not loaded')); return; }

        var video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        var url = URL.createObjectURL(file);
        video.src = url;

        var rows = [];         // per-frame: {t, balls:[{x,y,s}], players:[{x,y,w,h,s}]}
        var hoopPx = [];       // hoop dets in proc px (for ring scanning + fallback)
        var crHoopY = [];      // colorRefined ring rows (normalized) — fallback ring y
        var ringSamples = [];  // {y, left, right} normalized
        var prevOffline, prevRunning, prevOnFrame;

        function cleanup() {
          try { eng._offlineMode = false; } catch (e) {}
          try { eng.isRunning = prevRunning; } catch (e) {}
          try { eng.onFrameDetections = prevOnFrame; } catch (e) {}
          try { if (eng.stop && eng.isRunning) eng.stop(); } catch (e) {}
          try { eng.isRunning = false; } catch (e) {}
          try { URL.revokeObjectURL(url); } catch (e) {}
          self._running = false;
        }
        function fail(err) { cleanup(); reject(err); }

        var run = function () {
          var duration = video.duration || 0;
          // Infinity slips past a falsy check: totalFrames became Infinity,
          // progress stuck at 0 and the seek loop never terminated.
          if (!isFinite(duration)) { fail(new Error('video duration unavailable (unseekable recording)')); return; }
          if (!duration || !video.videoWidth) { fail(new Error('video has no duration/dimensions')); return; }

          // ── iOS/WKWebView canvas-taint probe ─────────────────────
          // Under the app's custom scheme (courtiq://), WebKit can mark a
          // MediaRecorder blob video CROSS-ORIGIN: every canvas readback
          // then throws SecurityError, the engine's per-frame try/catch
          // swallows it, and a whole analysis "completes" with frames: 0
          // (device report 2026-07-23 — progress ran 10→99%, No shots
          // detected, zero telemetry). The camera stream itself is never
          // tainted, which is why LIVE detection works on the same build.
          // Recovery: reload the clip as a data: URL — always same-origin.
          try {
            var pc = document.createElement('canvas');
            pc.width = 8; pc.height = 8;
            var px = pc.getContext('2d', { willReadFrequently: true });
            px.drawImage(video, 0, 0, 8, 8);
            px.getImageData(0, 0, 1, 1);
          } catch (taintErr) {
            if (!taintFixTried) {
              taintFixTried = true;
              taintFixed = true;
              onStage('Preparing clip…');
              var fr = new FileReader();
              fr.onerror = function () { fail(new Error('clip unreadable (taint recovery failed)')); };
              fr.onload = function () {
                try { URL.revokeObjectURL(url); } catch (e) {}
                var reReady = false;
                var again = function () {
                  if (reReady) return;
                  if (video.readyState >= 2 && video.videoWidth > 0) {
                    reReady = true;
                    clearInterval(rePoll); clearTimeout(reFail);
                    try { video.pause(); } catch (e) {}
                    try { video.currentTime = 0; } catch (e) {}
                    run();
                  }
                };
                video.addEventListener('loadeddata', again);
                video.addEventListener('canplay', again);
                var rePoll = setInterval(again, 300);
                var reFail = setTimeout(function () {
                  clearInterval(rePoll);
                  if (!reReady) fail(new Error('clip reload failed (taint recovery)'));
                }, 15000);
                video.src = fr.result;
                try { video.load(); } catch (e) {}
                try { var k2 = video.play(); if (k2 && k2.then) k2.catch(function () {}); } catch (e) {}
              };
              fr.readAsDataURL(file);
              return;             // run() re-enters once the clip reloads
            }
            // recovery already tried and readback STILL throws — continue;
            // the per-frame error capture + telemetry will name it.
          }

          onStage('Loading model…');
          try { if (eng.init) eng.init(); } catch (e) {}
          // Only YOLOX is needed offline (no pose, no color) — one model.
          var modelReady = eng.preloadModel ? eng.preloadModel() : Promise.resolve();
          Promise.race([
            Promise.resolve(modelReady).catch(function () {}),
            wait(30000)
          ]).then(function () {
            prevOffline = eng._offlineMode;
            prevRunning = eng.isRunning;
            prevOnFrame = eng.onFrameDetections;

            eng._offlineMode = true;
            /* Belt and braces: the live session sets _lowPowerMode while
               recording to give the encoder the chip. Offline analysis is the
               opposite regime — it must see EVERY frame, and it is where the
               accuracy comes from — so never inherit a stale throttle. */
            eng._lowPowerMode = false;
            eng._recordingIdle = false;   // offline must see EVERY frame
            if (eng.isRunning) { try { eng.stop(); } catch (e) {} }
            eng._offlineMode = true;
            try { eng.start(video); } catch (e) { fail(e); return; }
            eng._offlineMode = true;
            eng.isRunning = true;
            // fresh error capture for THIS run (surfaced on the No-shots
            // screen + telemetry — the frames:0 class was invisible before)
            eng._offlineFirstErr = null;
            eng._offlineErrN = 0;

            var pwLast = 640, phLast = 360;
            var lastDets = null;   // this frame's normalized detections (live view)
            eng.onFrameDetections = function (fd) {
              pwLast = fd.pw; phLast = fd.ph;
              var row = {
                t: fd.t,
                balls: fd.balls.map(function (b) {
                  return { x: b.cx / fd.pw, y: b.cy / fd.ph, s: b.score };
                }),
                players: fd.players.map(function (p) {
                  return { x: p.cx / fd.pw, y: p.cy / fd.ph, w: p.bw / fd.pw, h: p.bh / fd.ph, s: p.score };
                })
              };
              rows.push(row);
              lastDets = row;
              for (var i = 0; i < fd.hoops.length; i++) {
                var hh = fd.hoops[i];
                // Keep EVERY hoop the engine surfaces (its floor is 0.10)
                // with its score — night/low-light footage rarely clears
                // 0.30, and a fixed high gate starved the ring logic to
                // "hoop frames: 4" on real user footage. strongHoops()
                // picks the most confident usable subset adaptively.
                hoopPx.push({ cx: hh.cx, cy: hh.cy, bw: hh.bw, bh: hh.bh, s: hh.score,
                              fi: rows.length - 1 });
                if (hh.colorRefined) crHoopY.push(hh.cy / fd.ph);
              }
              // PAN detector: rolling median of recent hoop cx — if the
              // smoothed center wanders > 4% of frame width the camera is
              // panning and pass 2 switches to TRACK mode (ring follows
              // the hoop instead of a single locked position). Spread is
              // the p90−p10 of the median HISTORY, not running min/max —
              // a single detection flicker onto another object must not
              // flip a static video (Dr.Dish) into track mode forever.
              if (fd.hoops.length) {
                _panWin.push(hoopPx[hoopPx.length - 1].cx / fd.pw);
                if (_panWin.length > 15) _panWin.shift();
                if (_panWin.length >= 10) {
                  var pmed = _panWin.slice().sort(function (a, b) { return a - b; })[_panWin.length >> 1];
                  _panMedHist.push(pmed);
                }
              }
            };
            var _panWin = [], _panMedHist = [], _panCache = { n: -1, spread: 0 };
            function panSpread() {
              if (_panMedHist.length !== _panCache.n) {
                if (_panMedHist.length >= 45) {
                  var srt = _panMedHist.slice().sort(function (a, b) { return a - b; });
                  _panCache.spread = srt[Math.floor(srt.length * 0.9)] - srt[Math.floor(srt.length * 0.1)];
                } else {
                  _panCache.spread = 0;
                }
                _panCache.n = _panMedHist.length;
              }
              return _panCache.spread;
            }
            function isPanning() { return panSpread() > 0.04 && hoopPx.length >= 30; }

            // Adaptive confidence subset: prefer ≥0.30 detections (clean
            // footage), fall back to ≥0.15, then to everything surfaced.
            // Median-based consumers tolerate the extra noise of the lower
            // tiers; on high-conf footage this returns the same set as the
            // old fixed 0.30 gate (regression-safe by construction).
            function strongHoops() {
              var hi = hoopPx.filter(function (h) { return h.s >= 0.30; });
              if (hi.length >= 8) return hi;
              var mid = hoopPx.filter(function (h) { return h.s >= 0.15; });
              if (mid.length >= 8) return mid;
              return hoopPx;
            }

            // ── LIVE attempt tracker (display only) ───────────────
            // Runs the SAME classifyRange math incrementally so verdicts
            // pop the moment each attempt window closes. Pass 2 stays the
            // single source of truth for the saved session; the live ring
            // uses the same median as pass 2 and the live state rebuilds
            // if the ring estimate shifts while samples accumulate.
            var live = { obs: [], built: 0, arrivals: [], closed: 0, shots: [], ring: null };
            function ringFromSamples() {
              if (ringSamples.length < 3) return null;
              var ry = median(ringSamples.map(function (s) { return s.y; }));
              var rl = median(ringSamples.map(function (s) { return s.left; }));
              var rr = median(ringSamples.map(function (s) { return s.right; }));
              if (rr - rl <= 0.015) return null;
              var ring = { y: ry, cx: (rl + rr) / 2, halfW: (rr - rl) / 2 };
              // halfW floor from the YOLO hoop bbox — a partial color-band
              // scan (dim light, thin paint) can undershoot the true ring
              // span; the bbox-derived width (×0.72 rim/bbox ratio) floors
              // it. Inactive on footage where the scan is healthy.
              var hpF = strongHoops();
              if (hpF.length >= 8) {
                var pw4 = eng._procW || pwLast;
                var bboxHalf = (median(hpF.map(function (h) { return h.bw; })) / pw4) * 0.5 * 0.72;
                if (ring.halfW < bboxHalf * 0.8) ring.halfW = bboxHalf * 0.8;
              }
              // Absolute floor: partial color-band scans undershoot; every
              // measured real ring so far sits at halfW 0.030-0.047
              // (landscape AND portrait), so clamp the low end there.
              if (ring.halfW < 0.030) ring.halfW = 0.030;
              return ring;
            }
            // Fallback ring for live view when the color scan yields no
            // samples (unusual rim paint / lighting): YOLO hoop bbox
            // median + colorRefined ring rows — same formula pass 2 uses.
            function liveFallbackRing() {
              var hp = strongHoops();
              if (hp.length < 8) return null;
              var pw3 = eng._procW || pwLast, ph3 = eng._procH || phLast;
              var bcx = median(hp.map(function (h) { return h.cx; })) / pw3;
              var bcy = median(hp.map(function (h) { return h.cy; })) / ph3;
              var bbw = median(hp.map(function (h) { return h.bw; })) / pw3;
              var bbh = median(hp.map(function (h) { return h.bh; })) / ph3;
              var ringY = crHoopY.length >= 3 ? median(crHoopY) : (bcy - bbh / 2 + bbh * 0.15);
              if (bbw < 0.02) return null;
              return { y: ringY, cx: bcx, halfW: bbw * 0.5 * 0.72, fb: true };
            }
            function liveTick() {
              var ring = ringFromSamples();
              if (!ring && rows.length > 120) ring = liveFallbackRing();
              if (!ring) return;
              if (live.ring && (Math.abs(live.ring.y - ring.y) > 0.004 ||
                                Math.abs(live.ring.cx - ring.cx) > 0.004 ||
                                Math.abs(live.ring.halfW - ring.halfW) > 0.004)) {
                live.obs = []; live.built = 0; live.arrivals = []; live.closed = 0; live.shots = [];
              }
              live.ring = ring;
              var GAP = Math.round(0.8 * fps), CAP = Math.round(2.6 * fps);
              for (; live.built < rows.length; live.built++) {
                var bl = rows[live.built].balls, near = [];
                for (var bi = 0; bi < bl.length; bi++) {
                  var b = bl[bi];
                  if (Math.abs(b.x - ring.cx) < 0.17 &&
                      b.y > ring.y - 0.24 && b.y < ring.y + 0.14) near.push(b);
                }
                live.obs.push(near);
                for (var oi = 0; oi < near.length; oi++) {
                  if (near[oi].y < ring.y - 0.012) {
                    var la = live.arrivals[live.arrivals.length - 1];
                    if (!la || live.built - la.last > GAP) {
                      live.arrivals.push({ start: live.built, last: live.built });
                    } else {
                      la.last = live.built;
                    }
                    break;
                  }
                }
              }
              // Verdicts only once the ring is STABLE (≥6 color samples,
              // or ~8s of footage on the bbox-fallback ring), and
              // re-classify EVERY closed window each tick with the current
              // ring — early verdicts self-correct as the median converges
              // (a dot may flip color once; the final pass stays authority).
              if (ring.fb ? rows.length < 240 : ringSamples.length < 6) return;
              var shots2 = [];
              for (var wi = 0; wi < live.arrivals.length; wi++) {
                var a = live.arrivals[wi];
                var hasNext = wi + 1 < live.arrivals.length;
                if (!hasNext && rows.length - 1 <= a.start + CAP) break;  // window still open
                var end = hasNext ? Math.min(live.arrivals[wi + 1].start - 1, a.start + CAP)
                                  : a.start + CAP;
                end = Math.min(end, live.obs.length - 1);
                var res = classifyRange(live.obs, ring, a.start, end);
                shots2.push({ t: rows[a.start].t, result: res.v });
              }
              live.shots = shots2;
              self._liveShots = live.shots;
            }

            var dt = 1 / fps;
            var totalFrames = Math.max(1, Math.floor(duration * fps));
            var frame = 0;
            onStage('Analyzing every frame…');
            /* Stuck-watchdog. Court report: "analyze never finishes" -- a
               damaged recording can wedge the seek loop. If no frame
               completes for 25s, fail CLEANLY instead of hanging forever. */
            var lastAdvanceAt = Date.now(), watchdogDead = false;
            var watchdog = setInterval(function () {
              if (Date.now() - lastAdvanceAt > 25000) { clearInterval(watchdog); watchdogDead = true; }
            }, 5000);

            function step() {
              if (signal && signal.aborted) { clearInterval(watchdog); cleanup(); reject(new Error('aborted')); return; }
              if (watchdogDead) { cleanup(); reject(new Error('analysis stalled (unreadable recording)')); return; }
              if (frame >= totalFrames) { clearInterval(watchdog); finishRun(); return; }
              lastAdvanceAt = Date.now();
              var t = Math.min(duration - 0.001, frame * dt);
              seekTo(video, t).then(function () {
                return eng.processFrameOffline();
              }).then(function () {
                // ── p14: rim-zoom GAP-FILLER ─────────────────────
                // Portrait/distant footage shrinks the ball below the
                // model's resolution in the full-frame pass (measured:
                // ZERO detections during the through-rim moment). When a
                // ring estimate exists and this frame produced no ball
                // near it, run a second inference on an upscaled square
                // crop around the ring and merge the finds. Frames that
                // already have rim-area evidence skip this entirely, so
                // validated footage keeps its exact evidence base.
                var ringNow = live.ring;
                // Panning: the static live-ring lags the hoop — center the
                // zoom crop on the RECENT hoop position instead.
                if (isPanning() && hoopPx.length >= 8) {
                  var rec = hoopPx.slice(-15);
                  var pwR = eng._procW || pwLast, phR = eng._procH || phLast;
                  ringNow = {
                    cx: median(rec.map(function (h) { return h.cx; })) / pwR,
                    y:  median(rec.map(function (h) { return h.cy; })) / phR - 0.03,
                    halfW: (live.ring && live.ring.halfW) || 0.03,
                    fb: true
                  };
                }
                if (ringNow && lastDets && eng.detectBallsInRegionOffline) {
                  var hasNear = lastDets.balls.some(function (b) {
                    return Math.abs(b.x - ringNow.cx) < 0.17 &&
                           b.y > ringNow.y - 0.24 && b.y < ringNow.y + 0.14;
                  });
                  // Panning (track mode): ALWAYS zoom. The net-occluded ball
                  // scores 0.02-0.06 and only the upscaled crop sees it; a
                  // second ball or foliage in the full frame must not skip
                  // the zoom (it ate the make evidence at 9.3s on the night
                  // video). Static footage keeps gap-fill-only so the
                  // validated dish/pullups evidence base stays identical.
                  if (!hasNear || isPanning()) {
                    var vw5 = video.videoWidth || 1, vh5 = video.videoHeight || 1;
                    var sidePx = Math.min(vw5, vh5) / 2;
                    var swN = sidePx / vw5, shN = sidePx / vh5;
                    var sxN = Math.max(0, Math.min(1 - swN, ringNow.cx - swN / 2));
                    var syN = Math.max(0, Math.min(1 - shN, ringNow.y - shN * 0.45));
                    return eng.detectBallsInRegionOffline(sxN, syN, swN, shN,
                                                          isPanning() ? 0.012 : 0.02).then(function (zb) {
                      if (zb && zb.length && rows.length) {
                        var row5 = rows[rows.length - 1];
                        for (var zi = 0; zi < zb.length; zi++) row5.balls.push(zb[zi]);
                      }
                    });
                  }
                }
              }).then(function () {
                // Ring measurement every ~24 frames — at NATIVE resolution
                // straight from the video element (the frame is still on
                // this timestamp after processFrameOffline resolves).
                if (frame % 24 === 0 && ringSamples.length < 15) {
                  var hp = strongHoops();
                  if (hp.length >= 8) {
                    var pw2 = eng._procW || pwLast, ph2 = eng._procH || phLast;
                    var sx2 = (video.videoWidth || pw2) / pw2;
                    var sy2 = (video.videoHeight || ph2) / ph2;
                    // Panning: the scan box must FOLLOW the hoop (recent
                    // window), else the all-time median box drifts off the
                    // rim. Static footage keeps the all-time median so the
                    // validated behavior is byte-identical.
                    var src = isPanning() ? hp.slice(-15) : hp;
                    var bcx2 = median(src.map(function (h) { return h.cx; }));
                    var bcy2 = median(src.map(function (h) { return h.cy; }));
                    var boxFull = {
                      cx: bcx2 * sx2,
                      cy: bcy2 * sy2,
                      bw: median(src.map(function (h) { return h.bw; })) * sx2,
                      bh: median(src.map(function (h) { return h.bh; })) * sy2
                    };
                    var s = scanRingFull(video, boxFull);
                    if (s) {
                      // Reference for track mode: offsets are measured
                      // relative to the box the sample was taken around.
                      s.fi = frame; s.refCx = bcx2 / pw2; s.refCy = bcy2 / ph2;
                      ringSamples.push(s);
                    }
                  }
                }
                liveTick();
                if (onFrame) {
                  onFrame({
                    video: video,
                    t: rows.length ? rows[rows.length - 1].t : t,
                    frac: (frame + 1) / totalFrames,
                    dets: lastDets,
                    ring: live.ring,
                    shots: live.shots
                  });
                }
                frame++;
                if (frame % 4 === 0) onProgress(frame / totalFrames);
                // No setTimeout yield — background tabs clamp timers to
                // ≥1s (froze processing whenever the tab/app lost focus).
                // The 'seeked' event already yields to the event loop
                // every frame, so the UI stays responsive without timers.
                step();
              }).catch(function () { frame++; step(); });
            }

            function finishRun() {
              onProgress(1);
              onStage('Classifying shots…');

              // ── Ring geometry (same rules as the live layer) ──
              var ring = ringFromSamples();
              var hpFinal = strongHoops();
              if (!ring && hpFinal.length >= 5) {
                // Fallback: bbox median + colorRefined ring rows. The bbox
                // hugs rim+net, so the ring x-span ≈ 0.72 of the box width
                // (measured on eval footage) and the ring line sits at the
                // colorRefined row (or just under the box top).
                var pw = eng._procW || pwLast, ph = eng._procH || phLast;
                var bcx = median(hpFinal.map(function (h) { return h.cx; })) / pw;
                var bcy = median(hpFinal.map(function (h) { return h.cy; })) / ph;
                var bbw = median(hpFinal.map(function (h) { return h.bw; })) / pw;
                var bbh = median(hpFinal.map(function (h) { return h.bh; })) / ph;
                var ringY = crHoopY.length >= 3 ? median(crHoopY) : (bcy - bbh / 2 + bbh * 0.15);
                ring = { y: ringY, cx: bcx, halfW: bbw * 0.5 * 0.72 };
              }

              var maxConf = 0;
              for (var mi = 0; mi < hoopPx.length; mi++) if (hoopPx[mi].s > maxConf) maxConf = hoopPx[mi].s;
              var diag = {
                frames: rows.length, hoopDetections: hoopPx.length,
                hoopHiConf: hoopPx.filter(function (h) { return h.s >= 0.30; }).length,
                hoopMaxConf: +maxConf.toFixed(3),
                usedTier: (function () {
                  var hi = 0, mid = 0;
                  for (var ti = 0; ti < hoopPx.length; ti++) {
                    if (hoopPx[ti].s >= 0.30) hi++;
                    if (hoopPx[ti].s >= 0.15) mid++;
                  }
                  return hi >= 8 ? 'hi' : (mid >= 8 ? 'mid' : 'all');
                })(),
                ringSamples: ringSamples.length, rimLocked: !!ring,
                ring: ring
              };
              // frames:0 forensics (device 2026-07-23): name the per-frame
              // failure instead of dying silently, and phone it home.
              diag.offlineErr = eng._offlineFirstErr || null;
              diag.offlineErrN = eng._offlineErrN || 0;
              diag.taintFixed = taintFixed;
              if (!rows.length && window.V12Telemetry) {
                try {
                  V12Telemetry.report('analyze zero-frames: ' +
                    (eng._offlineFirstErr || 'no per-frame error') +
                    ' ×' + (eng._offlineErrN || 0) +
                    ' · taintFixed=' + taintFixed +
                    ' · dur=' + Math.round(duration) + 's', null);
                } catch (e) {}
              }
              try { console.log('[OfflineProcessor] pass2 —', JSON.stringify(diag)); } catch (e) {}

              if (!ring) {
                // No ring -> no verdicts possible. Say how much raw ball
                // signal existed so a remote report can tell a hoop failure
                // from a ball failure.
                var rawBallF = 0;
                for (var rbi = 0; rbi < rows.length; rbi++) if (rows[rbi].balls.length) rawBallF++;
                diag.rawBallFrames = rawBallF;
                cleanup();
                resolve({ shots: [], total: 0, made: 0, missed: 0, rawTotal: 0,
                          duration: duration, frames: rows.length, rim: null, diag: diag });
                return;
              }

              // ── Rim-area observations + windows ───────────────
              var NEAR_X = 0.17, NEAR_ABOVE = 0.24, NEAR_BELOW = 0.14, ABOVE_EPS = 0.012;
              var GAP = Math.round(0.8 * fps), CAP = Math.round(2.6 * fps);
              var trackMode = isPanning();
              var ringAtF = null;   // per-frame ring (track mode only)
              diag.mode = trackMode ? 'track' : 'static';
              diag.panSpread = +panSpread().toFixed(3);

              if (trackMode) {
                // ── TRACK MODE (panning camera) ──────────────────
                // Per-frame ring follows a smoothed hoop track; verdict
                // rules are hardened for open-court play (held balls,
                // side bounces). Calibrated on the night video: attempts
                // 12/12 vs hand GT.
                var bestByF = {};
                for (var hi2 = 0; hi2 < hoopPx.length; hi2++) {
                  var hh2 = hoopPx[hi2];
                  if (hh2.fi == null) continue;
                  if (!bestByF[hh2.fi] || hh2.s > bestByF[hh2.fi].s) bestByF[hh2.fi] = hh2;
                }
                var pwT = eng._procW || pwLast, phT = eng._procH || phLast;
                var oIdx = Object.keys(bestByF).map(Number).sort(function (a, b) { return a - b; });
                // median smooth (±8 observed neighbours) then interpolate
                var smx = {}, smy = {};
                for (var s1 = 0; s1 < oIdx.length; s1++) {
                  var wx = [], wy = [];
                  for (var s2 = Math.max(0, s1 - 8); s2 <= Math.min(oIdx.length - 1, s1 + 8); s2++) {
                    wx.push(bestByF[oIdx[s2]].cx); wy.push(bestByF[oIdx[s2]].cy);
                  }
                  smx[oIdx[s1]] = median(wx) / pwT; smy[oIdx[s1]] = median(wy) / phT;
                }
                var trX = new Array(rows.length), trY = new Array(rows.length);
                var lo = 0;
                for (var fT = 0; fT < rows.length; fT++) {
                  while (lo + 1 < oIdx.length && oIdx[lo + 1] <= fT) lo++;
                  var a2 = oIdx[Math.max(0, Math.min(lo, oIdx.length - 1))];
                  var b2 = oIdx[Math.max(0, Math.min(lo + 1, oIdx.length - 1))];
                  if (fT <= oIdx[0]) { trX[fT] = smx[oIdx[0]]; trY[fT] = smy[oIdx[0]]; }
                  else if (fT >= oIdx[oIdx.length - 1]) { trX[fT] = smx[oIdx[oIdx.length-1]]; trY[fT] = smy[oIdx[oIdx.length-1]]; }
                  else {
                    var tt = (fT - a2) / Math.max(1, b2 - a2);
                    trX[fT] = smx[a2] + tt * (smx[b2] - smx[a2]);
                    trY[fT] = smy[a2] + tt * (smy[b2] - smy[a2]);
                  }
                }
                // ring offsets from pan-following color samples
                var DY, DX, HALFT;
                var offs = ringSamples.filter(function (s) { return s.fi != null && s.refCy != null; });
                if (offs.length >= 3) {
                  DY = median(offs.map(function (s) { return s.y - s.refCy; }));
                  DX = median(offs.map(function (s) { return (s.left + s.right) / 2 - s.refCx; }));
                  HALFT = Math.max(median(offs.map(function (s) { return (s.right - s.left) / 2; })), 0.03);
                } else {
                  var bhT = median(hoopPx.map(function (h) { return h.bh; })) / phT;
                  DY = -bhT * 0.35; DX = 0;
                  HALFT = Math.max((median(hoopPx.map(function (h) { return h.bw; })) / pwT) * 0.5 * 0.72 * 0.8, 0.03);
                }
                ringAtF = function (i) {
                  var ii = Math.max(0, Math.min(rows.length - 1, i));
                  return { cx: trX[ii] + DX, y: trY[ii] + DY, halfW: HALFT };
                };
                ring = ringAtF(Math.floor(rows.length / 2));   // diag/zones anchor
              }

              function ringOf(i) { return trackMode ? ringAtF(i) : ring; }

              // Chain selection: v7 net-physics ONLY for track mode (panning
              // camera). A rim-scale arm (halfW < 0.040 → v7) was trialed and
              // REJECTED: the in-app ring scan under-measures big rims (dish
              // scans 0.0387 despite its ~0.047 visual width; pullups-class
              // scans 0.026) and misrouted static footage off the
              // classifyRange path that is validated 14/14 (dish) and 7/8
              // (portrait). Static camera → classifyRange, always, until the
              // ring measurement is bbox-corroborated (lab experiment only).
              var v7Mode = trackMode;

              var obs = [];   // index-aligned with rows: array of [{x,y,s}] near rim
              for (var ri = 0; ri < rows.length; ri++) {
                var near = [];
                var bl = rows[ri].balls;
                var rg = ringOf(ri);
                for (var bi = 0; bi < bl.length; bi++) {
                  var b = bl[bi];
                  if (Math.abs(b.x - rg.cx) < NEAR_X &&
                      b.y > rg.y - NEAR_ABOVE && b.y < rg.y + NEAR_BELOW) near.push(b);
                }
                obs.push(near);
              }
              // Bridge short detection dropouts at the rim so a make whose
              // through-rim frames vanished still shows a continuous crossing
              // (see bridgeTrackGaps — validated 15/17 → 16/17 on GT).
              bridgeTrackGaps(obs, rows.length, 8, 0.12);

              // Global fixture map (v7 mode): the net-knot detects as a
              // "ball" in up to ~1/3 of ALL frames at a fixed ring-relative
              // spot. Grid cells firing in ≥8% of frames are static structure
              // (night_c's knot fired 11.5% — just under the old 12% gate and
              // produced a false make via identity switch); their obs only
              // count as a real ball when the score clearly exceeds the
              // cell's own baseline (2.5× median, floor 0.10).
              var FIX = [];
              if (v7Mode) {
                var CELLW = 0.015, cellHits = {}, cellScores = {};
                for (var fx1 = 0; fx1 < rows.length; fx1++) {
                  var rgF = ringOf(fx1), seenF = {};
                  for (var fx2 = 0; fx2 < obs[fx1].length; fx2++) {
                    var kx = Math.round((obs[fx1][fx2].x - rgF.cx) / CELLW);
                    var ky = Math.round((obs[fx1][fx2].y - rgF.y) / CELLW);
                    var key = kx + ',' + ky;
                    (cellScores[key] = cellScores[key] || []).push(obs[fx1][fx2].s);
                    if (!seenF[key]) { seenF[key] = 1; cellHits[key] = (cellHits[key] || 0) + 1; }
                  }
                }
                Object.keys(cellHits).forEach(function (key) {
                  if (cellHits[key] >= 0.08 * rows.length) {
                    var kp = key.split(',');
                    FIX.push({ dx: parseInt(kp[0], 10) * CELLW,
                               dy: parseInt(kp[1], 10) * CELLW,
                               ms: median(cellScores[key]) });
                  }
                });
              }
              diag.fixtures = FIX.length;
              diag.chain = v7Mode ? 'v7' : 'static';
              function inFixCell(dx, dy, s) {
                // Proximity 0.012 (was 0.02): the v7m5-era knot is spatially
                // tight and the wide radius ate REAL ball obs crossing the
                // ring plane (night 33.1s make lost). Validated 7/7 on both
                // v6 dumps and recovers the make on the v7m5 dump.
                for (var f5 = 0; f5 < FIX.length; f5++) {
                  if (Math.abs(dx - FIX[f5].dx) <= 0.012 && Math.abs(dy - FIX[f5].dy) <= 0.012 &&
                      s <= Math.max(2.5 * FIX[f5].ms, 0.10)) return true;
                }
                return false;
              }
              // M6 recal (2026-07-23): a NET-KNOT fixture at ring center ate
              // the through-net evidence of real makes on the user's court
              // (uc15 10/17→12/17). The knot is STATIC; the ball MOVES — an
              // obs that CONTINUES a trajectory from outside the fixture
              // cells escapes suppression.
              var fixContinuing = [];
              if (v7Mode && FIX.length) {
                for (var cf = 0; cf < rows.length; cf++) {
                  var contSet = null;
                  var rgCf = ringOf(cf);
                  for (var co = 0; co < obs[cf].length; co++) {
                    var oc = obs[cf][co];
                    if (!inFixCell(oc.x - rgCf.cx, oc.y - rgCf.y, oc.s)) continue;
                    var hit = false;
                    for (var pf = cf - 1; pf >= Math.max(0, cf - 2) && !hit; pf--) {
                      var rgPf = ringOf(pf);
                      for (var po = 0; po < obs[pf].length; po++) {
                        var pp = obs[pf][po];
                        if (inFixCell(pp.x - rgPf.cx, pp.y - rgPf.y, pp.s)) continue;
                        if (pp.s >= 0.10 && Math.abs(pp.x - oc.x) <= 0.035 &&
                            Math.abs(pp.y - oc.y) <= 0.035) { hit = true; break; }
                      }
                    }
                    if (hit) {
                      if (!contSet) contSet = {};
                      contSet[oc.x.toFixed(4) + ',' + oc.y.toFixed(4)] = 1;
                    }
                  }
                  fixContinuing.push(contSet);
                }
              }
              function isFixture(dx, dy, s, fi) {
                if (!inFixCell(dx, dy, s)) return false;
                if (fi !== undefined && fixContinuing[fi]) {
                  var rgFi = ringOf(fi);
                  if (fixContinuing[fi][(dx + rgFi.cx).toFixed(4) + ',' + (dy + rgFi.y).toFixed(4)]) return false;
                }
                return true;
              }

              // ── Arrivals → attempt windows ─────────────────────
              // Fixture obs never open an attempt: a knot/rim-arc det that
              // jitters above the ring plane with track wobble used to spawn
              // phantom windows (night_d 18.9s).
              var aboveIdx = [];
              for (var ai = 0; ai < rows.length; ai++) {
                var rgA = ringOf(ai);
                for (var oi = 0; oi < obs[ai].length; oi++) {
                  var oA = obs[ai][oi];
                  if (oA.y >= rgA.y - ABOVE_EPS) continue;
                  if (isFixture(oA.x - rgA.cx, oA.y - rgA.y, oA.s)) continue;
                  aboveIdx.push(ai); break;
                }
              }
              var arrivals = [];
              for (var gi = 0; gi < aboveIdx.length; gi++) {
                var fi2 = aboveIdx[gi];
                if (!arrivals.length || fi2 - arrivals[arrivals.length - 1].last > GAP) {
                  arrivals.push({ start: fi2, last: fi2 });
                } else {
                  arrivals[arrivals.length - 1].last = fi2;
                }
              }
              var windows = arrivals.map(function (a, i) {
                var end = (i + 1 < arrivals.length) ? arrivals[i + 1].start - 1 : rows.length - 1;
                return [a.start, Math.min(end, a.start + CAP)];
              });
              // Ball-signal census for the zero-shots diagnostic: rim locked
              // but 0 windows means the ball was never seen ABOVE the ring —
              // these numbers separate "no ball detections at all" from
              // "ball seen near the rim but never above the plane".
              var nearBallF = 0, rawBallF2 = 0;
              for (var bfi = 0; bfi < rows.length; bfi++) {
                if (rows[bfi].balls.length) rawBallF2++;
                if (obs[bfi].length) nearBallF++;
              }
              diag.rawBallFrames  = rawBallF2;
              diag.nearRimFrames  = nearBallF;
              diag.aboveRingFrames = aboveIdx.length;
              diag.windows = windows.length;

              // ── Verdicts ───────────────────────────────────────
              function bestObs(i) {
                var arr = obs[i];
                if (!arr.length) return null;
                var best = arr[0];
                for (var k = 1; k < arr.length; k++) if (arr[k].s > best.s) best = arr[k];
                return best;
              }
              function classify(f0, f1) {
                if (!v7Mode) return classifyRange(obs, ring, f0, f1);
                // v7-MODE verdicts — validated 7/7 against frame-verified GT
                // on the night video via replay of the app's own detections
                // (scratch/replay_v7.py), then hardened on night_c to 5/6
                // with zero false-makes (scratch/score_batch.py):
                //   ENTRY (descent into the cone) → no DEPARTURE (a NEW
                //   lateral object at ring height = the ball escaping; a
                //   second ball already tracked there is exempt) → DWELL
                //   (non-fixture, slow-drift band obs; only the net stops
                //   a ball mid-air) of ≥3 frames OR an EXIT-CLOSE (descent
                //   chain below the net to dy≥+0.085 inside |dx|≤0.08) →
                //   no RE-RISE (rim rattles pop back up).
                var lim = Math.min(f1 + 1, rows.length);
                for (var a = f0; a < lim; a++) {
                  var rgA = ringOf(a);
                  var ent = null;
                  for (var e1 = 0; e1 < obs[a].length; e1++) {
                    var p = obs[a][e1];
                    var ady = p.y - rgA.y;
                    if (ady >= -0.13 && ady <= -0.012 && Math.abs(p.x - rgA.cx) <= 0.09) {
                      if (!ent || p.s > ent.s) ent = p;
                    }
                  }
                  if (!ent) continue;
                  // departure: new lateral object right after entry, no predecessor
                  var dep = false;
                  for (var k1 = a + 1; k1 < Math.min(a + 7, lim) && !dep; k1++) {
                    var rgK1 = ringOf(k1);
                    for (var q1 = 0; q1 < obs[k1].length; q1++) {
                      var q = obs[k1][q1];
                      var qdx = q.x - rgK1.cx, qdy = q.y - rgK1.y;
                      if (!(Math.abs(qdx) >= 0.07 && Math.abs(qdx) <= 0.14 &&
                            qdy >= -0.05 && qdy <= 0.05 && q.s >= 0.03)) continue;
                      if (Math.abs(q.x - ent.x) > 0.05 * (k1 - a) + 0.02) continue;
                      var pre = false;
                      for (var j1 = Math.max(0, a - 3); j1 <= a && !pre; j1++) {
                        for (var j2 = 0; j2 < obs[j1].length; j2++) {
                          if (Math.abs(obs[j1][j2].x - q.x) <= 0.05 &&
                              Math.abs(obs[j1][j2].y - q.y) <= 0.08) { pre = true; break; }
                        }
                      }
                      if (!pre) { dep = true; break; }
                    }
                  }
                  if (dep) continue;
                  // dwell: non-fixture band obs within 5f, x-continuous with entry
                  for (var b1 = a + 1; b1 < Math.min(a + 6, lim); b1++) {
                    var rgB = ringOf(b1);
                    for (var o1 = 0; o1 < obs[b1].length; o1++) {
                      var o = obs[b1][o1];
                      var dx = o.x - rgB.cx, dy = o.y - rgB.y;
                      if (dy < -0.015 || dy > 0.055 || Math.abs(dx) > 0.05) continue;
                      if (Math.abs(o.x - ent.x) > 0.06) continue;
                      if (isFixture(dx, dy, o.s, b1)) continue;
                      var runLen = 1, lastF = b1, lastO = o;
                      var runMinDx = dx, runMaxDx = dx;
                      var runMinDy = dy, runMaxDy = dy;
                      for (var k2 = b1 + 1; k2 < Math.min(b1 + 16, lim); k2++) {
                        if (k2 - lastF > 3) break;
                        var rgK2 = ringOf(k2), best = null, bestDx = 0, bestDy = 0;
                        for (var q4 = 0; q4 < obs[k2].length; q4++) {
                          var c = obs[k2][q4];
                          var cdx = c.x - rgK2.cx, cdy = c.y - rgK2.y;
                          if (cdy < -0.015 || cdy > 0.055 || Math.abs(cdx) > 0.05) continue;
                          if (isFixture(cdx, cdy, c.s, k2)) continue;
                          var steps = k2 - lastF;
                          if (Math.abs(c.y - lastO.y) > 0.014 * steps ||
                              Math.abs(c.x - lastO.x) > 0.02 * steps) continue;
                          if (!best || c.s > best.s) { best = c; bestDx = cdx; bestDy = cdy; }
                        }
                        if (best) {
                          runLen++; lastF = k2; lastO = best;
                          if (bestDx < runMinDx) runMinDx = bestDx;
                          if (bestDx > runMaxDx) runMaxDx = bestDx;
                          if (bestDy < runMinDy) runMinDy = bestDy;
                          if (bestDy > runMaxDy) runMaxDy = bestDy;
                        }
                      }
                      // exit-close: descent chain below the net
                      var exitok = false, cur = lastO, curF = lastF;
                      for (var k3 = lastF + 1; k3 < Math.min(lastF + 8, lim); k3++) {
                        if (k3 - curF > 3) break;
                        var rgK3 = ringOf(k3), best2 = null;
                        for (var q5 = 0; q5 < obs[k3].length; q5++) {
                          var c2 = obs[k3][q5], st2 = k3 - curF;
                          if (Math.abs(c2.x - cur.x) > 0.06 * st2) continue;
                          if (!((c2.y - cur.y) >= 0.010 * st2)) continue;
                          // M6 recal: exit cone tightened 0.08→0.05 — miss
                          // deflections descend OUTSIDE the funnel (night_c
                          // 4.8/11.9 exit-side false-makes)
                          if (Math.abs(c2.x - rgK3.cx) > 0.05) continue;
                          if (!best2 || c2.s > best2.s) best2 = c2;
                        }
                        if (!best2) continue;
                        cur = best2; curF = k3;
                        if (cur.y - rgK3.y >= 0.085) { exitok = true; break; }
                      }
                      if (runLen < 3 && !exitok) continue;
                      // M6 recal: a no-exit dwell must actually DESCEND into
                      // the net — reach depth (night_d 13.4 FM never crossed
                      // the ring plane) and progress rather than hover
                      // (night_c 6.8 FM: dy 0.044±0.002 for 6 frames)
                      if (!exitok) {
                        if (runMaxDy < 0.03) continue;
                        if (runMaxDy - runMinDy < 0.015) continue;
                      }
                      // end-centering: a net-braked ball ENDS centered in the
                      // cone; a rim roll-off ends at the band edge before the
                      // side drop (night_c 5.6s false-make signature)
                      if (!exitok && Math.abs(lastO.x - ringOf(lastF).cx) > 0.035) continue;
                      // run x-span cap: a braked ball stays inside the net
                      // cone; a wide span means the run identity-switched to
                      // another object across a frame gap
                      if (runMaxDx - runMinDx > 0.032) continue;
                      // re-rise kill
                      var rise = false;
                      for (var k4 = lastF + 1; k4 < Math.min(lastF + 7, lim) && !rise; k4++) {
                        var rgK4 = ringOf(k4);
                        for (var q6 = 0; q6 < obs[k4].length; q6++) {
                          if (obs[k4][q6].s >= 0.04 &&
                              (obs[k4][q6].y - rgK4.y) <= -0.025 &&
                              Math.abs(obs[k4][q6].x - lastO.x) <= 0.06) { rise = true; break; }
                        }
                      }
                      if (rise) continue;
                      return { v: 'made', why: 'dwell ' + a + '->' + b1 + '..' + lastF +
                                              ' (' + runLen + 'f' + (exitok ? '+exit' : '') + ')' };
                    }
                  }
                }
                return { v: 'missed', why: 'no through (v7)' };
              }

              // ── Build shot records ─────────────────────────────
              var rimZoneObj = { centerX: ring.cx, centerY: ring.y,
                                 width: ring.halfW * 2, height: 0.04 };
              var shots = [];
              for (var wi = 0; wi < windows.length; wi++) {
                var w0 = windows[wi][0], w1 = windows[wi][1];
                var res = classify(w0, w1);
                var tShot = rows[w0].t;
                // shooter position: best player det shortly before arrival
                var pf0 = Math.max(0, w0 - Math.round(0.9 * fps));
                var pf1 = Math.max(0, w0 - Math.round(0.1 * fps));
                var feet = null, bestS = 0;
                for (var pi2 = pf0; pi2 <= pf1 && pi2 < rows.length; pi2++) {
                  var pl = rows[pi2].players;
                  for (var pj = 0; pj < pl.length; pj++) {
                    if (pl[pj].s > bestS) { bestS = pl[pj].s; feet = pl[pj]; }
                  }
                }
                var feetX = feet ? feet.x : ring.cx - 0.35;
                var feetY = feet ? Math.min(1, feet.y + feet.h / 2) : 0.9;
                var v10Zone = 'PNT', shotZone = 'paint';
                try {
                  if (eng._classifyV10Zone)  v10Zone  = eng._classifyV10Zone(feetX, feetY, rimZoneObj, eng.threePtDistance || 0) || v10Zone;
                  if (eng._classifyShotZone) shotZone = eng._classifyShotZone({ x: feetX, y: feetY }, rimZoneObj, eng.threePtDistance || 0) || shotZone;
                } catch (e) { /* zones are cosmetic */ }
                // Court calibration (when present): true court coords + real
                // distance from the shooter's feet; overrides the image-space
                // zone heuristic. See courtPosition.js.
                var court = null;
                try {
                  if (window.CourtPosition && window.CourtPosition.isCalibrated()) {
                    court = window.CourtPosition.locate(feetX, feetY);
                    if (court) v10Zone = court.zone;
                  }
                } catch (e) { court = null; }
                // small trajectory record: rim-area best obs across the window
                var traj = [];
                for (var ti = w0; ti <= w1 && traj.length < 40; ti++) {
                  var tb = bestObs(ti);
                  if (tb) traj.push({ x: +tb.x.toFixed(4), y: +tb.y.toFixed(4), t: +rows[ti].t.toFixed(3) });
                }
                shots.push({
                  result: res.v,
                  why: res.why,
                  shotX: feetX, shotY: feetY,
                  launchPoint: { x: feetX, y: feetY },
                  v10Zone: v10Zone, shotZone: shotZone,
                  courtX: court ? +court.x.toFixed(2) : null,
                  courtZ: court ? +court.z.toFixed(2) : null,
                  shotDistM: court ? +court.dist.toFixed(2) : null,
                  trajectory: traj,
                  __videoT: tShot,
                  triggerSrc: 'offline-timeline'
                });
              }

              diag.attempts = shots.length;
              diag.verdicts = shots.map(function (s) {
                return (s.__videoT).toFixed(1) + (s.result === 'made' ? 'M' : 'X');
              }).join(' ');
              // Debug data export (set window.__opDebug = true BEFORE the
              // run): full evidence base for offline re-analysis — lets the
              // Python lab replay the exact rules on the APP's detections.
              try {
                if (typeof window !== 'undefined' && window.__opDebug) {
                  window.__opDump = {
                    mode: diag.mode, panSpread: diag.panSpread,
                    windows: windows, fps: fps,
                    ring: ring,
                    rings: (function () {
                      var out = [];
                      for (var di = 0; di < rows.length; di++) {
                        var rgD = ringOf(di);
                        out.push([+rgD.cx.toFixed(4), +rgD.y.toFixed(4)]);
                      }
                      return out;
                    })(),
                    halfW: ringOf(0).halfW,
                    balls: rows.map(function (r) {
                      return r.balls.map(function (b) {
                        return [+b.x.toFixed(4), +b.y.toFixed(4), +b.s.toFixed(3)];
                      });
                    })
                  };
                }
              } catch (e) {}
              try {
                console.log('[OfflineProcessor] shots —',
                  shots.map(function (s) { return (s.__videoT).toFixed(1) + 's:' + (s.result === 'made' ? 'M' : 'X') + ' (' + s.why + ')'; }).join(' | '));
              } catch (e) {}

              cleanup();
              resolve({
                shots: shots,
                total: shots.length,
                made: shots.filter(function (s) { return s.result === 'made'; }).length,
                missed: shots.filter(function (s) { return s.result === 'missed'; }).length,
                rawTotal: shots.length,
                duration: duration,
                frames: rows.length,
                rim: { x: ring.cx, y: ring.y, w: ring.halfW * 2, h: 0.04 },
                diag: diag
              });
            }

            step();
          }).catch(fail);
        };

        // ── Robust video readiness ────────────────────────────────
        // A hidden tab (user switched apps right after uploading) defers
        // media loading — 'loadeddata' may NEVER fire. A muted play()
        // kick forces the media pipeline to spin up even in background;
        // multiple ready events + a readyState poll cover the rest.
        var started = false;
        /* MediaRecorder webm (a recorded live session) ships WITHOUT a
           duration header — video.duration reads Infinity, which slipped
           past the falsy check, made totalFrames Infinity, pinned progress
           at 0 and turned the seek loop non-terminating. The standard
           repair: seek far past the end once; the browser scans the file,
           fires durationchange with the real length, and everything
           downstream works unchanged. One attempt only — if the duration
           still is not finite, run() now fails it cleanly. */
        var durationFixTried = false;
        var taintFixTried = false, taintFixed = false;
        function fixInfiniteDuration() {
          durationFixTried = true;
          var done = false;
          function finish() {
            if (done) return;
            done = true;
            try { video.currentTime = 0; } catch (e) {}
            tryRun();
          }
          video.addEventListener('durationchange', function dc() {
            if (isFinite(video.duration)) {
              video.removeEventListener('durationchange', dc);
              finish();
            }
          });
          try { video.currentTime = 1e9; } catch (e) { finish(); return; }
          setTimeout(finish, 4000);   // stall guard — proceed and let run() judge
        }
        function tryRun() {
          if (started) return;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            if (!isFinite(video.duration) && !durationFixTried) { fixInfiniteDuration(); return; }
            started = true;
            try { video.pause(); } catch (e) {}
            try { video.currentTime = 0; } catch (e) {}
            run();
          }
        }
        video.addEventListener('loadeddata', tryRun);
        video.addEventListener('loadedmetadata', tryRun);
        video.addEventListener('canplay', tryRun);
        video.addEventListener('playing', tryRun);
        video.addEventListener('error', function () {
          if (!started) fail(new Error('could not load video for offline processing'));
        }, { once: true });
        try { video.load(); } catch (e) {}
        try {
          var kick = video.play();
          if (kick && kick.then) kick.then(function () { tryRun(); }).catch(function () {});
        } catch (e) {}
        var readyPoll = setInterval(function () {
          if (started || (signal && signal.aborted)) { clearInterval(readyPoll); return; }
          tryRun();
        }, 500);
      });
    }
  };

  window.ShotOfflineProcessor = ShotOfflineProcessor;
})();
