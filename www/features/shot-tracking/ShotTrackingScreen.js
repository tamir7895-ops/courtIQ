/* ══════════════════════════════════════════════════════════════
   SHOT TRACKING SCREEN — Full-screen video overlay with live
   YOLOX-tiny ball detection, shot counting & visual feedback.

   Handles:
     - Live camera (getUserMedia)
     - Uploaded video files (File API)

   Depends on: ShotDetectionEngine (shotDetection.js)
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Default rim zone (normalized 0-1, upper-center of frame) */
  var DEFAULT_RIM_CX = 0.50;
  var DEFAULT_RIM_CY = 0.28;
  var DEFAULT_RIM_W  = 0.14;
  var DEFAULT_RIM_H  = 0.07;

  /* ── Module state ──────────────────────────────────────────── */
  var _overlay    = null;
  var _videoEl    = null;
  var _canvas     = null;
  var _ctx        = null;
  var _stream     = null;   // MediaStream (camera mode)
  var _objectUrl  = null;   // blob URL (video mode)
  var _isOpen     = false;
  var _mode       = null;   // 'camera' | 'video'
  var _animFrame  = null;
  var _flashTm    = null;

  /* ── Build overlay DOM (once) ──────────────────────────────── */
  function _buildOverlay() {
    if (_overlay) return;

    _overlay = document.createElement('div');
    _overlay.id = 'sts-overlay';
    _overlay.className = 'sts-overlay';

    /* HUD ───────────────────────────────────────────────────── */
    var hud = document.createElement('div');
    hud.className = 'sts-hud';

    /* Stats block */
    var statsDiv = document.createElement('div');
    statsDiv.className = 'sts-hud-stats';

    var madeBlock = document.createElement('div');
    madeBlock.className = 'sts-stat';
    var madeNum = document.createElement('span');
    madeNum.id = 'sts-made';
    madeNum.className = 'sts-stat-num';
    madeNum.textContent = '0';
    var madeLbl = document.createElement('span');
    madeLbl.className = 'sts-stat-lbl';
    madeLbl.textContent = 'MADE';
    madeBlock.appendChild(madeNum);
    madeBlock.appendChild(madeLbl);

    var sep = document.createElement('div');
    sep.className = 'sts-stat-divider';
    sep.textContent = '/';

    var attBlock = document.createElement('div');
    attBlock.className = 'sts-stat';
    var attNum = document.createElement('span');
    attNum.id = 'sts-att';
    attNum.className = 'sts-stat-num';
    attNum.textContent = '0';
    var attLbl = document.createElement('span');
    attLbl.className = 'sts-stat-lbl';
    attLbl.textContent = 'SHOTS';
    attBlock.appendChild(attNum);
    attBlock.appendChild(attLbl);

    var pctWrap = document.createElement('div');
    pctWrap.className = 'sts-pct-wrap';
    var pct = document.createElement('span');
    pct.id = 'sts-pct';
    pct.className = 'sts-pct';
    pct.textContent = '\u2014%';
    pctWrap.appendChild(pct);

    statsDiv.appendChild(madeBlock);
    statsDiv.appendChild(sep);
    statsDiv.appendChild(attBlock);
    statsDiv.appendChild(pctWrap);

    /* Mode badge — show correct initial state based on pre-warm status */
    var badge = document.createElement('div');
    badge.id = 'sts-mode-badge';
    badge.className = 'sts-mode-badge';
    var _eng = window.ShotDetectionEngine;
    if (_eng && _eng.model) {
      badge.textContent = '\uD83D\uDD34 LIVE';
      badge.className = 'sts-mode-badge sts-mode-badge--detecting';
    } else if (_eng && _eng._loadingPromise) {
      badge.textContent = '\u23F3 Loading AI\u2026';
      badge.className = 'sts-mode-badge sts-mode-badge--loading';
    } else {
      badge.textContent = '\u23F3 Loading AI\u2026';
      badge.className = 'sts-mode-badge sts-mode-badge--loading';
    }

    /* Stop button */
    var stopBtn = document.createElement('button');
    stopBtn.id = 'sts-stop-btn';
    stopBtn.className = 'sts-stop-btn';
    stopBtn.setAttribute('aria-label', 'Stop tracking');
    stopBtn.textContent = '\u23F9 STOP';
    stopBtn.addEventListener('click', _stop);

    hud.appendChild(statsDiv);
    hud.appendChild(badge);
    hud.appendChild(stopBtn);

    /* Video + Canvas shell ───────────────────────────────────── */
    var videoWrap = document.createElement('div');
    videoWrap.className = 'sts-video-wrap';

    _videoEl = document.createElement('video');
    _videoEl.id = 'sts-video';
    _videoEl.className = 'sts-video';
    _videoEl.setAttribute('playsinline', '');
    _videoEl.setAttribute('autoplay', '');
    _videoEl.setAttribute('muted', '');

    _canvas = document.createElement('canvas');
    _canvas.id = 'sts-canvas';
    _canvas.className = 'sts-canvas';
    _ctx = _canvas.getContext('2d');

    var flash = document.createElement('div');
    flash.id = 'sts-flash';
    flash.className = 'sts-flash';

    var toast = document.createElement('div');
    toast.id = 'sts-shot-toast';
    toast.className = 'sts-shot-toast';

    videoWrap.appendChild(_videoEl);
    videoWrap.appendChild(_canvas);
    videoWrap.appendChild(flash);
    videoWrap.appendChild(toast);

    /* Video controls (upload mode) ──────────────────────────── */
    var controls = document.createElement('div');
    controls.id = 'sts-controls';
    controls.className = 'sts-controls';
    controls.style.display = 'none';

    var playBtn = document.createElement('button');
    playBtn.id = 'sts-play-btn';
    playBtn.className = 'sts-ctrl-btn';
    playBtn.textContent = '\u25B6 Play';
    playBtn.addEventListener('click', _togglePlay);

    var timeline = document.createElement('input');
    timeline.id = 'sts-timeline';
    timeline.className = 'sts-timeline';
    timeline.type = 'range';
    timeline.min = '0';
    timeline.max = '100';
    timeline.value = '0';
    timeline.step = '0.1';
    timeline.addEventListener('input', function () {
      if (_videoEl && _videoEl.duration) {
        _videoEl.currentTime = (_videoEl.duration * parseFloat(timeline.value)) / 100;
      }
    });

    var timeDisplay = document.createElement('span');
    timeDisplay.id = 'sts-time-display';
    timeDisplay.className = 'sts-time';
    timeDisplay.textContent = '0:00';

    controls.appendChild(playBtn);
    controls.appendChild(timeline);
    controls.appendChild(timeDisplay);

    /* Error message */
    var errDiv = document.createElement('div');
    errDiv.id = 'sts-error';
    errDiv.className = 'sts-error';
    errDiv.style.display = 'none';

    /* Assemble overlay ──────────────────────────────────────── */
    var shell = document.createElement('div');
    shell.className = 'sts-shell';
    shell.appendChild(hud);
    shell.appendChild(videoWrap);
    shell.appendChild(controls);
    shell.appendChild(errDiv);

    _overlay.appendChild(shell);
    document.body.appendChild(_overlay);

    /* Video event listeners ─────────────────────────────────── */
    _videoEl.addEventListener('timeupdate', _updateTimeline);
    _videoEl.addEventListener('ended', _onVideoEnded);
    _videoEl.addEventListener('loadedmetadata', function () {
      _syncCanvasSize();
    });
    /* loadeddata fires when first frame available; canplay is iOS fallback.
       engine.start() is idempotent (checks isRunning) so safe to call twice. */
    _videoEl.addEventListener('loadeddata', _startDetection);
    _videoEl.addEventListener('canplay',    _startDetection);
    _videoEl.addEventListener('play', function () {
      var pb = document.getElementById('sts-play-btn');
      if (pb) pb.textContent = '\u23F8 Pause';
    });
    _videoEl.addEventListener('pause', function () {
      var pb = document.getElementById('sts-play-btn');
      if (pb) pb.textContent = '\u25B6 Play';
    });

    /* Canvas sizing ─────────────────────────────────────────── */
    if (window.ResizeObserver) {
      new ResizeObserver(_syncCanvasSize).observe(_videoEl);
    }
    window.addEventListener('resize', _syncCanvasSize);
  }

  /* ── Sync canvas size to video element dimensions ────────── */
  function _syncCanvasSize() {
    if (!_videoEl || !_canvas) return;
    var r = _videoEl.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    _canvas.width  = r.width;
    _canvas.height = r.height;
    _canvas.style.width  = r.width  + 'px';
    _canvas.style.height = r.height + 'px';
  }

  /* ── Draw loop (runs every rAF while open) ───────────────── */
  /* ── Compute video content area within canvas (letterbox offset) ── */
  function _getVideoContentRect() {
    if (!_videoEl || !_canvas) return { ox: 0, oy: 0, vw: _canvas.width, vh: _canvas.height };
    var cw = _canvas.width;
    var ch = _canvas.height;
    var natW = _videoEl.videoWidth || cw;
    var natH = _videoEl.videoHeight || ch;
    var videoAR = natW / natH;
    var canvasAR = cw / ch;
    var contentW, contentH, ox, oy;
    if (videoAR < canvasAR) {
      // Portrait video in wider canvas — black bars on sides
      contentH = ch;
      contentW = ch * videoAR;
      ox = (cw - contentW) / 2;
      oy = 0;
    } else {
      // Landscape video in taller canvas — black bars top/bottom
      contentW = cw;
      contentH = cw / videoAR;
      ox = 0;
      oy = (ch - contentH) / 2;
    }
    return { ox: ox, oy: oy, vw: contentW, vh: contentH };
  }

  function _drawLoop() {
    if (!_isOpen) return;
    _animFrame = requestAnimationFrame(_drawLoop);

    if (!_ctx || !_canvas || _canvas.width < 4) return;
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

    var engine = window.ShotDetectionEngine;
    if (!engine) return;

    /* Video content rect (accounts for letterbox padding) */
    var vcr = _getVideoContentRect();
    var ox = vcr.ox, oy = vcr.oy, vw = vcr.vw, vh = vcr.vh;

    /* Helper: convert normalized video coords to canvas pixels */
    function nx(n) { return ox + n * vw; }
    function ny(n) { return oy + n * vh; }
    function nw(n) { return n * vw; }
    function nh(n) { return n * vh; }

    /* Draw raw YOLOX hoop detection (yellow dashed — debug) ── */
    var rawHoop = engine._rawHoopBox;
    if (rawHoop) {
      var hx = nx(rawHoop.normCX - rawHoop.normW / 2);
      var hy = ny(rawHoop.normCY - rawHoop.normH / 2);
      var hw = nw(rawHoop.normW);
      var hh = nh(rawHoop.normH);

      _ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
      _ctx.lineWidth   = 1.5;
      _ctx.setLineDash([4, 4]);
      _ctx.strokeRect(hx, hy, hw, hh);
      _ctx.setLineDash([]);

      _ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
      _ctx.font      = 'bold 10px sans-serif';
      _ctx.fillText('HOOP ' + (rawHoop.score * 100).toFixed(0) + '%', hx + 2, hy - 4);
    }

    /* Draw rim zone (green — target zone for shot analysis) ── */
    var rim = engine.rimZone;
    if (rim) {
      var rx = nx(rim.left);
      var ry = ny(rim.top);
      var rw = nw(rim.width);
      var rh = nh(rim.height);

      _ctx.strokeStyle = 'rgba(86, 211, 100, 0.7)';
      _ctx.lineWidth   = 2;
      _ctx.setLineDash([6, 3]);
      _ctx.strokeRect(rx, ry, rw, rh);
      _ctx.setLineDash([]);

      _ctx.fillStyle = 'rgba(86, 211, 100, 0.08)';
      _ctx.fillRect(rx, ry, rw, rh);

      _ctx.fillStyle   = 'rgba(86, 211, 100, 0.9)';
      _ctx.font        = 'bold 11px sans-serif';
      _ctx.fillText('RIM', rx + 4, ry - 5);
    }

    /* Draw ball dot ─────────────────────────────────────────── */
    var bp = engine.ballPosition;
    if (bp) {
      var bx = nx(bp.normX);
      var by = ny(bp.normY);

      /* Outer glow ring */
      _ctx.beginPath();
      _ctx.arc(bx, by, 16, 0, Math.PI * 2);
      _ctx.fillStyle = 'rgba(255, 107, 0, 0.18)';
      _ctx.fill();

      /* White outline */
      _ctx.beginPath();
      _ctx.arc(bx, by, 11, 0, Math.PI * 2);
      _ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      _ctx.lineWidth   = 2;
      _ctx.stroke();

      /* Orange fill */
      _ctx.shadowColor = 'rgba(255, 107, 0, 0.9)';
      _ctx.shadowBlur  = 14;
      _ctx.beginPath();
      _ctx.arc(bx, by, 9, 0, Math.PI * 2);
      _ctx.fillStyle = '#ff6b00';
      _ctx.fill();
      _ctx.shadowBlur = 0;
    }
  }

  /* ── Shot detected callback ─────────────────────────────── */
  function _onShotDetected(shotData) {
    var engine = window.ShotDetectionEngine;
    if (!engine) return;

    var made = shotData.result === 'made';

    /* Update HUD numbers */
    var madeEl = document.getElementById('sts-made');
    var attEl  = document.getElementById('sts-att');
    var pctEl  = document.getElementById('sts-pct');
    if (madeEl) madeEl.textContent = engine.stats.made;
    if (attEl)  attEl.textContent  = engine.stats.attempts;
    if (pctEl) {
      var p = engine.stats.attempts > 0
        ? Math.round((engine.stats.made / engine.stats.attempts) * 100)
        : 0;
      pctEl.textContent = p + '%';
    }

    /* Border flash */
    var flashEl = document.getElementById('sts-flash');
    if (flashEl) {
      if (_flashTm) clearTimeout(_flashTm);
      flashEl.className = 'sts-flash ' + (made ? 'sts-flash--made' : 'sts-flash--miss');
      _flashTm = setTimeout(function () { flashEl.className = 'sts-flash'; }, 700);
    }

    /* Shot toast */
    var toastEl = document.getElementById('sts-shot-toast');
    if (toastEl) {
      toastEl.textContent = made ? '\u2705 MADE!' : '\u274C MISS';
      toastEl.className = 'sts-shot-toast ' +
        (made ? 'sts-shot-toast--made' : 'sts-shot-toast--miss') +
        ' sts-shot-toast--show';
      setTimeout(function () { toastEl.className = 'sts-shot-toast'; }, 1200);
    }
  }

  /* ── Status change callback ─────────────────────────────── */
  function _onStatusChange(status) {
    var badge = document.getElementById('sts-mode-badge');
    if (!badge) return;
    var labels = {
      'loading':    '\u23F3 Loading AI\u2026',
      'ready':      '\u2705 YOLOX Ready',
      'detecting':  '\uD83D\uDD34 LIVE',
      'stopped':    '\u23F9 Stopped',
      'color-only': '\uD83C\uDFA8 Color Mode',
      'error':      '\u274C Error'
    };
    badge.textContent = labels[status] || status;
    badge.className   = 'sts-mode-badge sts-mode-badge--' + status;
  }

  /* ── Start YOLOX detection ──────────────────────────────── */
  function _startDetection() {
    var engine = window.ShotDetectionEngine;
    if (!engine) {
      console.warn('[ShotTrackingScreen] ShotDetectionEngine not available');
      return;
    }

    /* Reset */
    engine.resetStats();
    engine.setRimZone(DEFAULT_RIM_CX, DEFAULT_RIM_CY, DEFAULT_RIM_W, DEFAULT_RIM_H);
    engine.onShotDetected = _onShotDetected;
    engine.onStatusChange = _onStatusChange;
    engine.onBallUpdate   = null; // draw loop reads engine.ballPosition directly

    engine.init().then(function () {
      engine.start(_videoEl);
      _syncCanvasSize();
    });
  }

  /* ── Timeline (video mode) ──────────────────────────────── */
  function _updateTimeline() {
    var vid = _videoEl;
    if (!vid || !vid.duration || !isFinite(vid.duration)) return;
    var pct = (vid.currentTime / vid.duration) * 100;
    var tl = document.getElementById('sts-timeline');
    if (tl) tl.value = pct;
    var td = document.getElementById('sts-time-display');
    if (td) {
      var m = Math.floor(vid.currentTime / 60);
      var s = Math.floor(vid.currentTime % 60);
      td.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    }
  }

  function _onVideoEnded() {
    var pb = document.getElementById('sts-play-btn');
    if (pb) pb.textContent = '\u25B6 Replay';
    var engine = window.ShotDetectionEngine;
    if (engine) engine.stop();
  }

  function _togglePlay() {
    if (!_videoEl) return;
    if (_videoEl.paused) {
      _videoEl.play();
      var engine = window.ShotDetectionEngine;
      if (engine && !engine.isRunning) engine.start(_videoEl);
    } else {
      _videoEl.pause();
    }
  }

  /* ── Show error inside overlay ──────────────────────────── */
  function _showError(msg) {
    var errEl = document.getElementById('sts-error');
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
    _onStatusChange('error');
  }

  /* ── Open in camera mode ────────────────────────────────── */
  function _openCamera() {
    _buildOverlay();
    _cleanup();  /* stop any prior session */

    /* Reset error */
    var errEl = document.getElementById('sts-error');
    if (errEl) errEl.style.display = 'none';

    _mode   = 'camera';
    _isOpen = true;
    _overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    /* Hide video controls */
    var ctrl = document.getElementById('sts-controls');
    if (ctrl) ctrl.style.display = 'none';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      _showError('Camera not supported on this device.');
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    }).then(function (stream) {
      _stream         = stream;
      _videoEl.srcObject = stream;
      _videoEl.muted  = true;
      _videoEl.play().catch(function () {});
      _drawLoop();
    }).catch(function (err) {
      _showError('Camera access denied — please allow camera permissions.');
      console.warn('[ShotTrackingScreen] getUserMedia error:', err);
    });
  }

  /* ── Open in video file mode ────────────────────────────── */
  function _openVideo(file) {
    _buildOverlay();
    _cleanup();  /* stop any prior session */

    /* Reset error */
    var errEl = document.getElementById('sts-error');
    if (errEl) errEl.style.display = 'none';

    _mode   = 'video';
    _isOpen = true;
    _overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    /* Show video controls */
    var ctrl = document.getElementById('sts-controls');
    if (ctrl) ctrl.style.display = 'flex';

    /* Release previous object URL */
    if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null; }

    _objectUrl            = URL.createObjectURL(file);
    _videoEl.srcObject    = null;
    _videoEl.src          = _objectUrl;
    _videoEl.muted        = true;
    _videoEl.loop         = false;
    _videoEl.play().catch(function () {});

    /* detection starts via 'loadeddata' event */
    _drawLoop();
  }

  /* ── Internal cleanup (stop engine/stream without closing overlay) */
  function _cleanup() {
    if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
    var engine = window.ShotDetectionEngine;
    if (engine && engine.isRunning) engine.stop();
    if (_stream) {
      _stream.getTracks().forEach(function (t) { t.stop(); });
      _stream = null;
    }
    if (_videoEl) {
      _videoEl.pause();
      _videoEl.srcObject = null;
      _videoEl.src       = '';
      _videoEl.load();
    }
    if (_objectUrl) { URL.revokeObjectURL(_objectUrl); _objectUrl = null; }
  }

  /* ── Stop & close ───────────────────────────────────────── */
  function _stop() {
    _isOpen = false;
    _cleanup();

    if (_overlay) _overlay.classList.remove('active');
    document.body.style.overflow = '';

    /* Reset HUD */
    ['sts-made', 'sts-att'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '0';
    });
    var pctEl = document.getElementById('sts-pct');
    if (pctEl) pctEl.textContent = '\u2014%';
    var tl = document.getElementById('sts-timeline');
    if (tl) tl.value = 0;
    var td = document.getElementById('sts-time-display');
    if (td) td.textContent = '0:00';
  }

  /* ── Public API ─────────────────────────────────────────── */
  window.ShotTrackingScreen = { openCamera: _openCamera, openVideo: _openVideo, stop: _stop };

  /* ── Wire buttons on DOM ready ──────────────────────────── */
  function _wireButtons() {
    var launchBtn  = document.getElementById('ast-launch-btn');
    var uploadBtn  = document.getElementById('ast-upload-btn');
    var fileInput  = document.getElementById('ast-file-input');

    /* KE-style buttons (lab panel header) */
    var keLaunch = document.querySelector('.ke-ai-tracker__btn--primary');
    var keUpload = document.querySelector('.ke-ai-tracker__btn--secondary');

    if (launchBtn) launchBtn.addEventListener('click', _openCamera);
    if (keLaunch)  keLaunch.addEventListener('click',  _openCamera);

    function _triggerUpload() { if (fileInput) fileInput.click(); }
    if (uploadBtn) uploadBtn.addEventListener('click', _triggerUpload);
    if (keUpload)  keUpload.addEventListener('click',  _triggerUpload);

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (file) { _openVideo(file); fileInput.value = ''; }
      });
    }

    /* Glass AI analysis / stop buttons (The Lab panel) */
    document.querySelectorAll('.glass-ai-analysis-btn').forEach(function (btn) {
      btn.addEventListener('click', _openCamera);
    });
    document.querySelectorAll('.glass-stop-tracking-btn').forEach(function (btn) {
      btn.addEventListener('click', _stop);
    });
  }

  /* ── Pre-warm the YOLOX model in the background ─────────── */
  /* Start loading the 19MB ONNX model as soon as the page is ready,   */
  /* so by the time the user taps Upload/Camera it's already in memory. */
  function _preWarmModel() {
    var engine = window.ShotDetectionEngine;
    if (!engine || engine.model) return;   // already loaded or unavailable
    /* Run silently — no status UI change, no callbacks */
    var savedCb = engine.onStatusChange;
    engine.onStatusChange = null;
    engine.init().then(function () {
      engine.onStatusChange = savedCb;
      console.log('[ShotTrackingScreen] Model pre-warmed ✓');
    }).catch(function () {
      engine.onStatusChange = savedCb;
    });
  }

  function _boot() {
    _wireButtons();
    /* Delay pre-warm slightly so the page finishes rendering first */
    setTimeout(_preWarmModel, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    _boot();
  }

})();
