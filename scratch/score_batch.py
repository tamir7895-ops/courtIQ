"""Score the batch harness against human GT using the APP's actual chains:
  static mode -> classifyRange port (ring-cross + inside-net)   [offlineProcessor.js:161]
  track mode  -> v7 dwell chain (fixture/entry/departure/dwell/exit/re-rise) [replay_v7.py]
Reads det_/zoom_ CSVs + report_*.json produced by batch_eval.py — no inference,
so rule iterations take seconds.
Usage: python score_batch.py [tag ...] [--suf=_v7] [--trace]
"""
import csv, glob, json, os, sys
from collections import defaultdict

import numpy as np

SCRATCH = os.path.dirname(os.path.abspath(__file__))
BATCH = os.path.join(SCRATCH, "batch")
FPS = 30.0
HOOP_MIN = 0.08
med = lambda a: sorted(a)[len(a) // 2] if a else 0.0

SUF = ""
FORCE = None
SUBSAMPLE = int(os.environ.get("SB_SUBSAMPLE", "1"))
for _a in sys.argv:
    if _a.startswith("--suf="):
        SUF = _a.split("=", 1)[1]
    if _a.startswith("--force-chain="):
        FORCE = _a.split("=", 1)[1]

# ── A5 threshold sweep knobs (env-overridable; defaults = shipped behavior) ──
_f = lambda k, d: float(os.environ.get(k, d))
RING_CROSS_MULT = _f("SB_RING_CROSS_MULT", 0.95)   # static ring-cross x-tol (× halfW)
INSET_XMULT     = _f("SB_INSET_XMULT",     0.70)   # static inside-net x-tol (× halfW)
END_CENTER      = _f("SB_END_CENTER",      0.035)  # track end-centering max |x|
SPAN_CAP        = _f("SB_SPAN_CAP",        0.032)  # track run x-span cap

# ── M6 recal knobs (2026-07-23 dwell forensics; defaults = shipped v7b1
#    behavior, i.e. OFF). The m6 model tracks miss-deflection hovers the
#    dwell rule reads as makes; the discriminators are GEOMETRIC:
#    depth  — a no-exit dwell must actually get below the ring plane
#             (night_d FM 13.4: 5f "dwell" with deepest dy −0.005)
#    prog   — a no-exit dwell must DESCEND, not hover statically
#             (night_c FM 6.8: dy 0.044±0.002 for 6 frames)
#    cone   — the exit descent must stay in the net funnel
#             (night_c FMs 4.8/11.9: descents at |dx| 1.7-4hw exit-side) ──
MIN_DEPTH = _f("SB_MIN_DEPTH", 0.0)   # no-exit dwell: max run dy must reach this
MIN_PROG  = _f("SB_MIN_PROG",  0.0)   # no-exit dwell: max-min run dy at least this
EXIT_CONE = _f("SB_EXIT_CONE", 0.08)  # exit-chain |x-ringX| cap (abs norm)
# uc15 finding: a NET-KNOT fixture at ring center can EAT the through-net
# evidence of real makes (m6 scores the knot high, so the 2.5x-median score
# exemption never fires). A ball is MOVING; the knot is not. SB_FIX_TRAJ=1
# exempts obs that CONTINUE a trajectory from outside the fixture cells.
FIX_TRAJ = os.environ.get("SB_FIX_TRAJ", "0") == "1"
# SB_RERISE=1: static-chain in-and-out veto — a ring-cross M is revoked when
# strong obs reappear ABOVE the plane near the rim right after the crossing
# (dish 49.4 under m6). The track chain has always had this kill.
RERISE = os.environ.get("SB_RERISE", "0") == "1"

# ── Net-motion evidence (competitor-style "the net moved") ──
# SB_DEPART=1: static-chain departure veto — a ring-cross M is revoked when,
#   within 8 frames after the crossing, the ball shows up far OUTSIDE the net
#   cone laterally (|dx| > 1.6×halfW) at net height while never being seen
#   deep inside the cone — the rim-deflection signature (portrait_v3 22.1 GT X).
# SB_NETQUIET=1: quiet-net veto — an M with a dead net (per-frame motion
#   energy in the net cone: peak < 0.04 and burst ≤ 2 within the window) is
#   revoked; a real make whips the net (weakest true make measured: peak
#   0.049, phantom: 0.032/1f). Needs frames/<tag>/ on disk.
DEPART   = os.environ.get("SB_DEPART", "0") == "1"
NETQUIET = os.environ.get("SB_NETQUIET", "0") == "1"
# SB_ARC=1: arc-origin gate — an arrival only counts when the above-ring ball
#   belongs to a track that ORIGINATED at/below ring level (a real shot rises
#   from the shooter; clip-cut/pass balls appear above the ring from nowhere).
ARC      = os.environ.get("SB_ARC", "0") == "1"
ARC_ORIGIN_TOL = _f("SB_ARC_ORIGIN_TOL", 0.02)   # track start may be up to this ABOVE ring
# SB_NETBURST=1: HomeCourt-style net-movement MAKE evidence for TRACK mode —
#   a window judged X gets flipped to M when the net cone shows a strong
#   motion burst (peak moved-pixel fraction ≥ SB_NETBURST_PEAK). Night makes
#   whip the net hard (1.1M: 0.28) while the noisiest rim-out measured 0.097.
NETBURST      = os.environ.get("SB_NETBURST", "0") == "1"
NETBURST_PEAK = _f("SB_NETBURST_PEAK", 0.15)

# SB_TRACKFILL=1: bridge detection dropout at the rim. Associate the near-rim
#   per-frame obs into short tracks (constant-velocity gate), then LINEARLY
#   interpolate the gap frames BETWEEN two real anchors of the same track (never
#   extrapolate past the last detection — that is the L31 ghost bug). Recovers
#   makes whose through-rim frames dropped out (night_c 1.1s: 5-frame gap at the
#   crossing broke the dwell run). Interpolated points carry a modest synthetic
#   score so they clear the ball floor but never dominate a real detection.
TRACKFILL     = os.environ.get("SB_TRACKFILL", "1") == "1"   # SHIPPED DEFAULT ON (offlineProcessor.js bridgeTrackGaps)
TRACKFILL_MAX = int(_f("SB_TRACKFILL_MAX", 8))    # max gap (frames) to bridge
TRACKFILL_S   = _f("SB_TRACKFILL_S", 0.12)        # synthetic score for filled pts

def trackfill_obs(obs, N):
    """Greedy CV tracker over near-rim obs; fill within-track gaps by linear
    interpolation. Mutates a COPY and returns it. obs[fi] = [(x,y,s),...]."""
    filled = [list(fr) for fr in obs]
    open_t = []           # each: dict(pts=[(f,x,y,s)], vx, vy, last_f)
    tracks = []
    for f in range(N):
        cand = sorted(obs[f], key=lambda d: -d[2])
        used = [False] * len(cand)
        for tr in open_t:
            dt = f - tr["last_f"]
            px = tr["pts"][-1][1] + tr["vx"] * dt
            py = tr["pts"][-1][2] + tr["vy"] * dt
            gate = 0.045 + 0.02 * (dt - 1)          # widen with the gap
            best, bd = None, gate
            for i, d in enumerate(cand):
                if used[i]: continue
                dist = abs(d[0] - px) + abs(d[1] - py)
                if dist < bd: best, bd = i, dist
            if best is not None:
                used[best] = True
                d = cand[best]; pf, pxx, pyy, _ = tr["pts"][-1]; step = max(1, f - pf)
                tr["vx"] = 0.4 * tr["vx"] + 0.6 * (d[0] - pxx) / step
                tr["vy"] = 0.4 * tr["vy"] + 0.6 * (d[1] - pyy) / step
                tr["pts"].append((f, d[0], d[1], d[2])); tr["last_f"] = f
        for i, d in enumerate(cand):
            if not used[i] and d[2] >= 0.05:
                open_t.append(dict(pts=[(f, d[0], d[1], d[2])], vx=0.0, vy=0.0, last_f=f))
        keep = []
        for t in open_t:
            (tracks.append(t) if f - t["last_f"] > TRACKFILL_MAX else keep.append(t))
        open_t = keep
    tracks.extend(open_t)
    for tr in tracks:
        pts = tr["pts"]
        if len(pts) < 2: continue
        for a in range(len(pts) - 1):
            fa, xa, ya, _ = pts[a]; fb, xb, yb, _ = pts[a + 1]
            gap = fb - fa
            if gap < 2 or gap > TRACKFILL_MAX: continue
            for g in range(1, gap):
                r = g / gap
                fi = fa + g
                xf, yf = xa + r * (xb - xa), ya + r * (yb - ya)
                # only add if the frame lacks a real near-anchor already
                if any(abs(p[0] - xf) + abs(p[1] - yf) < 0.02 for p in filled[fi]):
                    continue
                filled[fi].append((xf, yf, TRACKFILL_S))
    return filled

# ── Lightweight ball tracker (greedy tracking-by-detection) ─────────────
def build_ball_tracks(dets_by_f, N):
    """dets_by_f: {frame: [(x,y,s),...]} over ALL balls. Returns list of tracks,
    each dict(pts=[(f,x,y)], origin_y, start_f) + an owner lookup."""
    open_t, done = [], []
    for f in range(N):
        ds = sorted(dets_by_f.get(f, []), key=lambda d: -d[2])
        keep = []
        for d in ds:
            if all(abs(d[0]-k[0]) + abs(d[1]-k[1]) > 0.015 for k in keep):
                keep.append(d)
        used = [False] * len(keep)
        for tr in open_t:
            dt = f - tr["last_f"]
            px = tr["pts"][-1][1] + tr["vx"] * dt
            py = tr["pts"][-1][2] + tr["vy"] * dt
            gate = 0.045 + 0.015 * (dt - 1)
            best, bd = None, gate
            for i, d in enumerate(keep):
                if used[i]: continue
                dist = abs(d[0]-px) + abs(d[1]-py)
                if dist < bd: best, bd = i, dist
            if best is not None:
                used[best] = True
                d = keep[best]
                pf, pxx, pyy = tr["pts"][-1]
                step = max(1, f - pf)
                tr["vx"] = 0.4 * tr["vx"] + 0.6 * (d[0]-pxx) / step
                tr["vy"] = 0.4 * tr["vy"] + 0.6 * (d[1]-pyy) / step
                tr["pts"].append((f, d[0], d[1])); tr["last_f"] = f
        for i, d in enumerate(keep):
            if not used[i] and d[2] >= 0.05:
                open_t.append(dict(pts=[(f, d[0], d[1])], vx=0.0, vy=0.0, last_f=f))
        open_t, expired = [t for t in open_t if f - t["last_f"] <= 8], [t for t in open_t if f - t["last_f"] > 8]
        done.extend(expired)
    done.extend(open_t)
    owner = {}
    for tr in done:
        if len(tr["pts"]) < 2: continue
        for (f, x, y) in tr["pts"]:
            owner[(f, round(x, 3), round(y, 3))] = tr
    return done, owner

def track_origin_ok(owner, f, x, y, ring_y, ring_cx):
    """Veto only on POSITIVE evidence of a foreign ball: the owning track was
    born ABOVE the ring line AND far from the hoop horizontally (lateral pass
    / clip cut). Unowned balls PASS (detection density varies); close-range
    releases/put-backs are born above the ring line but NEAR the hoop, so
    y-only veto is wrong (it deleted a real v3 attempt in the JS verify)."""
    best, bd = None, 0.05
    for (kf, kx, ky), tr in owner.items():
        if kf != f: continue
        d = abs(kx - x) + abs(ky - y)
        if d < bd: best, bd = tr, d
    if best is None:
        return True
    born_above = best["pts"][0][2] < ring_y - ARC_ORIGIN_TOL
    born_far = abs(best["pts"][0][1] - ring_cx) > 0.12
    return not (born_above and born_far)

# GT: frame-verified 2026-07-13 (night_b/c/d annotated from diagv_* sheets;
# portrait_v3 from gt/ground_truth.json 'v3' — human-annotated in June).
GT = {
    # court_b: the user's real-court SCREEN RECORDING (2026-07-21, 10:50 session).
    # CONTAMINATED ASSET — annotate-with-care: 0-40s the camera feed was BLACK
    # (the black-camera bug), the app's own red rim ellipse is DRAWN on the
    # frame (pollutes the ring color scan), and the clip ends on session-end UI.
    # Only 3 real shots are visible; windows in the black period are phantoms.
    "court_b": [(44.5, "M"), (52.5, "X"), (56.2, "X")],
    # dish flagship (www/_test_video.mp4 -> eval_videos/dish.mp4), GT 14/14
    # from the p12 hand annotation; times from the app window log.
    "dish": [(1.5, "M"), (5.0, "M"), (8.5, "M"), (12.0, "X"), (15.4, "M"),
             (19.9, "M"), (23.5, "M"), (27.2, "M"), (30.6, "X"), (34.0, "M"),
             (38.5, "M"), (42.4, "M"), (45.9, "X"), (49.4, "X")],
    # uc15 = user's HELD-OUT court clip (never trained on). User-provided
    # sequence (2026-07-23) X M X X M X X M X M M M X M X M M paired to the
    # 17 fixture-suppressed arrival events (22 arrivals, rebounds <2s merged).
    # The ring-area fixture here is the NET KNOT in daylight side view —
    # fires as ball 73-82% of frames (next-cycle hard negative).
    # uc16 = behind-shoulder clip (user seq MMXMMXXMXMMXM, 15 arrivals ->
    # 13 after <2.5s rebound merge). NOTE: 87 frames of this clip were in
    # training (detection-level leak); verdict rules never saw it.
    "uc16": [(0.1, "M"), (3.9, "M"), (10.0, "X"), (17.3, "M"), (23.5, "M"),
             (27.1, "X"), (35.6, "X"), (41.2, "M"), (44.3, "X"), (47.5, "M"),
             (50.5, "M"), (56.9, "X"), (67.2, "M")],
    "uc15": [(4.4, "X"), (7.6, "M"), (11.4, "X"), (15.0, "X"), (20.2, "M"),
             (26.8, "X"), (31.4, "X"), (35.5, "M"), (41.2, "X"), (43.3, "M"),
             (48.3, "M"), (55.6, "M"), (60.5, "X"), (65.0, "M"), (70.3, "X"),
             (75.9, "M"), (82.5, "M")],
    "night_b": [(20.4, "X")],
    "night_c": [(1.1, "M"), (5.6, "X"), (8.6, "X"), (9.2, "X"), (12.4, "X"),
                (15.0, "M"), (16.6, "X")],
    "night_d": [(6.6, "X"), (16.5, "X")],
    "portrait_v3": [(1.0, "X"), (2.0, "M"), (4.2, "M"), (5.0, "M"), (7.5, "M"),
                    (11.3, "M"), (14.8, "M"), (22.1, "X"), (26.4, "M"),
                    (30.4, "X"), (31.5, "M")],
    # indoor_v2: model-blind (hoop cov 2%) — training source, not a verdict gate
}

RING_GT = {
    # from gt/ground_truth.json true_rim (frame-verified June GT)
    "portrait_v3": {"halfW": 0.065},
}

def load_video(tag):
    rep_p = os.path.join(BATCH, f"report_{tag}{SUF}.json")
    if not os.path.exists(rep_p):
        rep_p = os.path.join(BATCH, f"report_{tag}.json")
    rep = json.load(open(rep_p))
    N = rep["frames"]
    raw = {}
    hoop_ws = []
    with open(os.path.join(BATCH, f"det_{tag}{SUF}.csv")) as f:
        for r in csv.DictReader(f):
            if r["class"] != "hoop": continue
            fi = int(r["frame"]); s = float(r["score"])
            if s < HOOP_MIN: continue
            hoop_ws.append(float(r["w_n"]))
            if fi not in raw or s > raw[fi][0]:
                raw[fi] = (s, float(r["cx_n"]), float(r["cy_n"]), float(r["w_n"]), float(r["h_n"]))
    obs_idx = sorted(raw.keys()); sm = {}
    for fi in obs_idx:
        win = [raw[j][1:] for j in obs_idx if abs(j - fi) <= 8]
        sm[fi] = [med([w[k] for w in win]) for k in range(4)]
    xs = np.array(obs_idx, dtype=float); full = np.arange(N, dtype=float)
    tr = np.zeros((N, 4))
    for k in range(4):
        tr[:, k] = np.interp(full, xs, np.array([sm[i][k] for i in obs_idx]))
    ring = rep["ring"]
    # halfW floor-fallback: color scan can collapse to the 0.030 clamp on rims
    # whose color the mask misses; the rim is ~0.38x the hoop bbox width
    # (calibrated on v1: half 0.030 / bbox w 0.077).
    half = ring["half"]
    if tag in RING_GT:
        half = RING_GT[tag].get("halfW", half)
    elif half <= 0.0301:
        print(f"  [{tag}] WARN: ring halfW at scan floor — verify ring before trusting verdicts")
    rings = [(tr[fi][0] + ring["dx"], tr[fi][1] + ring["dy"]) for fi in range(N)]
    balls = defaultdict(list)
    with open(os.path.join(BATCH, f"det_{tag}{SUF}.csv")) as f:
        for r in csv.DictReader(f):
            if r["class"] == "ball":
                balls[int(r["frame"])].append((float(r["cx_n"]), float(r["cy_n"]), float(r["score"])))
    with open(os.path.join(BATCH, f"zoom_{tag}{SUF}.csv")) as f:
        for r in csv.DictReader(f):
            balls[int(r["frame"])].append((float(r["cx_n"]), float(r["cy_n"]), float(r["score"])))
    obs = []
    for fi in range(N):
        rcx, rcy = rings[fi]
        near = [(x, y, s) for (x, y, s) in balls.get(fi, [])
                if abs(x - rcx) < 0.17 and rcy - 0.24 < y < rcy + 0.14]
        near.sort(key=lambda o: -o[2]); keep = []
        for o in near:
            if all(abs(o[0] - k[0]) + abs(o[1] - k[1]) > 0.02 for k in keep): keep.append(o)
            if len(keep) >= 5: break
        obs.append(keep)
    if SUBSAMPLE > 1:
        obs = obs[::SUBSAMPLE]
        rings = rings[::SUBSAMPLE]
        N = len(obs)
        global FPS
        FPS = 30.0 / SUBSAMPLE
    if TRACKFILL:
        obs = trackfill_obs(obs, N)
    return rep, N, rings, half, obs

def arrivals_of(N, rings, obs, is_fixture=None, arc_gate=None):
    GAP, CAP = round(0.8 * FPS), round(2.6 * FPS)
    arr = []
    for fi in range(N):
        rcx, rcy = rings[fi]
        cand = [o for o in obs[fi] if o[1] < rcy - 0.012]
        if is_fixture:
            cand = [o for o in cand if not is_fixture(o[0] - rcx, o[1] - rcy, o[2])]
        if arc_gate:
            cand = [o for o in cand if arc_gate(fi, o[0], o[1])]
        if cand:
            if not arr or fi - arr[-1][1] > GAP: arr.append([fi, fi])
            else: arr[-1][1] = fi
    wins = []
    for i, a in enumerate(arr):
        end = arr[i + 1][0] - 1 if i + 1 < len(arr) else N - 1
        wins.append((a[0], min(end, a[0] + CAP)))
    return wins

# ── Net-motion energy (per-frame moved-pixel fraction in the net cone) ──
_NETE_CACHE = {}
def net_energy(tag, ring_cx, ring_y, half, N):
    if tag in _NETE_CACHE:
        return _NETE_CACHE[tag]
    cache_p = os.path.join(BATCH, f"netE_{tag}.json")
    if os.path.exists(cache_p):
        _NETE_CACHE[tag] = json.load(open(cache_p))
        return _NETE_CACHE[tag]
    import cv2
    files = sorted(glob.glob(os.path.join(SCRATCH, "frames", tag, "*.jpg")))
    if not files:
        _NETE_CACHE[tag] = None
        return None
    vh, vw = cv2.imread(files[0]).shape[:2]
    nx0 = int(max(0, (ring_cx - half * 0.85) * vw)); nx1 = int(min(vw, (ring_cx + half * 0.85) * vw))
    ny0 = int(ring_y * vh); ny1 = int(min(vh, (ring_y + 2 * half * 1.6) * vh))
    out = [0.0] * min(N, len(files))
    prev = None
    for i in range(len(out)):
        g = cv2.cvtColor(cv2.imread(files[i]), cv2.COLOR_BGR2GRAY).astype(np.int16)
        if prev is not None and ny1 > ny0 and nx1 > nx0:
            out[i] = float((np.abs(g - prev)[ny0:ny1, nx0:nx1] > 18).mean())
        prev = g
    json.dump(out, open(cache_p, "w"))
    _NETE_CACHE[tag] = out
    return out

# ── APP static chain: classifyRange port ─────────────────────────────
def classify_static(obs, ring_cx, ring_y, half, f0, f1, netE=None):
    def best_of(i):
        return max(obs[i], key=lambda o: o[2]) if obs[i] else None

    def net_is_quiet():
        # a real make whips the net; a phantom/foliage "crossing" doesn't.
        if not NETQUIET or netE is None: return False
        seg = netE[f0:min(f1 + 1, len(netE))]
        if not seg: return False
        return max(seg) < 0.04 and sum(1 for v in seg if v > 0.02) <= 2

    def re_rose(cross_f):
        # M6 recal: in-and-out signature — the ball momentarily crosses the
        # plane, then STRONG obs reappear ABOVE the ring near the rim and
        # roll off (dish 49.4 GT X under m6: crossing f1489, then s 0.87-0.91
        # obs at dy -0.023..-0.033 for 8 frames). A true make is inside the
        # net after its crossing — nothing strong reappears above the plane.
        # Mirrors the track chain's re-rise kill (always shipped there).
        if not RERISE: return False
        if os.environ.get("SB_RERISE_DEBUG"):
            print(f"    [rerise? cross_f={cross_f}] ring_y={ring_y:.4f} half={half:.4f}")
            for k in range(cross_f + 1, min(cross_f + 9, f1 + 1, len(obs))):
                for o in obs[k]:
                    print(f"      f{k} x={o[0]:.3f} y={o[1]:.3f} dy={o[1]-ring_y:+.4f} adx={abs(o[0]-ring_cx):.4f} s={o[2]:.2f}")
        for k in range(cross_f + 1, min(cross_f + 9, f1 + 1, len(obs))):
            for o in obs[k]:
                if o[2] >= 0.30 and (o[1] - ring_y) <= -0.02 and \
                   abs(o[0] - ring_cx) <= half * 2.5:
                    return True
        return False

    def deflected_out(cross_f):
        # rim-deflection signature: right after the crossing the ball shows up
        # far OUTSIDE the cone laterally at net height, and never deep inside.
        if not DEPART: return False
        outward = inside = False
        for k in range(cross_f + 1, min(cross_f + 9, f1 + 1, len(obs))):
            for o in obs[k]:
                dy = o[1] - ring_y
                if not (0.0 <= dy <= 0.10): continue
                adx = abs(o[0] - ring_cx)
                if adx > half * 1.6: outward = True
                elif adx <= half * 0.7 and dy >= 0.02: inside = True
        return outward and not inside

    prev_f, prev_b = -1, None
    for i in range(f0, f1 + 1):
        b = best_of(i)
        if b is None: continue
        if prev_b and (i - prev_f) <= 6 and prev_b[1] < ring_y <= b[1]:
            r = (ring_y - prev_b[1]) / max(b[1] - prev_b[1], 1e-6)
            x_at = prev_b[0] + r * (b[0] - prev_b[0])
            if abs(x_at - ring_cx) <= half * RING_CROSS_MULT:
                if deflected_out(i) or re_rose(i):
                    prev_f, prev_b = i, b
                    continue          # revoked — keep scanning
                if net_is_quiet():
                    return "X", f"quiet-net veto (cross x={x_at:.3f} f={i})"
                return "M", f"ring-cross x={x_at:.3f} f={i}"
        prev_f, prev_b = i, b
    for j in range(f0, f1 + 1):
        for o in obs[j]:
            if ring_y + 0.008 <= o[1] <= ring_y + 0.062 and abs(o[0] - ring_cx) <= half * INSET_XMULT:
                if re_rose(j): continue     # in-and-out: the dip is momentary
                if net_is_quiet():
                    return "X", f"quiet-net veto (inside-net f={j})"
                return "M", f"inside-net ({o[0]:.3f},{o[1]:.3f}) f={j}"
    return "X", "no through evidence"

# ── APP track chain: v7 dwell (replay_v7.py verbatim) ────────────────
def make_v7(obs, rings, N):
    CELL = 0.015
    cells = defaultdict(lambda: [0, []])
    for fi in range(N):
        rcx, rcy = rings[fi]
        seen = set()
        for (x, y, s) in obs[fi]:
            k = (round((x - rcx) / CELL), round((y - rcy) / CELL))
            if k in seen:
                cells[k][1].append(s); continue
            seen.add(k); cells[k][0] += 1; cells[k][1].append(s)
    FIX = [(k[0] * CELL, k[1] * CELL, med(sc)) for k, (hits, sc) in cells.items()
           if hits >= 0.08 * N]

    def _fix_cell(dx, dy, s):
        return any(abs(dx - fx) <= 0.012 and abs(dy - fy) <= 0.012 and s <= max(2.5 * ms, 0.10)
                   for (fx, fy, ms) in FIX)

    # trajectory-continuation exemption: obs o at frame f escapes fixture
    # suppression if some obs in f-1/f-2 sits within reach of o but OUTSIDE
    # every fixture cell — the ball travelled INTO the knot's cell.
    continuing = [set() for _ in range(N)]
    if FIX_TRAJ:
        for fi in range(N):
            rcx, rcy = rings[fi]
            for (x, y, s) in obs[fi]:
                if not _fix_cell(x - rcx, y - rcy, s): continue
                hit = False
                for pf in (fi - 1, fi - 2):
                    if pf < 0: break
                    pcx, pcy = rings[pf]
                    for (px, py, ps) in obs[pf]:
                        if _fix_cell(px - pcx, py - pcy, ps): continue
                        if abs(px - x) <= 0.035 and abs(py - y) <= 0.035 and ps >= 0.10:
                            hit = True; break
                    if hit: break
                if hit: continuing[fi].add((round(x, 4), round(y, 4)))

    def is_fixture(dx, dy, s, fi=None):
        if not _fix_cell(dx, dy, s): return False
        if FIX_TRAJ and fi is not None:
            rcx, rcy = rings[fi]
            if (round(dx + rcx, 4), round(dy + rcy, 4)) in continuing[fi]:
                return False
        return True
    BAND = lambda dy, dx: -0.015 <= dy <= 0.055 and abs(dx) <= 0.05

    def classify(f0, f1):
        lim = min(f1 + 1, N)
        for a in range(f0, lim):
            acx, acy = rings[a]
            ent = None
            for p in obs[a]:
                ady = p[1] - acy
                if -0.13 <= ady <= -0.012 and abs(p[0] - acx) <= 0.09:
                    if ent is None or p[2] > ent[2]: ent = p
            if ent is None: continue
            dep = False
            for k in range(a + 1, min(a + 7, lim)):
                kcx, kcy = rings[k]
                for q in obs[k]:
                    qdx, qdy = q[0] - kcx, q[1] - kcy
                    if not (0.07 <= abs(qdx) <= 0.14 and -0.05 <= qdy <= 0.05 and q[2] >= 0.03): continue
                    if abs(q[0] - ent[0]) > 0.05 * (k - a) + 0.02: continue
                    pre = False
                    for j in range(max(0, a - 3), a + 1):
                        if any(abs(p2[0] - q[0]) <= 0.05 and abs(p2[1] - q[1]) <= 0.08 for p2 in obs[j]):
                            pre = True; break
                    if not pre: dep = True; break
                if dep: break
            if dep: continue
            for b1 in range(a + 1, min(a + 6, lim)):
                bcx, bcy = rings[b1]
                for o in obs[b1]:
                    dx, dy = o[0] - bcx, o[1] - bcy
                    if not BAND(dy, dx): continue
                    if abs(o[0] - ent[0]) > 0.06: continue
                    if is_fixture(dx, dy, o[2], b1): continue
                    run, lastf, last = 1, b1, o
                    path = [(b1, o[0] - bcx)]
                    run_dys = [o[1] - bcy]
                    for k in range(b1 + 1, min(b1 + 16, lim)):
                        if k - lastf > 3: break
                        kcx, kcy = rings[k]
                        best = None
                        for q in obs[k]:
                            qdx, qdy = q[0] - kcx, q[1] - kcy
                            if not BAND(qdy, qdx): continue
                            if is_fixture(qdx, qdy, q[2], k): continue
                            steps = k - lastf
                            if abs(q[1] - last[1]) > 0.014 * steps or abs(q[0] - last[0]) > 0.02 * steps: continue
                            if best is None or q[2] > best[2]: best = q
                        if best is not None:
                            run += 1; lastf, last = k, best
                            path.append((k, best[0] - rings[k][0]))
                            run_dys.append(best[1] - rings[k][1])
                    exitok = False
                    cur2, cur2f = last, lastf
                    for k in range(lastf + 1, min(lastf + 8, lim)):
                        if k - cur2f > 3: break
                        kcx, kcy = rings[k]
                        best = None
                        for q in obs[k]:
                            steps = k - cur2f
                            if abs(q[0] - cur2[0]) > 0.06 * steps: continue
                            if not (q[1] - cur2[1] >= 0.010 * steps): continue
                            if abs(q[0] - kcx) > EXIT_CONE: continue
                            if best is None or q[2] > best[2]: best = q
                        if best is None: continue
                        cur2, cur2f = best, k
                        if cur2[1] - rings[k][1] >= 0.085: exitok = True; break
                    if run < 3 and not (run >= 1 and exitok): continue
                    # M6 recal: a no-exit dwell must DESCEND into the net —
                    # reach depth, and progress rather than hover
                    if not exitok:
                        if max(run_dys) < MIN_DEPTH: continue
                        if (max(run_dys) - min(run_dys)) < MIN_PROG: continue
                    # end-centering: a net-braked ball ENDS centered in the
                    # cone; a rim roll-off ends at the band edge before the
                    # side drop (night_c w01 false-make signature)
                    if not exitok and abs(last[0] - rings[lastf][0]) > END_CENTER: continue
                    # run x-span cap: a braked ball stays inside the net cone;
                    # a wide span means the run identity-switched to another
                    # object (sub-threshold knot) across a frame gap
                    if max(p[1] for p in path) - min(p[1] for p in path) > SPAN_CAP: continue
                    rise = False
                    for k in range(lastf + 1, min(lastf + 7, lim)):
                        kcx, kcy = rings[k]
                        if any(q[2] >= 0.04 and (q[1] - kcy) <= -0.025 and abs(q[0] - last[0]) <= 0.06
                               for q in obs[k]):
                            rise = True; break
                    if rise: continue
                    return "M", f"dwell {a}->{b1}..{lastf} ({run}f{'+exit' if exitok else ''})"
        return "X", "no through"
    return classify, is_fixture

def score(tag):
    rep, N, rings, half, obs = load_video(tag)
    mode = FORCE or ("track" if (rep["mode"] == "track" or half < 0.045) else "static")
    ring_cx = med([r[0] for r in rings]); ring_y = med([r[1] for r in rings])
    v7 = isfix = None
    if mode == "track":
        v7, isfix = make_v7(obs, rings, N)
    arc_gate = None
    # Arc gate needs the ball to be VISIBLE below the ring before the shot —
    # true on good-visibility (static-mode) footage, false at night/pan where
    # the ball only surfaces near the rim (gating there deletes real attempts:
    # measured night_c 7 GT -> 0 windows). Static-only by design.
    if ARC and mode == "static":
        dets_by_f = defaultdict(list)
        with open(os.path.join(BATCH, f"det_{tag}{SUF}.csv")) as f:
            for r in csv.DictReader(f):
                if r["class"] == "ball":
                    dets_by_f[int(r["frame"])].append((float(r["cx_n"]), float(r["cy_n"]), float(r["score"])))
        with open(os.path.join(BATCH, f"zoom_{tag}{SUF}.csv")) as f:
            for r in csv.DictReader(f):
                dets_by_f[int(r["frame"])].append((float(r["cx_n"]), float(r["cy_n"]), float(r["score"])))
        _, owner = build_ball_tracks(dets_by_f, N)
        arc_gate = lambda fi, x, y: track_origin_ok(owner, fi, x, y, rings[fi][1], rings[fi][0])
    wins = arrivals_of(N, rings, obs, isfix, arc_gate)
    results = []
    for (f0, f1) in wins:
        if mode == "track":
            v, why = v7(f0, f1)
            if v == "X" and NETBURST:
                nE = net_energy(tag, ring_cx, ring_y, max(half, 0.03), N)
                if nE:
                    seg = nE[f0:min(f1 + 1, len(nE))]
                    pk = max(seg) if seg else 0.0
                    if pk >= NETBURST_PEAK:
                        v, why = "M", f"net-burst {pk:.2f} (was: {why})"
        else:
            netE = net_energy(tag, ring_cx, ring_y, half, N) if NETQUIET else None
            v, why = classify_static(obs, ring_cx, ring_y, half, f0, f1, netE)
        results.append((f0 / FPS, f1 / FPS, v, why))

    gt = GT.get(tag)
    print(f"\n=== {tag} [{mode}] halfW={half:.3f} windows={len(wins)} ===")
    if gt is None:
        for t0, t1, v, why in results:
            print(f"  {t0:6.2f}-{t1:6.2f}s {v} ({why})")
        print("  (no GT — excluded)")
        return None
    # each GT attempt -> exactly one window: containment first, else nearest
    # window edge within 1.0s. A window may hold several GT attempts.
    matched = defaultdict(list)
    for gi, (gt_t, gv) in enumerate(gt):
        best, bd = None, None
        for ri, (t0, t1, v, why) in enumerate(results):
            d = 0.0 if t0 <= gt_t <= t1 else min(abs(gt_t - t0), abs(gt_t - t1))
            if bd is None or d < bd:
                best, bd = ri, d
        if best is not None and bd <= 1.0:
            matched[best].append(gi)
    used = [False] * len(gt)
    for ri, gis in matched.items():
        for gi in gis: used[gi] = True
    ok = 0; fm = 0; mm = 0; phantom = []
    for ri, (t0, t1, v, why) in enumerate(results):
        if ri in matched:
            gvs = [gt[gi][1] for gi in matched[ri]]
            want = "M" if "M" in gvs else "X"
            tag_s = "OK " if v == want else ("FALSE-MAKE" if v == "M" else "MISSED-MAKE")
            if v == want: ok += 1
            elif v == "M": fm += 1
            else: mm += 1
            print(f"  {t0:6.2f}-{t1:6.2f}s pred {v} vs GT {'+'.join(gvs)}  {tag_s}  ({why})")
        else:
            phantom.append(round(t0, 1))
            print(f"  {t0:6.2f}-{t1:6.2f}s pred {v}  PHANTOM  ({why})")
    unm = [gt[gi] for gi in range(len(gt)) if not used[gi]]
    print(f"  score: {ok}/{len(matched)} windows | false-make {fm} | missed-make {mm} | "
          f"phantom {phantom} | GT unmatched {unm} | attempts {len(gt)} vs windows {len(wins)}")
    return ok, len(matched), fm, mm, len(phantom), len(unm)

tags = [t for t in sys.argv[1:] if not t.startswith("--")]
if not tags:
    tags = ["night_b", "night_c", "night_d", "portrait_v3"]
tot = np.zeros(6, dtype=int)
for tag in tags:
    r = score(tag)
    if r: tot += np.array(r, dtype=int)
print(f"\nTOTAL: verdict {tot[0]}/{tot[1]} | false-make {tot[2]} | missed-make {tot[3]} | "
      f"phantoms {tot[4]} | unmatched GT {tot[5]}")
