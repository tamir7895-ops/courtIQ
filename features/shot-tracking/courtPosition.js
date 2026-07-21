/* ══════════════════════════════════════════════════════════════
   COURT POSITION — shooter localization in real court meters
   ────────────────────────────────────────────────────────────────
   Maps the shooter's FEET (image coords) onto the court floor plane
   through a per-session homography, giving true court coordinates,
   real shot distance and an exact zone — replacing the image-space
   rim-offset heuristic (classifyV10Zone) whenever calibration exists.

   Architecture (from the 2026-07 competitor/patent research):
   HomeCourt-class apps compute a one-time-per-session camera
   projection and then project the shooter's foot pixel to the ground
   plane at release. We implement the floor-plane homography variant:
   4+ point correspondences (court landmarks the user taps once per
   session, or a lab-fitted matrix) -> DLT -> H. Feet from MediaPipe
   ankles / the engine's shooter centroid.

   Coordinate system (meters):
     origin = rim center projected to the floor
     +Z     = away from the hoop toward the court
     +X     = to the right when facing the hoop from the court
   Image coords are FULL-VIDEO normalized (0..1) — same space the
   engine uses for _shooterFeetX/Y — converted internally via vw/vh.

   Public API:
     CourtPosition.setCalibration({ H, spec, vw, vh })  // 3x3 row-major
     CourtPosition.calibrateFromPoints(imgPts, worldPts, vw, vh)
     CourtPosition.clear()
     CourtPosition.isCalibrated()
     CourtPosition.locate(normX, normY) -> { x, z, dist, zone } | null
     CourtPosition.SPECS                                  // court presets
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Court specs in meters. three_r = 3pt radius from rim-floor origin;
     corner_x = |X| where the arc meets the corner straight segments
     (courts with no straight segment: corner_x = three_r). */
  var SPECS = {
    fiba:  { ftZ: 4.225, laneHalf: 2.45,  threeR: 6.75, cornerX: 6.6,  ftCircleR: 1.8 },
    nba:   { ftZ: 4.191, laneHalf: 2.438, threeR: 7.24, cornerX: 6.71, ftCircleR: 1.829 },
    ncaa:  { ftZ: 4.191, laneHalf: 1.829, threeR: 6.75, cornerX: 6.6,  ftCircleR: 1.829 },
    us_hs: { ftZ: 4.191, laneHalf: 1.829, threeR: 6.02, cornerX: 6.02, ftCircleR: 1.829 }
  };

  var _H = null;        // world(X,Z,1) -> image px  (3x3, row-major array of 9)
  var _Hinv = null;
  var _spec = SPECS.fiba;
  var _vw = 0, _vh = 0;

  function inv3(m) {
    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5], g = m[6], h = m[7], i = m[8];
    var A = e * i - f * h, B = c * h - b * i, C = b * f - c * e;
    var det = a * A + d * B + g * C;
    if (!isFinite(det) || Math.abs(det) < 1e-12) return null;
    return [A / det, B / det, C / det,
            (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
            (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  }

  /* DLT homography from >=4 correspondences (world XZ meters -> image px).
     Normalized DLT with a Gaussian-elimination solve of A^T A x = A^T b —
     small and dependency-free; adequate for 4-8 hand-tapped points. */
  function dlt(worldPts, imgPts) {
    var n = worldPts.length;
    if (n < 4 || imgPts.length !== n) return null;
    // build A (2n x 8), b (2n): unknowns h11..h32 with h33=1
    var A = [], bv = [];
    for (var k = 0; k < n; k++) {
      var X = worldPts[k][0], Z = worldPts[k][1];
      var u = imgPts[k][0], v = imgPts[k][1];
      A.push([X, Z, 1, 0, 0, 0, -u * X, -u * Z]); bv.push(u);
      A.push([0, 0, 0, X, Z, 1, -v * X, -v * Z]); bv.push(v);
    }
    // normal equations M x = y  (8x8)
    var M = [], y = [];
    for (var r = 0; r < 8; r++) {
      M.push([0, 0, 0, 0, 0, 0, 0, 0]); y.push(0);
      for (var c2 = 0; c2 < 8; c2++) {
        var s = 0;
        for (var q = 0; q < A.length; q++) s += A[q][r] * A[q][c2];
        M[r][c2] = s;
      }
      var sy = 0;
      for (var q2 = 0; q2 < A.length; q2++) sy += A[q2][r] * bv[q2];
      y[r] = sy;
    }
    // gaussian elimination with partial pivoting
    for (var col = 0; col < 8; col++) {
      var piv = col;
      for (var r2 = col + 1; r2 < 8; r2++) if (Math.abs(M[r2][col]) > Math.abs(M[piv][col])) piv = r2;
      if (Math.abs(M[piv][col]) < 1e-12) return null;
      var tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
      var ty = y[col]; y[col] = y[piv]; y[piv] = ty;
      for (var r3 = 0; r3 < 8; r3++) {
        if (r3 === col) continue;
        var fkt = M[r3][col] / M[col][col];
        for (var c3 = col; c3 < 8; c3++) M[r3][c3] -= fkt * M[col][c3];
        y[r3] -= fkt * y[col];
      }
    }
    var hp = [];
    for (var r4 = 0; r4 < 8; r4++) hp.push(y[r4] / M[r4][r4]);
    hp.push(1);
    return hp;
  }

  function zoneOf(x, z, spec) {
    var dist = Math.sqrt(x * x + z * z);
    var absX = Math.abs(x);
    // beyond the arc? corner threes use the straight-segment X threshold
    var beyond = (z < 1.2 && absX >= spec.cornerX - 0.05) || dist >= spec.threeR - 0.05;
    if (beyond) {
      if (z < 2.0) return x < 0 ? 'lc' : 'rc';          // corners
      if (absX > dist * 0.5) return x < 0 ? 'lw' : 'rw'; // wings
      return 'top';
    }
    if (absX <= spec.laneHalf + 0.15 && z <= spec.ftZ + 0.25) return 'pnt';
    if (Math.abs(z - spec.ftZ) < 0.9 && absX < 1.2) return 'topmid';   // FT / top of key
    return x < 0 ? 'ml' : 'mr';
  }

  var CourtPosition = {
    SPECS: SPECS,

    setCalibration: function (opts) {
      if (!opts || !opts.H || opts.H.length !== 9) return false;
      var inv = inv3(opts.H);
      if (!inv) return false;
      _H = opts.H.slice();
      _Hinv = inv;
      _spec = SPECS[opts.spec] || _spec;
      _vw = opts.vw || 0; _vh = opts.vh || 0;
      return true;
    },

    calibrateFromPoints: function (imgPts, worldPts, vw, vh, spec) {
      // Degeneracy guard — GEOMETRIC, on the known world points. A set with 3
      // near-collinear points (e.g. 3 taps along the free-throw line) leaves
      // the homography rank-deficient: it still fits those 4 points (so a
      // round-trip check passes) but is arbitrary elsewhere. Reject if any
      // triangle among the points is degenerate relative to the point spread.
      if (!worldPts || worldPts.length < 4) return false;
      var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (var b = 0; b < worldPts.length; b++) {
        minX = Math.min(minX, worldPts[b][0]); maxX = Math.max(maxX, worldPts[b][0]);
        minZ = Math.min(minZ, worldPts[b][1]); maxZ = Math.max(maxZ, worldPts[b][1]);
      }
      var span = Math.max((maxX - minX) * (maxZ - minZ), 1e-6);
      var n = worldPts.length, minArea = Infinity;
      for (var i2 = 0; i2 < n; i2++) for (var j = i2 + 1; j < n; j++) for (var k = j + 1; k < n; k++) {
        var ax = worldPts[j][0] - worldPts[i2][0], az = worldPts[j][1] - worldPts[i2][1];
        var bx = worldPts[k][0] - worldPts[i2][0], bz = worldPts[k][1] - worldPts[i2][1];
        minArea = Math.min(minArea, Math.abs(ax * bz - az * bx) * 0.5);
      }
      if (minArea / span < 0.02) return false;    // some triple is collinear

      var H = dlt(worldPts, imgPts);
      if (!H) return false;
      // Round-trip guard (catches a bad numeric solve even on a good set).
      for (var i = 0; i < worldPts.length; i++) {
        var X = worldPts[i][0], Z = worldPts[i][1];
        var w = H[6] * X + H[7] * Z + H[8];
        if (Math.abs(w) < 1e-9) return false;
        var u = (H[0] * X + H[1] * Z + H[2]) / w;
        var v = (H[3] * X + H[4] * Z + H[5]) / w;
        if (Math.abs(u - imgPts[i][0]) > 3 || Math.abs(v - imgPts[i][1]) > 3) return false;
      }
      return this.setCalibration({ H: H, spec: spec, vw: vw, vh: vh });
    },

    clear: function () { _H = null; _Hinv = null; },
    isCalibrated: function () { return !!_Hinv; },

    /* normX/normY: shooter feet in normalized full-video coords.
       Returns court position, true distance from the rim, and zone. */
    locate: function (normX, normY) {
      if (!_Hinv || !_vw || !_vh) return null;
      var u = normX * _vw, v = normY * _vh;
      var X = _Hinv[0] * u + _Hinv[1] * v + _Hinv[2];
      var Z = _Hinv[3] * u + _Hinv[4] * v + _Hinv[5];
      var W = _Hinv[6] * u + _Hinv[7] * v + _Hinv[8];
      if (!isFinite(W) || Math.abs(W) < 1e-9) return null;
      X /= W; Z /= W;
      // reject absurd projections (bad calibration or off-court point)
      if (!isFinite(X) || !isFinite(Z) || Math.abs(X) > 12 || Z < -3 || Z > 18) return null;
      var dist = Math.sqrt(X * X + Z * Z);
      return { x: X, z: Z, dist: dist, zone: zoneOf(X, Z, _spec) };
    }
  };

  if (typeof window !== 'undefined') window.CourtPosition = CourtPosition;
  if (typeof module !== 'undefined' && module.exports) module.exports = CourtPosition;
})();
