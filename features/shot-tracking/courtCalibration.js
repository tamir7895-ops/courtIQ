/* ══════════════════════════════════════════════════════════════
   COURT CALIBRATION — one-time-per-session tap-to-calibrate overlay
   ────────────────────────────────────────────────────────────────
   Establishes the floor homography for CourtPosition by having the
   user tap a few KNOWN court landmarks on a frozen camera frame.

   Why tap, not auto: fully-automatic line/arc fitting was measured
   (scratch/auto_calib_lab.py) to fail badly on real footage (~12 m
   error) — the arc doesn't cleanly separate from lane lines with
   classical CV, and the robust auto path (KaliCalib, a trained
   91-keypoint CNN) is both heavy AND less accurate than needed. A
   4-tap calibration is bulletproof and works on faded OUTDOOR courts
   precisely because the user identifies the points. Measured accuracy
   with a good homography: 3pt apex 4 cm, arc sides 15-22 cm.

   Landmarks (world coords in meters, origin = rim on the floor,
   +Z away from hoop, +X to the shooter's right facing the hoop). The
   default set uses the paint (lane) corners + FT-line ends — sharp,
   always painted, exact coordinates. Pass a custom `landmarks` for
   courts where the baseline is off-frame (behind-hoop framings).

   Self-contained: builds its own DOM overlay, no dependency on the
   app's screens/navigation. Wire it in with:

     CourtCalibration.start(videoEl, {
       spec: 'us_hs',
       onDone: function (ok) { ... },   // ok=false if user cancelled
       persistKey: 'courtiq-calib-v1'   // optional localStorage cache
     });

   Public API:
     CourtCalibration.start(videoEl, opts)
     CourtCalibration.cancel()
     CourtCalibration.restore(persistKey) -> bool   // reload cached H
     CourtCalibration.LANDMARK_SETS
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CP = (typeof window !== 'undefined') ? window.CourtPosition : null;

  /* Named landmark sets. Each entry: { key, label, world:[X,Z] }.
     us_hs spec values; CourtCalibration reads real numbers from
     CourtPosition.SPECS so FIBA/NBA courts scale automatically. */
  function buildSets(spec) {
    var s = (CP && CP.SPECS[spec]) || (CP && CP.SPECS.fiba) || { ftZ: 4.2, laneHalf: 2.45, threeR: 6.75 };
    return {
      // paint corners + FT ends — best when the baseline is visible
      lane: [
        { key: 'bl', label: 'Left baseline corner of the paint',  world: [-s.laneHalf, -1.575] },
        { key: 'br', label: 'Right baseline corner of the paint', world: [ s.laneHalf, -1.575] },
        { key: 'fl', label: 'Left end of the free-throw line',    world: [-s.laneHalf, s.ftZ] },
        { key: 'fr', label: 'Right end of the free-throw line',   world: [ s.laneHalf, s.ftZ] }
      ],
      // behind-hoop framing: baseline is under the camera. FT ends + arc top
      // + one lane baseline corner — deliberately NON-COLLINEAR (a degenerate
      // set with 3 points on the FT line silently produced a wrong H;
      // caught by scratch test, calibrateFromPoints now also rejects it).
      behind_hoop: [
        { key: 'fl', label: 'Left end of the free-throw line',    world: [-s.laneHalf, s.ftZ] },
        { key: 'fr', label: 'Right end of the free-throw line',   world: [ s.laneHalf, s.ftZ] },
        { key: 'at', label: 'Top of the 3-point arc',             world: [0, s.threeR] },
        { key: 'bl', label: 'Left baseline corner of the paint',  world: [-s.laneHalf, -1.575] }
      ]
    };
  }

  var _overlay = null, _state = null;

  function cleanup() {
    if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    _overlay = null; _state = null;
  }

  function finish(ok) {
    var st = _state, opts = st ? st.opts : null;
    if (ok && st) {
      var imgPts = st.landmarks.map(function (l) { return l.tapped; });
      var worldPts = st.landmarks.map(function (l) { return l.world; });
      ok = CP.calibrateFromPoints(imgPts, worldPts, st.vw, st.vh, st.spec);
      if (ok && opts && opts.persistKey) {
        try {
          localStorage.setItem(opts.persistKey, JSON.stringify({
            imgPts: imgPts, worldPts: worldPts, vw: st.vw, vh: st.vh, spec: st.spec
          }));
        } catch (e) { /* storage full / private mode — non-fatal */ }
      }
    }
    cleanup();
    if (opts && typeof opts.onDone === 'function') opts.onDone(!!ok);
  }

  function render() {
    var st = _state;
    var idx = st.tapIdx;
    // status text
    st.status.textContent = idx < st.landmarks.length
      ? ('Tap: ' + st.landmarks[idx].label + '  (' + (idx + 1) + '/' + st.landmarks.length + ')')
      : 'All points set — confirm or re-tap';
    // redraw dots
    while (st.dots.firstChild) st.dots.removeChild(st.dots.firstChild);
    st.landmarks.forEach(function (l, i) {
      if (!l.tapped) return;
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;' +
        'border:2px solid #fff;background:' + (i === idx ? '#ff5252' : '#4caf50') +
        ';left:' + (l.tapped[0] / st.vw * 100) + '%;top:' + (l.tapped[1] / st.vh * 100) + '%;';
      st.dots.appendChild(d);
    });
    st.confirm.style.display = st.landmarks.every(function (l) { return l.tapped; }) ? 'inline-block' : 'none';
  }

  function onTap(ev) {
    var st = _state;
    var rect = st.canvas.getBoundingClientRect();
    var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    var cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;
    // map display px -> native video px
    var vx = cx / rect.width * st.vw;
    var vy = cy / rect.height * st.vh;
    var idx = st.tapIdx;
    if (idx >= st.landmarks.length) idx = st.landmarks.length - 1;  // re-tap last
    st.landmarks[idx].tapped = [vx, vy];
    st.tapIdx = Math.min(idx + 1, st.landmarks.length);
    render();
  }

  var CourtCalibration = {
    LANDMARK_SETS: ['lane', 'behind_hoop'],

    start: function (videoEl, opts) {
      opts = opts || {};
      CP = window.CourtPosition;
      if (!CP) { if (opts.onDone) opts.onDone(false); return; }
      cleanup();
      var vw = videoEl.videoWidth || 1280, vh = videoEl.videoHeight || 720;
      var spec = opts.spec || 'fiba';
      var setName = opts.landmarkSet || 'lane';
      var landmarks = buildSets(spec)[setName].map(function (l) {
        return { key: l.key, label: l.label, world: l.world, tapped: null };
      });

      // freeze the current frame onto a canvas
      var canvas = document.createElement('canvas');
      canvas.width = vw; canvas.height = vh;
      canvas.getContext('2d').drawImage(videoEl, 0, 0, vw, vh);
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;';

      _overlay = document.createElement('div');
      _overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;' +
        'display:flex;flex-direction:column;touch-action:none;';
      var stage = document.createElement('div');
      stage.style.cssText = 'position:relative;flex:1;overflow:hidden;';
      var dots = document.createElement('div');
      dots.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      stage.appendChild(canvas); stage.appendChild(dots);

      var bar = document.createElement('div');
      bar.style.cssText = 'padding:12px 16px;background:#111;color:#fff;font:14px system-ui;' +
        'display:flex;gap:10px;align-items:center;';
      var status = document.createElement('div');
      status.style.cssText = 'flex:1;';
      var confirm = document.createElement('button');
      confirm.textContent = 'Confirm';
      confirm.style.cssText = 'padding:8px 16px;border:0;border-radius:8px;background:#4caf50;color:#fff;font-weight:600;';
      confirm.onclick = function () { finish(true); };
      var cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.style.cssText = 'padding:8px 16px;border:0;border-radius:8px;background:#444;color:#fff;';
      cancel.onclick = function () { finish(false); };
      bar.appendChild(status); bar.appendChild(cancel); bar.appendChild(confirm);

      _overlay.appendChild(stage); _overlay.appendChild(bar);
      document.body.appendChild(_overlay);

      canvas.addEventListener('click', onTap);
      canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onTap(e); }, { passive: false });

      _state = { opts: opts, spec: spec, vw: vw, vh: vh, landmarks: landmarks,
                 tapIdx: 0, canvas: canvas, dots: dots, status: status, confirm: confirm };
      render();
    },

    cancel: function () { finish(false); },

    /* Convenience: open the rear camera, wait for a frame, then run the
       tap-calibration on it. Same camera constraints as ShotTrackingScreen
       so the calibration is done at the SAME framing the session will use.
       opts.onDone(ok) fires after the user confirms/cancels; the stream is
       always stopped. opts.onError(err) for camera-permission failures. */
    startFromCamera: function (opts) {
      opts = opts || {};
      var self = this;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (opts.onError) opts.onError(new Error('camera unavailable'));
        return;
      }
      var video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.setAttribute('playsinline', '');
      var stream = null;
      function stop() { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); }
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      }).then(function (s) {
        stream = s; video.srcObject = s;
        return video.play();
      }).then(function () {
        // wait for a decoded frame with real dimensions
        var tries = 0;
        (function waitFrame() {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            var userDone = opts.onDone;
            self.start(video, Object.assign({}, opts, {
              onDone: function (ok) { stop(); if (userDone) userDone(ok); }
            }));
          } else if (tries++ < 100) {
            setTimeout(waitFrame, 50);
          } else {
            stop();
            if (opts.onError) opts.onError(new Error('no camera frame'));
          }
        })();
      }).catch(function (err) {
        stop();
        if (opts.onError) opts.onError(err);
      });
    },

    restore: function (persistKey) {
      CP = window.CourtPosition;
      if (!CP) return false;
      try {
        var j = JSON.parse(localStorage.getItem(persistKey));
        if (!j || !j.imgPts) return false;
        return CP.calibrateFromPoints(j.imgPts, j.worldPts, j.vw, j.vh, j.spec);
      } catch (e) { return false; }
    }
  };

  if (typeof window !== 'undefined') window.CourtCalibration = CourtCalibration;
  if (typeof module !== 'undefined' && module.exports) module.exports = CourtCalibration;
})();
