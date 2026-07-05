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
    // 1) downward ring-plane crossings within the ring span
    var prevF = -1, prevB = null;
    for (var i = f0; i <= f1; i++) {
      var b = bestOf(i);
      if (!b) continue;
      if (prevB && (i - prevF) <= 6 && prevB.y < ring.y && b.y >= ring.y) {
        var r = (ring.y - prevB.y) / Math.max(b.y - prevB.y, 1e-6);
        var xAt = prevB.x + r * (b.x - prevB.x);
        if (Math.abs(xAt - ring.cx) <= ring.halfW * 0.95) {
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
            Math.abs(o.x - ring.cx) <= ring.halfW * 0.70) {
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
          if (!duration || !video.videoWidth) { fail(new Error('video has no duration/dimensions')); return; }

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
            if (eng.isRunning) { try { eng.stop(); } catch (e) {} }
            eng._offlineMode = true;
            try { eng.start(video); } catch (e) { fail(e); return; }
            eng._offlineMode = true;
            eng.isRunning = true;

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
                hoopPx.push({ cx: hh.cx, cy: hh.cy, bw: hh.bw, bh: hh.bh, s: hh.score });
                if (hh.colorRefined) crHoopY.push(hh.cy / fd.ph);
              }
            };

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

            function step() {
              if (signal && signal.aborted) { cleanup(); reject(new Error('aborted')); return; }
              if (frame >= totalFrames) { finishRun(); return; }
              var t = Math.min(duration - 0.001, frame * dt);
              seekTo(video, t).then(function () {
                return eng.processFrameOffline();
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
                    var boxFull = {
                      cx: median(hp.map(function (h) { return h.cx; })) * sx2,
                      cy: median(hp.map(function (h) { return h.cy; })) * sy2,
                      bw: median(hp.map(function (h) { return h.bw; })) * sx2,
                      bh: median(hp.map(function (h) { return h.bh; })) * sy2
                    };
                    var s = scanRingFull(video, boxFull);
                    if (s) ringSamples.push(s);
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
              try { console.log('[OfflineProcessor] pass2 —', JSON.stringify(diag)); } catch (e) {}

              if (!ring) {
                cleanup();
                resolve({ shots: [], total: 0, made: 0, missed: 0, rawTotal: 0,
                          duration: duration, frames: rows.length, rim: null, diag: diag });
                return;
              }

              // ── Rim-area observations ─────────────────────────
              var NEAR_X = 0.17, NEAR_ABOVE = 0.24, NEAR_BELOW = 0.14, ABOVE_EPS = 0.012;
              var obs = [];   // index-aligned with rows: array of [{x,y,s}] near rim
              for (var ri = 0; ri < rows.length; ri++) {
                var near = [];
                var bl = rows[ri].balls;
                for (var bi = 0; bi < bl.length; bi++) {
                  var b = bl[bi];
                  if (Math.abs(b.x - ring.cx) < NEAR_X &&
                      b.y > ring.y - NEAR_ABOVE && b.y < ring.y + NEAR_BELOW) near.push(b);
                }
                obs.push(near);
              }

              // ── Arrivals → attempt windows ─────────────────────
              var aboveIdx = [];
              for (var ai = 0; ai < rows.length; ai++) {
                for (var oi = 0; oi < obs[ai].length; oi++) {
                  if (obs[ai][oi].y < ring.y - ABOVE_EPS) { aboveIdx.push(ai); break; }
                }
              }
              var GAP = Math.round(0.8 * fps), CAP = Math.round(2.6 * fps);
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

              // ── Verdicts ───────────────────────────────────────
              function bestObs(i) {
                var arr = obs[i];
                if (!arr.length) return null;
                var best = arr[0];
                for (var k = 1; k < arr.length; k++) if (arr[k].s > best.s) best = arr[k];
                return best;
              }
              function classify(f0, f1) {
                return classifyRange(obs, ring, f0, f1);
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
                  trajectory: traj,
                  __videoT: tShot,
                  triggerSrc: 'offline-timeline'
                });
              }

              diag.attempts = shots.length;
              try {
                console.log('[OfflineProcessor] shots —',
                  shots.map(function (s) { return (s.__videoT).toFixed(1) + 's:' + (s.result === 'made' ? 'M' : 'X'); }).join(' '));
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
        function tryRun() {
          if (started) return;
          if (video.readyState >= 2 && video.videoWidth > 0) {
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
