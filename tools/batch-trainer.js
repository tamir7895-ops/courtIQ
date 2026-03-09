/* ══════════════════════════════════════════════════════════════
   CourtIQ Batch Trainer
   Processes basketball videos offline to pre-train all 3
   adaptive learning levels before a live session.

   Outputs (compatible with adaptiveLearning.js):
   ─ localStorage['courtiq-adaptive-color'] — Level 1 color model
   ─ IndexedDB 'courtiq-learning'/'ball-samples' — Level 3 TL data
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Storage keys — MUST match adaptiveLearning.js ─────────── */
  var STORAGE_KEY_COLOR = 'courtiq-adaptive-color';
  var IDB_NAME          = 'courtiq-learning';
  var IDB_STORE         = 'ball-samples';
  var IDB_VERSION       = 1;

  /* ── State ──────────────────────────────────────────────────── */
  var videoFiles   = [];
  var stopFlag     = false;
  var isRunning    = false;
  var wakeLock     = null;
  var db           = null;
  var startTime    = 0;
  var timerInterval= null;

  /* Running counters */
  var totalFrames  = 0;
  var ballSamples  = 0;
  var bgSamples    = 0;
  var colorSamples = [];   /* [{r,g,b,ts}] — for Level 1 */

  /* ── DOM refs ────────────────────────────────────────────────── */
  var dropZone    = document.getElementById('dropZone');
  var fileInput   = document.getElementById('fileInput');
  var videoList   = document.getElementById('videoList');
  var logBox      = document.getElementById('logBox');
  var btnStart    = document.getElementById('btnStart');
  var btnStop     = document.getElementById('btnStop');
  var btnClearAll = document.getElementById('btnClearAll');
  var statusDot   = document.getElementById('statusDot');
  var statusText  = document.getElementById('statusText');
  var extractVideo= document.getElementById('extractVideo');
  var extractCanvas = document.getElementById('extractCanvas');

  /* ══════════════════════════════════════════════════════════════
     ORANGE / BALL DETECTION
     Identical thresholds to ai-shot-tracker.js (keep in sync!)
     ══════════════════════════════════════════════════════════════ */

  function isOrange(r, g, b) {
    var max = r > g ? (r > b ? r : b) : (g > b ? g : b);
    var min = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (max < 70) return false;
    var delta = max - min;
    if (delta < 18) return false;
    var s = delta / max;
    if (s < 0.28) return false;
    var h;
    if (max === r)      h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else                h = 60 * ((r - g) / delta + 4);
    if (h < 0) h += 360;
    return (h >= 10 && h <= 48) || h >= 342;
  }

  /**
   * Detect best orange blob in imageData.
   * Returns {x, y, w, h, score} or null.
   * maxY: hard cutoff row (ignore floor below this)
   */
  function detectBallInFrame(imageData, W, H) {
    var data = imageData.data;
    var cells = 24;
    var cw = Math.floor(W / cells) || 1;
    var ch = Math.floor(H / cells) || 1;
    var grid = new Float32Array(cells * cells);

    /* Only top 70% of frame to skip court floor */
    var scanMaxY = Math.floor(H * 0.70);

    for (var y = 0; y < scanMaxY; y++) {
      for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 4;
        if (isOrange(data[i], data[i + 1], data[i + 2])) {
          var cx = Math.min(Math.floor(x / cw), cells - 1);
          var cy = Math.min(Math.floor(y / ch), cells - 1);
          grid[cy * cells + cx]++;
        }
      }
    }

    /* Find peak cell */
    var best = null;
    var visited = new Uint8Array(cells * cells);

    for (var gy = 0; gy < cells; gy++) {
      for (var gx = 0; gx < cells; gx++) {
        var v = grid[gy * cells + gx];
        if (v < 15 || visited[gy * cells + gx]) continue;

        /* BFS flood fill */
        var queue = [[gx, gy]];
        var pixels = 0;
        var minGx = gx, maxGx = gx, minGy = gy, maxGy = gy;
        var head = 0;

        while (head < queue.length) {
          var cell = queue[head++];
          var bx = cell[0], by = cell[1];
          var key = by * cells + bx;
          if (visited[key]) continue;
          if (grid[key] < 5) continue;
          visited[key] = 1;

          pixels += grid[key];
          if (bx < minGx) minGx = bx;
          if (bx > maxGx) maxGx = bx;
          if (by < minGy) minGy = by;
          if (by > maxGy) maxGy = by;

          var dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
          for (var d = 0; d < dirs.length; d++) {
            var nx = bx + dirs[d][0], ny = by + dirs[d][1];
            if (nx >= 0 && nx < cells && ny >= 0 && ny < cells && !visited[ny * cells + nx]) {
              queue.push([nx, ny]);
            }
          }
        }

        var blobW = maxGx - minGx + 1;
        var blobH = maxGy - minGy + 1;
        if (blobW < 1 || blobH < 1) continue;

        /* Aspect ratio filter — ball is roughly round */
        var aspect = Math.max(blobW, blobH) / Math.min(blobW, blobH);
        if (aspect > 2.8) continue;

        /* Fill ratio — how "dense" is the orange within bounding box */
        var fillRatio = pixels / (blobW * blobH * cw * ch / 2);
        var score = Math.min(1.0, fillRatio) * 0.5 +
                    (1 / aspect) * 0.3 +
                    Math.min(1, pixels / 300) * 0.2;

        if (!best || score > best.score) {
          best = {
            x: ((minGx + maxGx) / 2 + 0.5) * cw,
            y: ((minGy + maxGy) / 2 + 0.5) * ch,
            w: blobW * cw,
            h: blobH * ch,
            score: score,
            pixels: pixels
          };
        }
      }
    }

    /* Extra sanity: min pixels, size bounds */
    if (!best) return null;
    if (best.pixels < 80) return null;
    var minSize = W * 0.012, maxSize = W * 0.22;
    if (best.w < minSize || best.h < minSize) return null;
    if (best.w > maxSize || best.h > maxSize) return null;

    return best;
  }

  /* ══════════════════════════════════════════════════════════════
     COLOR STATS (Level 1)
     ══════════════════════════════════════════════════════════════ */

  function addColorSample(imageData, cx, cy) {
    var W = imageData.width;
    var H = imageData.height;
    var data = imageData.data;
    var radius = 20;
    var x0 = Math.max(0, Math.floor(cx - radius));
    var y0 = Math.max(0, Math.floor(cy - radius));
    var x1 = Math.min(W - 1, Math.floor(cx + radius));
    var y1 = Math.min(H - 1, Math.floor(cy + radius));

    var rSum = 0, gSum = 0, bSum = 0, count = 0;
    var innerR2 = radius * radius * 0.36; /* 60% of radius squared */

    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > innerR2) continue;
        var i = (y * W + x) * 4;
        var r = data[i], g = data[i + 1], b = data[i + 2];
        /* Only sample orange-ish center pixels */
        if (r > 80 && r > g && r > b * 1.3) {
          rSum += r; gSum += g; bSum += b; count++;
        }
      }
    }

    if (count < 5) return;
    colorSamples.push({ r: rSum / count, g: gSum / count, b: bSum / count, ts: Date.now() });
  }

  function saveColorStats() {
    if (colorSamples.length < 10) return null;

    var recent = colorSamples.slice(-200);
    var rs = recent.map(function (s) { return s.r; }).sort(function (a, b) { return a - b; });
    var gs = recent.map(function (s) { return s.g; }).sort(function (a, b) { return a - b; });
    var bs = recent.map(function (s) { return s.b; }).sort(function (a, b) { return a - b; });

    var p10 = Math.floor(rs.length * 0.10);
    var p90 = Math.floor(rs.length * 0.90);

    var payload = {
      rMin: Math.max(0,   rs[p10] - 15),
      rMax: Math.min(255, rs[p90] + 15),
      gMin: Math.max(0,   gs[p10] - 15),
      gMax: Math.min(255, gs[p90] + 15),
      bMin: Math.max(0,   bs[p10] - 10),
      bMax: Math.min(255, bs[p90] + 10),
      confidence: Math.min(1.0, colorSamples.length / 50),
      sampleCount: colorSamples.length,
      samples: colorSamples.slice(-50)
    };

    try {
      localStorage.setItem(STORAGE_KEY_COLOR, JSON.stringify(payload));
    } catch (e) {
      log('⚠ לא ניתן לשמור ל-localStorage: ' + e.message, 'warn');
    }

    return payload;
  }

  /* ══════════════════════════════════════════════════════════════
     INDEXEDDB (Level 3)
     ══════════════════════════════════════════════════════════════ */

  function openIDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { resolve(null); return; }
      var req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = function (e) {
        var db_ = e.target.result;
        if (!db_.objectStoreNames.contains(IDB_STORE)) {
          var store = db_.createObjectStore(IDB_STORE, { autoIncrement: true });
          store.createIndex('label', 'label', { unique: false });
        }
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror   = function (e) { reject(e.target.error); };
    });
  }

  function clearIDB(db_) {
    return new Promise(function (resolve) {
      if (!db_) { resolve(); return; }
      try {
        var tx = db_.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).clear();
        tx.oncomplete = resolve;
        tx.onerror    = resolve;
      } catch (e) { resolve(); }
    });
  }

  function countIDB(db_) {
    return new Promise(function (resolve) {
      if (!db_) { resolve(0); return; }
      try {
        var tx = db_.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).count();
        req.onsuccess = function () { resolve(req.result); };
        req.onerror   = function () { resolve(0); };
      } catch (e) { resolve(0); }
    });
  }

  /**
   * Crop a 64×64 patch from imageData at (cx, cy) and save as label.
   */
  function addSampleToIDB(db_, imageData, cx, cy, label) {
    if (!db_) return Promise.resolve();

    var cropSize = 64;
    var half = cropSize / 2;
    var x0 = Math.max(0, Math.floor(cx - half));
    var y0 = Math.max(0, Math.floor(cy - half));
    var w  = Math.min(cropSize, imageData.width  - x0);
    var h  = Math.min(cropSize, imageData.height - y0);
    if (w < 32 || h < 32) return Promise.resolve();

    /* Draw source into a temp canvas then extract crop */
    var srcCanvas = document.createElement('canvas');
    srcCanvas.width  = imageData.width;
    srcCanvas.height = imageData.height;
    srcCanvas.getContext('2d').putImageData(imageData, 0, 0);

    var tmpCanvas = document.createElement('canvas');
    tmpCanvas.width  = cropSize;
    tmpCanvas.height = cropSize;
    var tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(srcCanvas, x0, y0, cropSize, cropSize, 0, 0, cropSize, cropSize);
    var cropData = tmpCtx.getImageData(0, 0, cropSize, cropSize);

    var sample = {
      label:  label,
      pixels: Array.from(cropData.data), /* RGBA flat [64×64×4] */
      ts:     Date.now()
    };

    return new Promise(function (resolve) {
      try {
        var tx = db_.transaction(IDB_STORE, 'readwrite');
        var store = tx.objectStore(IDB_STORE);
        store.add(sample);
        tx.oncomplete = resolve;
        tx.onerror    = resolve;
      } catch (e) { resolve(); }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     FRAME EXTRACTION
     ══════════════════════════════════════════════════════════════ */

  /**
   * Extract frames from a video file by seeking.
   * Calls onFrame(imageData, W, H, timestamp) for each frame.
   */
  function extractFrames(file, intervalSec, onFrame) {
    return new Promise(function (resolve) {
      var video = extractVideo;
      var canvas = extractCanvas;
      var ctx = canvas.getContext('2d');
      var url = URL.createObjectURL(file);

      video.src = url;

      video.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(0);
      };

      video.onloadedmetadata = function () {
        var duration = video.duration;
        if (!isFinite(duration) || duration <= 0) {
          URL.revokeObjectURL(url);
          resolve(0);
          return;
        }

        /* Normalize to 576×1024 (portrait basketball) */
        var normW = 576, normH = 1024;
        var vRatio = video.videoWidth / video.videoHeight;

        if (video.videoWidth > video.videoHeight) {
          /* Landscape video — rotate mentally, still draw as-is */
          normW = 576; normH = 324;
        }

        canvas.width  = normW;
        canvas.height = normH;

        var t = 0;
        var count = 0;

        function seekNext() {
          if (stopFlag || t >= duration) {
            URL.revokeObjectURL(url);
            resolve(count);
            return;
          }

          video.currentTime = t;
        }

        video.onseeked = function () {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          /* onFrame is async — wait for it before next seek */
          Promise.resolve(onFrame(imageData, canvas.width, canvas.height, t))
            .then(function () {
              count++;
              t += intervalSec;
              /* Small timeout to keep UI responsive */
              setTimeout(seekNext, 0);
            });
        };

        seekNext();
      };
    });
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN TRAINING PIPELINE
     ══════════════════════════════════════════════════════════════ */

  async function runTraining() {
    if (videoFiles.length === 0) {
      log('❌ אין סרטונים — גרור קבצים ואז התחל.', 'err');
      return;
    }

    stopFlag  = false;
    isRunning = true;
    startTime = Date.now();
    setRunning(true);

    var intervalSec = parseFloat(document.getElementById('cfgInterval').value) || 3;
    var minConf     = parseFloat(document.getElementById('cfgConfidence').value) || 0.55;
    var maxSamplesPerVideo = parseInt(document.getElementById('cfgMaxSamples').value) || 400;
    var bgRatio     = parseInt(document.getElementById('cfgBgRatio').value) || 2;
    var clearOld    = document.getElementById('cfgClearOld').checked;
    var useWakeLock = document.getElementById('cfgWakeLock').checked;

    /* Wake Lock */
    if (useWakeLock && navigator.wakeLock) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        log('✅ Wake Lock פעיל — המסך יישאר דלוק', 'ok');
      } catch (e) {
        log('⚠ Wake Lock נכשל: ' + e.message, 'warn');
      }
    }

    /* Open IDB */
    try {
      db = await openIDB();
      log('✅ IndexedDB נפתח', 'ok');
    } catch (e) {
      log('⚠ IndexedDB נכשל — Level 3 לא יישמר: ' + e.message, 'warn');
    }

    /* Optionally clear old data */
    if (clearOld) {
      await clearIDB(db);
      localStorage.removeItem(STORAGE_KEY_COLOR);
      colorSamples = [];
      ballSamples  = 0;
      bgSamples    = 0;
      totalFrames  = 0;
      log('🗑 נתונים ישנים נמחקו', 'info');
    } else {
      /* Load existing color samples so we continue where we left off */
      try {
        var existing = JSON.parse(localStorage.getItem(STORAGE_KEY_COLOR) || 'null');
        if (existing && existing.samples) {
          colorSamples = existing.samples;
          log('📥 נטענו ' + colorSamples.length + ' דגימות צבע קיימות', 'info');
        }
      } catch (e) { /* ignore */ }

      var existingCount = await countIDB(db);
      if (existingCount > 0) {
        log('📥 IDB: ' + existingCount + ' דגימות קיימות — מוסיף עליהן', 'info');
        ballSamples = Math.round(existingCount * 0.4); /* estimate */
        bgSamples   = existingCount - ballSamples;
        updateStats();
      }
    }

    /* Start timer */
    timerInterval = setInterval(updateTimer, 1000);

    log('─────────────────────────────────────────', 'info');
    log('🚀 מתחיל אימון — ' + videoFiles.length + ' סרטונים', 'info');
    log('   כל ' + intervalSec + ' שנ׳ | ביטחון ≥ ' + minConf + ' | ' + maxSamplesPerVideo + ' לסרטון', 'info');
    log('─────────────────────────────────────────', 'info');

    /* Process each video */
    for (var vi = 0; vi < videoFiles.length; vi++) {
      if (stopFlag) break;

      var file = videoFiles[vi];
      var itemEl = document.getElementById('vid-item-' + vi);

      log('📹 עובד על: ' + file.name + ' (' + formatBytes(file.size) + ')', 'info');
      setVideoStatus(vi, 'active', 'מעבד…');

      var vidBall = 0;
      var vidBg   = 0;
      var vidFrames = 0;

      var framesResult = await extractFrames(file, intervalSec, async function (imageData, W, H, t) {
        if (stopFlag) return;
        if (vidBall + vidBg >= maxSamplesPerVideo) return;

        vidFrames++;
        totalFrames++;

        var ball = detectBallInFrame(imageData, W, H);

        if (ball && ball.score >= minConf) {
          /* Positive: ball sample */
          addColorSample(imageData, ball.x, ball.y);
          await addSampleToIDB(db, imageData, ball.x, ball.y, 'ball');
          ballSamples++;
          vidBall++;

          /* Negative samples: random spots away from ball */
          for (var k = 0; k < bgRatio; k++) {
            var bgX = pickNegativeX(ball.x, W);
            var bgY = pickNegativeY(ball.y, H);
            await addSampleToIDB(db, imageData, bgX, bgY, 'background');
            bgSamples++;
            vidBg++;
          }
        } else {
          /* No ball — add a background sample from bottom quarter (floor area) */
          if (Math.random() < 0.3) {
            var floorX = 50 + Math.random() * (W - 100);
            var floorY = H * 0.75 + Math.random() * H * 0.20;
            await addSampleToIDB(db, imageData, floorX, floorY, 'background');
            bgSamples++;
            vidBg++;
          }
        }

        updateStats();

        /* Update video item progress */
        if (itemEl) {
          var fill = itemEl.querySelector('.vbar-fill');
          /* We don't know total frames, estimate from time */
          if (fill) {
            var pct = Math.min(99, Math.round((t / (extractVideo.duration || 1)) * 100));
            fill.style.width = pct + '%';
          }
        }
      });

      if (stopFlag) {
        setVideoStatus(vi, 'error', 'עצר');
        break;
      }

      var statusMsg = vidBall + ' כדורים, ' + vidBg + ' רקע (' + framesResult + ' פריימים)';
      setVideoStatus(vi, 'done', statusMsg);
      log('✅ ' + file.name + ': ' + statusMsg, 'ok');

      /* Save color stats periodically */
      var saved = saveColorStats();
      if (saved) {
        var confPct = Math.round(saved.confidence * 100);
        log('💾 מודל צבע שמור — ביטחון: ' + confPct + '%', 'ok');
        updateConfidenceBars(saved.confidence, 0, saved.confidence);
      }
    }

    /* Final save */
    var finalColor = saveColorStats();
    var finalTotal = await countIDB(db);

    log('─────────────────────────────────────────', 'info');
    log('🏁 אימון הושלם!', 'ok');
    log('   דגימות כדור: ' + ballSamples, 'ok');
    log('   דגימות רקע:  ' + bgSamples, 'ok');
    log('   פריימים עובדו: ' + totalFrames, 'ok');
    if (finalColor) {
      log('   ביטחון צבע: ' + Math.round(finalColor.confidence * 100) + '%', 'ok');
    }
    log('   IDB סה"כ: ' + finalTotal + ' דגימות', 'ok');
    log('', 'info');
    log('✨ פתח את הדשבורד — המודל ייטען אוטומטית בהפעלה הבאה.', 'ok');

    if (finalColor) {
      updateConfidenceBars(finalColor.confidence, Math.min(1, finalTotal / 200), finalColor.confidence);
    }

    isRunning = false;
    clearInterval(timerInterval);
    setRunning(false);

    /* Release wake lock */
    if (wakeLock) {
      try { await wakeLock.release(); } catch (e) { /* ignore */ }
      wakeLock = null;
    }
  }

  /* ── Helpers for negative sample placement ──────────────────── */

  function pickNegativeX(ballX, W) {
    /* Pick x that's at least 80px from the ball */
    var margin = 80;
    var candidates = [];
    if (ballX - margin > 50) candidates.push(50 + Math.random() * (ballX - margin - 50));
    if (ballX + margin < W - 50) candidates.push(ballX + margin + Math.random() * (W - ballX - margin - 50));
    if (candidates.length === 0) return Math.random() * W;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function pickNegativeY(ballY, H) {
    /* Prefer floor area (bottom 30%) for hard negatives */
    if (Math.random() < 0.6) {
      return H * 0.70 + Math.random() * H * 0.25;
    }
    /* Or a random spot */
    var result = Math.random() * H;
    /* Stay away from ball */
    if (Math.abs(result - ballY) < 80) result = (result + 80) % H;
    return result;
  }

  /* ══════════════════════════════════════════════════════════════
     UI HELPERS
     ══════════════════════════════════════════════════════════════ */

  function log(msg, type) {
    var line = document.createElement('div');
    line.className = 'log-line log-' + (type || 'info');

    var now = new Date();
    var hh  = String(now.getHours()).padStart(2, '0');
    var mm  = String(now.getMinutes()).padStart(2, '0');
    var ss  = String(now.getSeconds()).padStart(2, '0');

    line.innerHTML = '<span class="log-time">' + hh + ':' + mm + ':' + ss + '</span>' +
                     '<span class="log-msg">' + escHtml(msg) + '</span>';

    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setRunning(running) {
    btnStart.disabled = running;
    btnStop.disabled  = !running;
    statusDot.className = 'pill-dot' + (running ? ' active' : '');
    statusText.textContent = running ? 'מאמן…' : (stopFlag ? 'עצר' : 'הושלם');
  }

  function setVideoStatus(vi, state, msg) {
    var el = document.getElementById('vstatus-' + vi);
    var fillEl = document.getElementById('vfill-' + vi);
    if (!el) return;
    el.className = 'vstatus ' + state;
    el.textContent = msg;
    if (fillEl && state === 'done') fillEl.style.width = '100%';
    if (fillEl && state === 'error') fillEl.style.background = 'var(--red)';
  }

  function updateStats() {
    document.getElementById('statBallSamples').textContent = ballSamples.toLocaleString();
    document.getElementById('statBgSamples').textContent   = bgSamples.toLocaleString();
    document.getElementById('statFrames').textContent      = totalFrames.toLocaleString();
  }

  function updateTimer() {
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    var ss = String(elapsed % 60).padStart(2, '0');
    document.getElementById('statTime').textContent = mm + ':' + ss;
  }

  function updateConfidenceBars(colorConf, tlConf, totalConf) {
    var c = Math.round(colorConf * 100);
    var t = Math.round(tlConf * 100);
    var tot = Math.round(totalConf * 100);

    document.getElementById('confColor').style.width    = c + '%';
    document.getElementById('confColorPct').textContent = c + '%';
    document.getElementById('confTL').style.width       = t + '%';
    document.getElementById('confTLPct').textContent    = t + '%';
    document.getElementById('confTotal').style.width    = tot + '%';
    document.getElementById('confTotalPct').textContent = tot + '%';
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /* ══════════════════════════════════════════════════════════════
     FILE / DROP ZONE
     ══════════════════════════════════════════════════════════════ */

  function addFiles(files) {
    var added = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      /* Deduplicate by name+size */
      var dup = videoFiles.some(function (v) { return v.name === f.name && v.size === f.size; });
      if (!dup && f.type.startsWith('video/')) {
        videoFiles.push(f);
        added++;
      }
    }
    if (added > 0) renderVideoList();
  }

  function renderVideoList() {
    videoList.innerHTML = '';
    for (var i = 0; i < videoFiles.length; i++) {
      var f = videoFiles[i];
      var div = document.createElement('div');
      div.className = 'video-item';
      div.id = 'vid-item-' + i;
      div.innerHTML =
        '<div class="video-item-wrap">' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span class="vname">📹 ' + escHtml(f.name) + '</span>' +
            '<span class="vsize">' + formatBytes(f.size) + '</span>' +
            '<button class="vdel" data-idx="' + i + '">✕</button>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<div class="vbar"><div class="vbar-fill" id="vfill-' + i + '" style="width:0%"></div></div>' +
            '<span class="vstatus" id="vstatus-' + i + '">ממתין</span>' +
          '</div>' +
        '</div>';
      videoList.appendChild(div);
    }

    /* Delete buttons */
    videoList.querySelectorAll('.vdel').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(this.dataset.idx);
        videoFiles.splice(idx, 1);
        renderVideoList();
      });
    });
  }

  /* ── Event listeners ─────────────────────────────────────────── */

  dropZone.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    addFiles(this.files);
    this.value = '';
  });

  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', function () {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles(e.dataTransfer.files);
  });

  btnStart.addEventListener('click', function () {
    runTraining().catch(function (e) {
      log('❌ שגיאה: ' + e.message, 'err');
      isRunning = false;
      clearInterval(timerInterval);
      setRunning(false);
    });
  });

  btnStop.addEventListener('click', function () {
    stopFlag = true;
    log('⏸ עוצר אחרי הפריים הנוכחי…', 'warn');
  });

  btnClearAll.addEventListener('click', async function () {
    if (!confirm('מחק את כל הנתונים שנאספו? (localStorage + IndexedDB)')) return;
    localStorage.removeItem(STORAGE_KEY_COLOR);
    colorSamples = [];
    ballSamples  = bgSamples = totalFrames = 0;
    updateStats();
    updateConfidenceBars(0, 0, 0);

    var db2 = await openIDB();
    await clearIDB(db2);
    log('🗑 כל הנתונים נמחקו', 'warn');
  });

  /* ── Load existing stats on init ─────────────────────────────── */
  (async function init() {
    log('🏀 CourtIQ Batch Trainer מוכן', 'ok');
    log('גרור סרטוני בסקטבול → לחץ "התחל אימון לילה"', 'info');

    /* Show current state */
    try {
      var existing = JSON.parse(localStorage.getItem(STORAGE_KEY_COLOR) || 'null');
      if (existing && existing.confidence > 0) {
        log('📊 מודל צבע קיים: ביטחון ' + Math.round(existing.confidence * 100) + '%', 'info');
        updateConfidenceBars(existing.confidence, 0, existing.confidence);
      }
    } catch (e) { /* ignore */ }

    try {
      var idb = await openIDB();
      var cnt = await countIDB(idb);
      if (cnt > 0) {
        log('📊 IDB קיים: ' + cnt + ' דגימות', 'info');
        ballSamples = Math.round(cnt * 0.4);
        bgSamples   = cnt - ballSamples;
        updateStats();
        updateConfidenceBars(0, Math.min(1, cnt / 200), Math.min(1, cnt / 200));
      }
    } catch (e) { /* ignore */ }
  })();

})();
