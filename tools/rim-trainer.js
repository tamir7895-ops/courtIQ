/* ══════════════════════════════════════════════════════════════
   CourtIQ Rim Trainer — learn rim appearance from internet videos

   Outputs:
   ─ localStorage['courtiq-rim-model'] — rim color + geometry model
   ─ IndexedDB 'courtiq-rim-training'/'rim-patches' — 64px rim crops

   The model is automatically read by ai-shot-tracker.js to:
     1. Update RIM_RX_FRAC with the learned typical rim half-width
     2. Use learned RGB bounds in isRimColor() for better detection
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var STORAGE_KEY_RIM = 'courtiq-rim-model';
  var IDB_NAME        = 'courtiq-rim-training';
  var IDB_STORE       = 'rim-patches';
  var IDB_VERSION     = 1;

  /* ── State ──────────────────────────────────────────────────── */
  var videoUrls          = [];
  var stopFlag           = false;
  var isRunning          = false;
  var db                 = null;
  var startTime          = 0;
  var timerInterval      = null;

  /* Counters / accumulators */
  var totalFrames        = 0;
  var rimSamplesFound    = 0;
  var rimColorSamples    = [];   // [{r,g,b}]
  var rimGeometrySamples = [];   // [{rxFrac, ryFrac, cyFrac, score}]
  var ballVsRimEvents    = [];   // [{type:'made'|'missed', …}]

  /* Per-video shot-labeling state */
  var ballAboveRimSince  = -1;   // frame index when ball was last seen above rim

  /* ── DOM ─────────────────────────────────────────────────────── */
  var logBox        = document.getElementById('logBox');
  var btnStart      = document.getElementById('btnStart');
  var btnStop       = document.getElementById('btnStop');
  var btnClearModel = document.getElementById('btnClearModel');
  var statusDot     = document.getElementById('statusDot');
  var statusText    = document.getElementById('statusText');
  var extractVideo  = document.getElementById('extractVideo');
  var extractCanvas = document.getElementById('extractCanvas');

  /* ══════════════════════════════════════════════════════════════
     LOGGING
     ══════════════════════════════════════════════════════════════ */

  function log(msg, type) {
    var now = new Date();
    var ts  = now.toTimeString().slice(0, 8);
    var line = document.createElement('div');
    line.className = 'log-line log-' + (type || 'info');
    line.innerHTML = '<span class="log-time">' + ts + '</span>' +
                     '<span class="log-msg">'  + msg + '</span>';
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  /* ══════════════════════════════════════════════════════════════
     COLOR DETECTION
     ══════════════════════════════════════════════════════════════ */

  // Rim-specific orange: brighter + more saturated than general orange test.
  // Rim metal paint is bright orange-red: H 8-48, S > 0.33, brightness > 90.
  function isRimOrange(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (max < 90) return false;
    var delta = max - min;
    if (delta < 22) return false;
    var s = delta / max;
    if (s < 0.33) return false;
    var h;
    if (max === r)      h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else                h = 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;
    return h >= 8 && h <= 48;
  }

  // Ball orange (matches ai-shot-tracker.js post-fix version)
  function isBallOrange(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (max < 70) return false;
    var delta = max - min;
    if (delta < 18) return false;
    var s = delta / max;
    if (s < 0.38) return false;
    // Exclude skin tone
    if (r > g && r > b && (r - g) < 80 && (g - b) < 30) return false;
    var h;
    if (max === r)      h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else                h = 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;
    return h >= 10 && h <= 48;
  }

  /* ══════════════════════════════════════════════════════════════
     RIM DETECTION IN FRAME
     Looks for a wide, thin, orange horizontal blob in upper 75%.
     Returns { cx, cy, blobW, blobH, score } or null.
     ══════════════════════════════════════════════════════════════ */

  function detectRimInFrame(data, W, H) {
    var cells    = 32;
    var cw       = Math.floor(W / cells) || 1;
    var ch       = Math.floor(H / cells) || 1;
    var grid     = new Float32Array(cells * cells);
    var scanMaxY = Math.floor(H * 0.75);

    // Build orange-pixel grid
    for (var y = 0; y < scanMaxY; y++) {
      for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 4;
        if (isRimOrange(data[i], data[i + 1], data[i + 2])) {
          var gx = Math.min(Math.floor(x / cw), cells - 1);
          var gy = Math.min(Math.floor(y / ch), cells - 1);
          grid[gy * cells + gx]++;
        }
      }
    }

    var best    = null;
    var visited = new Uint8Array(cells * cells);

    for (var gy = 0; gy < cells; gy++) {
      for (var gx = 0; gx < cells; gx++) {
        var v = grid[gy * cells + gx];
        if (v < 8 || visited[gy * cells + gx]) continue;

        var queue  = [[gx, gy]];
        var pixels = 0;
        var minGx  = gx, maxGx = gx, minGy = gy, maxGy = gy;
        var head   = 0;

        while (head < queue.length) {
          var cell = queue[head++];
          var bx   = cell[0], by = cell[1];
          var key  = by * cells + bx;
          if (visited[key]) continue;
          if (grid[key] < 3) continue;
          visited[key] = 1;
          pixels += grid[key];
          if (bx < minGx) minGx = bx;
          if (bx > maxGx) maxGx = bx;
          if (by < minGy) minGy = by;
          if (by > maxGy) maxGy = by;
          if (bx > 0)         queue.push([bx - 1, by]);
          if (bx < cells - 1) queue.push([bx + 1, by]);
          if (by > 0)         queue.push([bx, by - 1]);
          if (by < cells - 1) queue.push([bx, by + 1]);
        }

        var bW = (maxGx - minGx + 1) * cw;
        var bH = (maxGy - minGy + 1) * ch;

        // Rim must be wider than tall (aspect ≥ 1.5)
        if (bW < bH * 1.5) continue;
        // Size range: 2.5 – 50% of frame width
        if (bW < W * 0.025 || bW > W * 0.50) continue;
        if (bH < 2) continue;

        var aspect = bW / Math.max(bH, 1);
        // Score: prefer wide aspect, many pixels, and reasonable width
        var score = Math.min(aspect / 6.0, 1.0) * 0.40 +
                    Math.min(1.0, pixels / 150) * 0.35 +
                    Math.min(1.0, bW / (W * 0.08)) * 0.25;

        if (!best || score > best.score) {
          best = {
            cx:    ((minGx + maxGx) / 2 + 0.5) * cw,
            cy:    ((minGy + maxGy) / 2 + 0.5) * ch,
            blobW: bW,
            blobH: bH,
            score: score,
            pixels: pixels
          };
        }
      }
    }

    if (!best || best.score < 0.28) return null;
    return best;
  }

  /* ══════════════════════════════════════════════════════════════
     BALL DETECTION IN FRAME (simplified for shot labeling)
     ══════════════════════════════════════════════════════════════ */

  function detectBallInFrame(data, W, H) {
    var cells    = 24;
    var cw       = Math.floor(W / cells) || 1;
    var ch       = Math.floor(H / cells) || 1;
    var grid     = new Float32Array(cells * cells);
    var scanMaxY = Math.floor(H * 0.90);

    for (var y = 0; y < scanMaxY; y++) {
      for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 4;
        if (isBallOrange(data[i], data[i + 1], data[i + 2])) {
          var gx = Math.min(Math.floor(x / cw), cells - 1);
          var gy = Math.min(Math.floor(y / ch), cells - 1);
          grid[gy * cells + gx]++;
        }
      }
    }

    var best    = null;
    var visited = new Uint8Array(cells * cells);

    for (var gy = 0; gy < cells; gy++) {
      for (var gx = 0; gx < cells; gx++) {
        var v = grid[gy * cells + gx];
        if (v < 12 || visited[gy * cells + gx]) continue;

        var queue  = [[gx, gy]];
        var pixels = 0;
        var minGx  = gx, maxGx = gx, minGy = gy, maxGy = gy;
        var head   = 0;

        while (head < queue.length) {
          var cell = queue[head++];
          var bx   = cell[0], by = cell[1];
          var key  = by * cells + bx;
          if (visited[key]) continue;
          if (grid[key] < 4) continue;
          visited[key] = 1;
          pixels += grid[key];
          if (bx < minGx) minGx = bx;
          if (bx > maxGx) maxGx = bx;
          if (by < minGy) minGy = by;
          if (by > maxGy) maxGy = by;
          if (bx > 0)         queue.push([bx - 1, by]);
          if (bx < cells - 1) queue.push([bx + 1, by]);
          if (by > 0)         queue.push([bx, by - 1]);
          if (by < cells - 1) queue.push([bx, by + 1]);
        }

        var bW = (maxGx - minGx + 1) * cw;
        var bH = (maxGy - minGy + 1) * ch;
        if (bW < W * 0.012 || bW > W * 0.20) continue;
        var aspect = Math.max(bW, bH) / Math.max(Math.min(bW, bH), 1);
        if (aspect > 2.8) continue;
        if (pixels < 70) continue;
        var score = Math.min(1, pixels / 200) * 0.6 + (1 / aspect) * 0.4;
        if (!best || score > best.score) {
          best = { x: ((minGx + maxGx) / 2 + 0.5) * cw, y: ((minGy + maxGy) / 2 + 0.5) * ch, w: bW, h: bH, score: score };
        }
      }
    }

    if (!best || best.score < 0.22) return null;
    return best;
  }

  /* ══════════════════════════════════════════════════════════════
     COLOR SAMPLING — sample rim pixels for the color model
     ══════════════════════════════════════════════════════════════ */

  function sampleRimColors(data, W, H, cx, cy, blobW) {
    var stripHalf = Math.min(blobW * 0.30, 32);
    var x0 = Math.max(0, Math.floor(cx - stripHalf));
    var x1 = Math.min(W - 1, Math.floor(cx + stripHalf));
    var y0 = Math.max(0, Math.floor(cy - 5));
    var y1 = Math.min(H - 1, Math.floor(cy + 5));

    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var i = (y * W + x) * 4;
        var r = data[i], g = data[i + 1], b = data[i + 2];
        if (isRimOrange(r, g, b)) {
          rimColorSamples.push({ r: r, g: g, b: b });
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     INDEXEDDB — store 64×64 rim patches
     ══════════════════════════════════════════════════════════════ */

  function openIDB() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }
      var req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains(IDB_STORE)) {
          d.createObjectStore(IDB_STORE, { autoIncrement: true });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror   = function ()  { resolve(null); };
    });
  }

  function saveRimPatch(imageData, cx, cy, score) {
    if (!db) return Promise.resolve();
    var cropSize = 64, half = cropSize / 2;
    var x0 = Math.max(0, Math.floor(cx - half));
    var y0 = Math.max(0, Math.floor(cy - half));
    var w  = Math.min(cropSize, imageData.width  - x0);
    var h  = Math.min(cropSize, imageData.height - y0);
    if (w < 32 || h < 32) return Promise.resolve();

    var srcCanvas = document.createElement('canvas');
    srcCanvas.width = imageData.width; srcCanvas.height = imageData.height;
    srcCanvas.getContext('2d').putImageData(imageData, 0, 0);
    var tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = cropSize; tmpCanvas.height = cropSize;
    tmpCanvas.getContext('2d').drawImage(srcCanvas, x0, y0, cropSize, cropSize, 0, 0, cropSize, cropSize);
    var crop = tmpCanvas.getContext('2d').getImageData(0, 0, cropSize, cropSize);

    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).add({ label: 'rim', score: score, pixels: Array.from(crop.data), ts: Date.now() });
        tx.oncomplete = resolve; tx.onerror = resolve;
      } catch (e) { resolve(); }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     MODEL SAVING — compute and persist rim model
     ══════════════════════════════════════════════════════════════ */

  function saveRimModel() {
    if (rimColorSamples.length < 20) {
      log('⚠️ רק ' + rimColorSamples.length + ' דגימות צבע — צריך ≥20. מודל לא נשמר.', 'warn');
      return null;
    }

    var rs = rimColorSamples.map(function (s) { return s.r; }).sort(function (a, b) { return a - b; });
    var gs = rimColorSamples.map(function (s) { return s.g; }).sort(function (a, b) { return a - b; });
    var bs = rimColorSamples.map(function (s) { return s.b; }).sort(function (a, b) { return a - b; });
    var p5  = Math.floor(rs.length * 0.05);
    var p95 = Math.floor(rs.length * 0.95);

    var rxFracs = rimGeometrySamples.map(function (s) { return s.rxFrac; }).sort(function (a, b) { return a - b; });
    var aspects = rimGeometrySamples.map(function (s) { return s.aspect; }).sort(function (a, b) { return a - b; });
    var cyFracs = rimGeometrySamples.map(function (s) { return s.cyFrac; }).sort(function (a, b) { return a - b; });

    var mid = Math.floor(rxFracs.length / 2);

    var payload = {
      version:        2,
      rMin: Math.max(0,   rs[p5]  - 12),  rMax: Math.min(255, rs[p95] + 12),
      gMin: Math.max(0,   gs[p5]  - 12),  gMax: Math.min(255, gs[p95] + 12),
      bMin: Math.max(0,   bs[p5]  - 10),  bMax: Math.min(255, bs[p95] + 10),
      rxFracMean:  rxFracs.length > 0 ? rxFracs[mid] : 0.065,
      rxFracMin:   rxFracs.length > 0 ? rxFracs[Math.floor(rxFracs.length * 0.10)] : 0.025,
      rxFracMax:   rxFracs.length > 0 ? rxFracs[Math.floor(rxFracs.length * 0.90)] : 0.25,
      aspectMean:  aspects.length > 0 ? aspects[Math.floor(aspects.length / 2)] : 0.38,
      cyFracMean:  cyFracs.length > 0 ? cyFracs[Math.floor(cyFracs.length / 2)] : 0.35,
      confidence:  Math.min(1.0, rimColorSamples.length / 80),
      sampleCount: rimColorSamples.length,
      geoCount:    rimGeometrySamples.length,
      shotEvents:  ballVsRimEvents.length,
      trainedAt:   Date.now()
    };

    try {
      localStorage.setItem(STORAGE_KEY_RIM, JSON.stringify(payload));
      log('✅ מודל טבעת נשמר — ' + rimColorSamples.length + ' צבע | ' + rimGeometrySamples.length + ' גאומטריה', 'ok');
      log('   rxFrac (median): ' + payload.rxFracMean.toFixed(3) +
          ' | aspect: ' + payload.aspectMean.toFixed(2) +
          ' | cy: ' + payload.cyFracMean.toFixed(2) +
          ' | conf: ' + (payload.confidence * 100).toFixed(0) + '%', 'info');
      renderModelBox(payload);
    } catch (e) {
      log('❌ שגיאה בשמירת המודל: ' + e.message, 'err');
    }

    return payload;
  }

  /* ══════════════════════════════════════════════════════════════
     FRAME PROCESSING
     ══════════════════════════════════════════════════════════════ */

  function processFrame(imageData, W, H, videoName, frameIdx, onRimPatch) {
    totalFrames++;
    updateStats();

    var data = imageData.data;

    // 1. Detect rim
    var rim = detectRimInFrame(data, W, H);
    if (rim && rim.score >= 0.30) {
      rimSamplesFound++;
      sampleRimColors(data, W, H, rim.cx, rim.cy, rim.blobW);
      var rx  = rim.blobW / 2;
      var ry  = rim.blobH > 0 ? rim.blobH / 2 : rx * 0.38;
      rimGeometrySamples.push({
        rxFrac: rx / W,
        ryFrac: ry / W,
        aspect: ry > 0 ? rx / ry : 2.6,
        cyFrac: rim.cy / H,
        score:  rim.score,
        videoName: videoName
      });

      // Save patch every ~12th high-confidence rim
      if (rim.score >= 0.45 && rimSamplesFound % 12 === 0) {
        onRimPatch(imageData, rim.cx, rim.cy, rim.score);
      }
    }

    // 2. Detect ball (for shot labeling)
    var ball = null;
    if (rim) {
      ball = detectBallInFrame(data, W, H);
    }

    // 3. Shot labeling: track ball crossing rim plane
    if (rim && ball) {
      var rx   = rim.blobW / 2;
      var ry   = rim.blobH > 0 ? rim.blobH / 2 : rx * 0.38;
      var inH  = Math.abs(ball.x - rim.cx) < rx * 1.2;
      var above = ball.y < rim.cy - ry * 0.3;
      var below = ball.y > rim.cy + ry * 2.0;

      if (above && inH) {
        ballAboveRimSince = frameIdx;
      } else if (below && inH && ballAboveRimSince >= 0 && frameIdx - ballAboveRimSince <= 10) {
        // Ball went from above → below inside rim — made!
        ballVsRimEvents.push({ type: 'made', videoName: videoName, frameIdx: frameIdx,
          rimRxFrac: rx / W, rimCyFrac: rim.cy / H });
        log('  🏀→🏅 Made at frame ' + frameIdx + ' in ' + videoName, 'ok');
        ballAboveRimSince = -1;
      } else if (below && !inH && ballAboveRimSince >= 0 && frameIdx - ballAboveRimSince <= 10) {
        // Ball passed below but outside rim — miss
        ballVsRimEvents.push({ type: 'missed', videoName: videoName, frameIdx: frameIdx,
          rimRxFrac: rx / W, rimCyFrac: rim.cy / H });
        ballAboveRimSince = -1;
      }
    } else {
      ballAboveRimSince = -1;
    }

    return rim;
  }

  /* ══════════════════════════════════════════════════════════════
     VIDEO PROCESSING LOOP
     ══════════════════════════════════════════════════════════════ */

  function processVideo(urlOrFile, videoName, onProgress) {
    ballAboveRimSince = -1;
    return new Promise(function (resolve) {
      var video   = extractVideo;
      var canvas  = extractCanvas;
      var ctx     = canvas.getContext('2d');
      var blobUrl, needRevoke;

      if (typeof urlOrFile === 'string') {
        blobUrl = urlOrFile; needRevoke = false;
      } else {
        blobUrl = URL.createObjectURL(urlOrFile); needRevoke = true;
      }

      video.src = blobUrl;

      video.onerror = function () {
        if (needRevoke) URL.revokeObjectURL(blobUrl);
        log('❌ טעינת ' + videoName + ' נכשלה', 'err');
        resolve(0);
      };

      video.onloadedmetadata = function () {
        var duration = video.duration;
        if (!isFinite(duration) || duration <= 0) {
          if (needRevoke) URL.revokeObjectURL(blobUrl);
          resolve(0);
          return;
        }

        // Normalize to 576px wide (consistent with batch-trainer)
        var normW = video.videoWidth > video.videoHeight ? 576 : 324;
        var normH = video.videoWidth > video.videoHeight ? 324 : 576;
        canvas.width = normW; canvas.height = normH;

        var interval = 1.5;   // sample every 1.5s — dense enough for shot tracking
        var t = 0, frameIdx = 0;

        function seekNext() {
          if (stopFlag || t >= duration) {
            if (needRevoke) URL.revokeObjectURL(blobUrl);
            resolve(frameIdx);
            return;
          }
          video.currentTime = t;
        }

        video.onseeked = function () {
          ctx.drawImage(video, 0, 0, normW, normH);
          var imageData = ctx.getImageData(0, 0, normW, normH);

          var rim = processFrame(imageData, normW, normH, videoName, frameIdx, saveRimPatch);
          if (onProgress) onProgress(t, duration, rim);

          t += interval;
          frameIdx++;
          setTimeout(seekNext, 0);
        };

        seekNext();
      };
    });
  }

  /* ══════════════════════════════════════════════════════════════
     TRAINING ORCHESTRATION
     ══════════════════════════════════════════════════════════════ */

  function startTraining() {
    if (isRunning) return;
    if (videoUrls.length === 0) {
      log('⚠️ אין סרטונים — טוען...', 'warn');
      loadServerVideos().then(function () {
        if (videoUrls.length > 0) startTraining();
        else log('❌ לא נמצאו סרטונים בשרת. הרץ קודם את batch-trainer.', 'err');
      });
      return;
    }

    isRunning          = true;
    stopFlag           = false;
    rimColorSamples    = [];
    rimGeometrySamples = [];
    ballVsRimEvents    = [];
    totalFrames        = 0;
    rimSamplesFound    = 0;
    ballAboveRimSince  = -1;
    startTime          = Date.now();

    btnStart.disabled = true;
    btnStop.disabled  = false;
    statusDot.classList.add('active');
    statusText.textContent = 'מאמן...';
    timerInterval = setInterval(updateTimer, 1000);

    log('🚀 מתחיל אימון טבעת על ' + videoUrls.length + ' סרטונים...', 'info');

    openIDB().then(function (idb) {
      db = idb;
      runNext(0);
    });
  }

  function runNext(idx) {
    if (stopFlag || idx >= videoUrls.length) {
      finishTraining();
      return;
    }

    var entry = videoUrls[idx];
    var name  = entry.name || ('video-' + idx);
    log('📹 מעבד: ' + name, 'info');
    updateCurrentVideo(name, idx);

    processVideo(entry.src, name, function (t, dur, rim) {
      var pct = Math.round((t / dur) * 100);
      setVideoProgress(idx, pct, rim ? '✓ rim' : '...');
    }).then(function (framesDone) {
      setVideoProgress(idx, 100, '✔ הושלם');
      log('  ✔ ' + name + ': ' + framesDone + ' frames | טבעות: ' + rimSamplesFound, 'ok');
      runNext(idx + 1);
    });
  }

  function finishTraining() {
    clearInterval(timerInterval);
    isRunning = false;
    btnStart.disabled = false;
    btnStop.disabled  = true;
    statusDot.classList.remove('active');
    statusText.textContent = 'הושלם';

    // Save shot events
    if (ballVsRimEvents.length > 0) {
      var made   = ballVsRimEvents.filter(function (e) { return e.type === 'made';   }).length;
      var missed = ballVsRimEvents.filter(function (e) { return e.type === 'missed'; }).length;
      log('🎯 אירועי זריקה: ' + made + ' מכות, ' + missed + ' החטאות', 'info');
      try { localStorage.setItem('courtiq-shot-events', JSON.stringify(ballVsRimEvents.slice(-300))); } catch (e) {}
    }

    var model = saveRimModel();
    log('─────────────────────────────────────────────', 'info');
    log('✅ אימון טבעת הסתיים! ' + rimSamplesFound + ' טבעות ב-' + totalFrames + ' פריימים.', 'ok');
    if (model) {
      log('רענן את דף המשחק — המודל יטען אוטומטית לתוך ה-Shot Tracker.', 'info');
    }
  }

  /* ══════════════════════════════════════════════════════════════
     LOAD VIDEOS FROM SERVER
     ══════════════════════════════════════════════════════════════ */

  function loadServerVideos() {
    return fetch('/api/download-status')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        videoUrls = (data.videos || [])
          .filter(function (v) { return v.status === 'done'; })
          .map(function (v) {
            return { name: v.name, src: '/api/video/' + encodeURIComponent(v.name), size: v.size };
          });
        log('📡 נטענו ' + videoUrls.length + ' סרטונים מהשרת', 'info');
        renderVideoList();
      })
      .catch(function (e) {
        log('⚠️ לא ניתן לטעון מהשרת: ' + e.message + ' — נסה ידנית?', 'warn');
      });
  }

  /* ══════════════════════════════════════════════════════════════
     UI HELPERS
     ══════════════════════════════════════════════════════════════ */

  function renderVideoList() {
    var list = document.getElementById('videoList');
    list.innerHTML = '';
    if (videoUrls.length === 0) {
      list.innerHTML = '<div style="color:var(--muted);padding:12px 0;font-size:13px;">לא נמצאו סרטונים. הרץ קודם את batch-trainer כדי להוריד סרטונים.</div>';
      return;
    }
    videoUrls.forEach(function (v, idx) {
      var item = document.createElement('div');
      item.className = 'video-item';
      item.innerHTML =
        '<div class="video-item-wrap">' +
          '<div class="video-item-top">' +
            '<span class="vname">' + v.name + '</span>' +
            (v.size ? '<span class="vsize">' + (v.size / 1e6).toFixed(0) + 'MB</span>' : '') +
            '<span class="vstatus" id="vstatus-' + idx + '">ממתין</span>' +
          '</div>' +
          '<div class="vbar"><div class="vbar-fill" id="vbar-' + idx + '" style="width:0%"></div></div>' +
        '</div>';
      list.appendChild(item);
    });
  }

  function setVideoProgress(idx, pct, msg) {
    var bar    = document.getElementById('vbar-' + idx);
    var status = document.getElementById('vstatus-' + idx);
    if (bar)    bar.style.width = pct + '%';
    if (status) { status.textContent = msg; status.className = 'vstatus ' + (pct >= 100 ? 'done' : 'active'); }
  }

  function updateCurrentVideo(name, idx) {
    var el = document.getElementById('currentVideoLabel');
    if (el) el.innerHTML = 'מעבד: <span>' + name + '</span>';
  }

  function updateStats() {
    var el;
    el = document.getElementById('statFrames');      if (el) el.textContent = totalFrames;
    el = document.getElementById('statRims');        if (el) el.textContent = rimSamplesFound;
    el = document.getElementById('statGeoSamples');  if (el) el.textContent = rimGeometrySamples.length;
    el = document.getElementById('statShots');       if (el) el.textContent = ballVsRimEvents.length;

    // Color confidence
    var colorConf = Math.min(1.0, rimColorSamples.length / 80);
    el = document.getElementById('confRimFill');  if (el) el.style.width = (colorConf * 100) + '%';
    el = document.getElementById('confRimPct');   if (el) el.textContent = Math.round(colorConf * 100) + '%';

    // Geometry confidence
    var geoConf = Math.min(1.0, rimGeometrySamples.length / 40);
    el = document.getElementById('confGeoFill');  if (el) el.style.width = (geoConf * 100) + '%';
    el = document.getElementById('confGeoPct');   if (el) el.textContent = Math.round(geoConf * 100) + '%';
  }

  function updateTimer() {
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var m = Math.floor(elapsed / 60), s = elapsed % 60;
    // no timer stat element in this page, but keep for future
  }

  function renderModelBox(m) {
    var box = document.getElementById('modelBox');
    if (!box) return;
    var conf = Math.round((m.confidence || 0) * 100);
    var confCls = conf >= 70 ? 'mgood' : conf >= 40 ? 'mval' : 'mwarn';
    box.innerHTML =
      '<div><span class="mlabel">ביטחון: </span><span class="' + confCls + '">' + conf + '%</span></div>' +
      '<div><span class="mlabel">דגימות צבע: </span><span class="mval">' + m.sampleCount + '</span></div>' +
      '<div><span class="mlabel">דגימות גאומטריה: </span><span class="mval">' + (m.geoCount || 0) + '</span></div>' +
      '<div><span class="mlabel">rxFrac (median): </span><span class="mval">' + (m.rxFracMean || 0).toFixed(3) + '</span>' +
        ' <span class="mlabel">[' + (m.rxFracMin || 0).toFixed(3) + '–' + (m.rxFracMax || 0).toFixed(3) + ']</span></div>' +
      '<div><span class="mlabel">aspect (rx/ry): </span><span class="mval">' + (m.aspectMean || 0).toFixed(2) + '</span></div>' +
      '<div><span class="mlabel">cy (vertical pos): </span><span class="mval">' + (m.cyFracMean || 0).toFixed(2) + '</span></div>' +
      '<div><span class="mlabel">צבע R: </span><span class="mval">' + m.rMin + '–' + m.rMax + '</span>' +
        ' <span class="mlabel">G: </span><span class="mval">' + m.gMin + '–' + m.gMax + '</span>' +
        ' <span class="mlabel">B: </span><span class="mval">' + m.bMin + '–' + m.bMax + '</span></div>' +
      '<div><span class="mlabel">אירועי זריקה: </span><span class="mval">' + (m.shotEvents || 0) + '</span></div>' +
      '<div><span class="mlabel">אומן ב: </span><span class="mval">' + (m.trainedAt ? new Date(m.trainedAt).toLocaleString('he-IL') : '—') + '</span></div>';
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════ */

  btnStart.addEventListener('click', startTraining);

  btnStop.addEventListener('click', function () {
    stopFlag = true;
    statusText.textContent = 'עוצר...';
    log('⏹ עוצר לאחר הסרטון הנוכחי...', 'warn');
  });

  btnClearModel.addEventListener('click', function () {
    if (confirm('למחוק את מודל הטבעת השמור?')) {
      localStorage.removeItem(STORAGE_KEY_RIM);
      document.getElementById('modelBox').innerHTML = '<div class="mwarn">מודל נמחק.</div>';
      log('🗑 מודל טבעת נמחק', 'warn');
    }
  });

  // Show existing model
  (function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_RIM);
      if (raw) {
        var m = JSON.parse(raw);
        log('📋 מודל טבעת קיים: ' + m.sampleCount + ' דגימות | rxFrac=' +
            (m.rxFracMean || 0).toFixed(3) + ' | conf=' + Math.round((m.confidence || 0) * 100) + '%', 'info');
        renderModelBox(m);
      } else {
        log('ℹ️ אין מודל טבעת שמור — לחץ "התחל" לאמן', 'info');
        document.getElementById('modelBox').innerHTML =
          '<div class="mlabel">אין מודל — לחץ "התחל אימון טבעת" כדי ליצור.</div>';
      }
    } catch (e) {}

    loadServerVideos();
  }());

})();
