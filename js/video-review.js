/* ============================================================
   VIDEO REVIEW — js/video-review.js
   Post-session shot replay with trajectory overlay.
   Records camera during AI shot tracking, stores in IndexedDB,
   allows playback of individual shots with canvas overlay.
   ============================================================ */
(function () {
  'use strict';

  var DB_NAME = 'courtiq-video';
  var STORE_NAME = 'clips';
  var DB_VERSION = 1;
  var MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  var MAX_STORAGE_MB = 500;

  var _db = null;
  var _mediaRecorder = null;
  var _chunks = [];
  var _recordingStartTime = 0;
  var _shotTimestamps = [];

  /* ── IndexedDB ─────────────────────────────────────────── */
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (_db) { resolve(_db); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
        }
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror = function () { reject(new Error('IndexedDB open failed')); };
    });
  }

  function saveClip(sessionId, blob, shots) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        store.put({
          sessionId: sessionId,
          blob: blob,
          shots: shots,
          createdAt: new Date().toISOString()
        });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(new Error('Save failed')); };
      });
    });
  }

  function loadClip(sessionId) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var req = store.get(sessionId);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(new Error('Load failed')); };
      });
    });
  }

  function purgeOld() {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var req = store.openCursor();
        var cutoff = Date.now() - MAX_AGE_MS;
        req.onsuccess = function (e) {
          var cursor = e.target.result;
          if (!cursor) { resolve(); return; }
          var entry = cursor.value;
          if (entry.createdAt && new Date(entry.createdAt).getTime() < cutoff) {
            cursor.delete();
          }
          cursor.continue();
        };
        req.onerror = function () { resolve(); };
      });
    });
  }

  /* ── Recording ─────────────────────────────────────────── */
  function isSupported() {
    return typeof MediaRecorder !== 'undefined';
  }

  function startRecording(stream) {
    if (!isSupported() || !stream) return false;

    _chunks = [];
    _shotTimestamps = [];
    _recordingStartTime = Date.now();

    var mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }

    try {
      _mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
    } catch (e) {
      console.warn('[VideoReview] MediaRecorder init failed:', e);
      return false;
    }

    _mediaRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) _chunks.push(e.data);
    };

    _mediaRecorder.start(1000); // 1-second chunks
    return true;
  }

  function recordShotEvent(shotData) {
    if (!_mediaRecorder || _mediaRecorder.state !== 'recording') return;
    _shotTimestamps.push({
      timestamp: Date.now() - _recordingStartTime,
      result: shotData.result,
      shotX: shotData.shotX,
      shotY: shotData.shotY,
      trajectory: shotData.trajectory || [],
      shotZone: shotData.shotZone || 'midrange'
    });
  }

  function stopRecording() {
    return new Promise(function (resolve) {
      if (!_mediaRecorder || _mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      _mediaRecorder.onstop = function () {
        var blob = new Blob(_chunks, { type: _mediaRecorder.mimeType || 'video/webm' });
        var shots = _shotTimestamps.slice();
        _chunks = [];
        _shotTimestamps = [];
        _mediaRecorder = null;
        resolve({ blob: blob, shots: shots });
      };

      _mediaRecorder.stop();
    });
  }

  /* ── Replay UI ─────────────────────────────────────────── */
  function openReplay(sessionId, blob, shots) {
    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'video-review-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(14,16,20,0.97);display:flex;flex-direction:column;';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);';
    var title = document.createElement('div');
    title.style.cssText = 'font-family:var(--font-display,sans-serif);font-size:18px;font-weight:800;color:#fff;text-transform:uppercase;';
    title.textContent = 'Video Review';
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.5);font-size:24px;cursor:pointer;padding:4px 8px;';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', function () { closeReplay(overlay); });
    header.appendChild(title);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    // Main content
    var main = document.createElement('div');
    main.style.cssText = 'flex:1;display:flex;gap:12px;padding:16px;overflow:hidden;';

    // Video player area
    var playerWrap = document.createElement('div');
    playerWrap.style.cssText = 'flex:1;position:relative;background:#000;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;';

    var video = document.createElement('video');
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;';
    video.controls = false;
    video.playsInline = true;
    if (blob) video.src = URL.createObjectURL(blob);

    // Canvas overlay for trajectory
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';

    playerWrap.appendChild(video);
    playerWrap.appendChild(canvas);

    // Controls bar
    var controls = document.createElement('div');
    controls.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,0.04);border-radius:0 0 12px 12px;';

    var playBtn = document.createElement('button');
    playBtn.style.cssText = 'background:rgba(245,166,35,0.15);color:#f5a623;border:1px solid rgba(245,166,35,0.3);border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;';
    playBtn.textContent = '\u25b6 Play';
    playBtn.addEventListener('click', function () {
      if (video.paused) { video.play(); playBtn.textContent = '\u23f8 Pause'; }
      else { video.pause(); playBtn.textContent = '\u25b6 Play'; }
    });

    var slowBtn = document.createElement('button');
    slowBtn.style.cssText = 'background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer;';
    slowBtn.textContent = '0.5x';
    var isSlow = false;
    slowBtn.addEventListener('click', function () {
      isSlow = !isSlow;
      video.playbackRate = isSlow ? 0.5 : 1;
      slowBtn.style.color = isSlow ? '#f5a623' : 'rgba(255,255,255,0.6)';
    });

    var timeDisplay = document.createElement('span');
    timeDisplay.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.5);font-family:monospace;margin-left:auto;';
    timeDisplay.textContent = '0:00 / 0:00';

    controls.appendChild(playBtn);
    controls.appendChild(slowBtn);
    controls.appendChild(timeDisplay);

    var playerCol = document.createElement('div');
    playerCol.style.cssText = 'flex:1;display:flex;flex-direction:column;min-width:0;';
    playerCol.appendChild(playerWrap);
    playerCol.appendChild(controls);

    // Shot list sidebar
    var sidebar = document.createElement('div');
    sidebar.style.cssText = 'width:200px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;flex-shrink:0;';

    var sideTitle = document.createElement('div');
    sideTitle.style.cssText = 'font-size:13px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;';
    sideTitle.textContent = 'Shots (' + shots.length + ')';
    sidebar.appendChild(sideTitle);

    if (shots.length === 0) {
      var noShots = document.createElement('div');
      noShots.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.3);text-align:center;padding:20px;';
      noShots.textContent = 'No shots detected in this session.';
      sidebar.appendChild(noShots);
    }

    shots.forEach(function (shot, idx) {
      var card = document.createElement('button');
      card.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer;text-align:left;width:100%;transition:all 0.2s;';

      var icon = document.createElement('span');
      icon.style.cssText = 'font-size:20px;flex-shrink:0;';
      icon.textContent = shot.result === 'made' ? '\u2705' : '\u274c';

      var info = document.createElement('div');
      var num = document.createElement('div');
      num.style.cssText = 'font-size:13px;font-weight:700;color:#fff;';
      num.textContent = 'Shot ' + (idx + 1);
      var meta = document.createElement('div');
      meta.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);';
      var timeSec = Math.round(shot.timestamp / 1000);
      meta.textContent = formatTime(timeSec) + ' \u00b7 ' + (shot.shotZone || 'midrange');
      info.appendChild(num);
      info.appendChild(meta);

      card.appendChild(icon);
      card.appendChild(info);

      card.addEventListener('click', function () {
        // Seek to 1.5s before the shot
        var seekTo = Math.max(0, (shot.timestamp / 1000) - 1.5);
        video.currentTime = seekTo;
        video.play();
        playBtn.textContent = '\u23f8 Pause';
        // Highlight this card
        sidebar.querySelectorAll('button').forEach(function (b) { b.style.borderColor = 'rgba(255,255,255,0.08)'; });
        card.style.borderColor = '#f5a623';
        // Draw trajectory
        drawTrajectory(canvas, shot.trajectory, video.videoWidth, video.videoHeight, shot.result);
      });

      sidebar.appendChild(card);
    });

    main.appendChild(playerCol);
    main.appendChild(sidebar);
    overlay.appendChild(main);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Update time display
    video.addEventListener('timeupdate', function () {
      timeDisplay.textContent = formatTime(Math.floor(video.currentTime)) + ' / ' + formatTime(Math.floor(video.duration || 0));
    });

    // Auto-size canvas
    video.addEventListener('loadedmetadata', function () {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    });

    // Close on escape
    function onKey(e) { if (e.key === 'Escape') { closeReplay(overlay); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);
  }

  function closeReplay(overlay) {
    if (!overlay) return;
    var video = overlay.querySelector('video');
    if (video) {
      video.pause();
      if (video.src) URL.revokeObjectURL(video.src);
    }
    overlay.remove();
    document.body.style.overflow = '';
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  /* ── Trajectory drawing ────────────────────────────────── */
  function drawTrajectory(canvas, trajectory, vw, vh, result) {
    if (!canvas || !trajectory || trajectory.length < 2) return;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var scaleX = canvas.width / (vw || 1);
    var scaleY = canvas.height / (vh || 1);

    ctx.beginPath();
    ctx.strokeStyle = result === 'made' ? '#56d364' : '#f85149';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.globalAlpha = 0.8;

    for (var i = 0; i < trajectory.length; i++) {
      var pt = trajectory[i];
      var x = (pt.x || 0) * (canvas.width);
      var y = (pt.y || 0) * (canvas.height);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw endpoint dot
    if (trajectory.length > 0) {
      var last = trajectory[trajectory.length - 1];
      ctx.beginPath();
      ctx.arc((last.x || 0) * canvas.width, (last.y || 0) * canvas.height, 8, 0, Math.PI * 2);
      ctx.fillStyle = result === 'made' ? '#56d364' : '#f85149';
      ctx.globalAlpha = 0.9;
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  /* ── Init ───────────────────────────────────────────────── */
  purgeOld().catch(function () {});

  window.VideoReview = {
    isSupported: isSupported,
    startRecording: startRecording,
    recordShotEvent: recordShotEvent,
    stopRecording: stopRecording,
    saveClip: saveClip,
    loadClip: loadClip,
    openReplay: openReplay
  };
  if (typeof CourtIQ !== 'undefined') CourtIQ.register('VideoReview', window.VideoReview);
})();
