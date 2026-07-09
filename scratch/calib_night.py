"""Night video (v1 / _test2) calibration:
1. Smoothed hoop TRACK from full-frame dets (pans -> ring moves).
2. Ring geometry (y-offset + halfW) via color scan on tracked crops.
3. ZOOM pass: per-frame YOLOX on a square crop following the track.
4. Classifier with ring(t) instead of a static ring.
5. Score vs June GT.
"""
import os
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
import csv, glob, json, sys
from collections import defaultdict
import cv2
import numpy as np
import onnxruntime as ort

SCRATCH = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRATCH)
FPS = 30.0
# GT corrected 2026-07-09 by frame-level zoom verification (gt/night/zoom*.jpg):
#  - 0.9 was 'M' -> X: ball bounces off the rim top and falls OUTSIDE-LEFT
#    (zoom09.jpg f36-f50; the 2.5fps sheet hid the bounce).
#  - 20.8 'M' + 21.47 'X' were ONE event -> X@20.9: single ball, rim rattle
#    pops up f627-f640 and lands outside-left f646-f651 (zoom208pre.jpg);
#    nothing passes the net before the rattle.
GT = [(1.0,'X'),(7.0,'X'),(9.3,'M'),(18.4,'X'),(19.45,'M'),(20.9,'X'),
      (22.55,'X'),(28.7,'X'),(33.1,'M')]

files = sorted(glob.glob(os.path.join(SCRATCH, 'frames', 'v1_30', '*.jpg')))
N = len(files)
vh, vw = cv2.imread(files[0]).shape[:2]
print(f'frames={N} {vw}x{vh}')

# ── 1. hoop track ────────────────────────────────────────────
raw = {}
with open(os.path.join(SCRATCH, 'det_v1_30.csv')) as f:
    for r in csv.DictReader(f):
        if r['class'] != 'hoop': continue
        fi = int(r['frame']); s = float(r['score'])
        if s < 0.08: continue
        if fi not in raw or s > raw[fi][0]:
            raw[fi] = (s, float(r['cx_n']), float(r['cy_n']), float(r['w_n']), float(r['h_n']))

med = lambda a: sorted(a)[len(a)//2] if a else 0.0
track = np.full((N, 4), np.nan)   # cx, cy, w, h
for fi, (s, cx, cy, w, h) in raw.items():
    track[fi] = [cx, cy, w, h]
# median filter over +-8 frames on observed points, then interpolate
obs_idx = sorted(raw.keys())
sm = {}
for fi in obs_idx:
    win = [raw[j][1:] for j in obs_idx if abs(j - fi) <= 8]
    sm[fi] = [med([w[k] for w in win]) for k in range(4)]
xs = np.array(obs_idx, dtype=float)
full = np.arange(N, dtype=float)
tr = np.zeros((N, 4))
for k in range(4):
    tr[:, k] = np.interp(full, xs, np.array([sm[i][k] for i in obs_idx]))
print(f'track: cx {tr[:,0].min():.3f}-{tr[:,0].max():.3f}, cy {tr[:,1].min():.3f}-{tr[:,1].max():.3f}, w med {med(list(tr[:,2])):.3f}')

# ── 2. ring geometry from color scan on tracked crops ───────
def union_mask(reg):
    b = reg[:,:,0].astype(np.int32); g = reg[:,:,1].astype(np.int32); r = reg[:,:,2].astype(np.int32)
    is_red    = (r>110)&(g<105)&(b<105)&(r>g*1.45)&(r>b*1.35)
    is_orange = (r>120)&(g>=60)&(g<160)&(b<110)&(r>g*1.25)&(r>b*1.7)
    return is_red | is_orange

def longest_run(row, max_gap=6):
    best=(0,-1,0); i=0; n=len(row)
    while i<n:
        if not row[i]: i+=1; continue
        j=i; gap=0; trues=0; last=i
        while j<n:
            if row[j]: trues+=1; last=j; gap=0
            else:
                gap+=1
                if gap>max_gap: break
            j+=1
        if trues>best[2]: best=(i,last,trues)
        i=last+1
    return best

offs, halfs = [], []
for fi in obs_idx[::max(1, len(obs_idx)//25)]:
    img = cv2.imread(files[fi])
    cx, cy, w, h = tr[fi]
    x0=max(0,int((cx-w)*vw)); x1=min(vw,int((cx+w)*vw))
    y0=max(0,int((cy-h)*vh)); y1=min(vh,int((cy+h*0.5)*vh))
    if x1-x0<24 or y1-y0<10: continue
    m = union_mask(img[y0:y1, x0:x1])
    counts = m.sum(axis=1)
    if counts.max() < 8: continue
    rowi = int(np.argmax(counts))
    band = m[max(0,rowi-3):rowi+4].any(axis=0)
    s,e,t = longest_run(band)
    if t < 8: continue
    ry = (y0+rowi)/vh
    rc = (x0 + (s+e)/2)/vw
    offs.append((ry - cy, rc - cx))
    halfs.append((e-s)/2/vw)
RING_DY = med([o[0] for o in offs]) if offs else -0.05
RING_DX = med([o[1] for o in offs]) if offs else 0.0
HALF = max(med(halfs) if halfs else 0.03, 0.030)
print(f'ring: dy={RING_DY:+.3f} dx={RING_DX:+.3f} halfW={HALF:.3f} (samples={len(halfs)})')

def ring_at(fi):
    cx, cy, w, h = tr[fi]
    return cx + RING_DX, cy + RING_DY

# ── 3. zoom pass following the track ─────────────────────────
SZ = 640
def build_grid(size=SZ, strides=(8,16,32)):
    gx,gy,st=[],[],[]
    for s in strides:
        n=size//s
        ys,xs=np.meshgrid(np.arange(n),np.arange(n),indexing='ij')
        gx.append(xs.reshape(-1)); gy.append(ys.reshape(-1)); st.append(np.full(n*n,s))
    return (np.concatenate(gx).astype(np.float32),np.concatenate(gy).astype(np.float32),np.concatenate(st).astype(np.float32))
GX,GY,GS = build_grid()
sig = lambda x: 1/(1+np.exp(-x))
so = ort.SessionOptions(); so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
sess = ort.InferenceSession(os.path.join(ROOT,'models','basketball_yolox_tiny_v6_polished.onnx'), so, providers=['CPUExecutionProvider'])
iname = sess.get_inputs()[0].name

SIDE = min(vw, vh) // 2          # 232 px -> 2.76x zoom
zoom_csv = os.path.join(SCRATCH, 'det_night_zoom.csv')
if not os.path.exists(zoom_csv) or '--rezoom' in sys.argv:
    rows_out = []
    needs = None
    import time; t0=time.perf_counter()
    for fi in range(N):
        rcx, rcy = ring_at(fi)
        cx0 = int(np.clip(rcx*vw - SIDE/2, 0, vw-SIDE))
        cy0 = int(np.clip(rcy*vh - SIDE*0.55, 0, vh-SIDE))
        img = cv2.imread(files[fi])
        crop = img[cy0:cy0+SIDE, cx0:cx0+SIDE]
        blob = cv2.resize(crop,(SZ,SZ),interpolation=cv2.INTER_LINEAR).transpose(2,0,1)[None].astype(np.float32)
        out = sess.run(None,{iname:blob})[0][0].astype(np.float32)
        cxs=(out[:,0]+GX)*GS; cys=(out[:,1]+GY)*GS
        if needs is None: needs = bool((out[:100,4:8]<0).any())
        sc = sig(out[:,4:8]) if needs else out[:,4:8]
        ball = sc[:,0]*sc[:,1]
        idx = np.where(ball>=0.02)[0]
        for i in idx:
            fx=(cx0+cxs[i]/SZ*SIDE)/vw; fy=(cy0+cys[i]/SZ*SIDE)/vh
            rows_out.append((fi, round(fx,4), round(fy,4), round(float(ball[i]),3)))
        if fi % 300 == 0: print(f'  zoom {fi}/{N}', flush=True)
    with open(zoom_csv,'w',newline='') as f:
        wtr=csv.writer(f); wtr.writerow(['frame','cx_n','cy_n','score']); wtr.writerows(rows_out)
    print(f'zoom done {time.perf_counter()-t0:.0f}s, {len(rows_out)} rows')

# ── 4. classifier with ring(t) ───────────────────────────────
balls_by_f = defaultdict(list)
with open(os.path.join(SCRATCH,'det_v1_30.csv')) as f:
    for r in csv.DictReader(f):
        if r['class']=='ball':
            balls_by_f[int(r['frame'])].append((float(r['cx_n']),float(r['cy_n']),float(r['score'])))
with open(zoom_csv) as f:
    for r in csv.DictReader(f):
        balls_by_f[int(r['frame'])].append((float(r['cx_n']),float(r['cy_n']),float(r['score'])))

obs = []
for fi in range(N):
    rcx, rcy = ring_at(fi)
    near=[]
    for (x,y,s) in balls_by_f.get(fi,[]):
        if abs(x-rcx)<0.17 and rcy-0.24 < y < rcy+0.14:
            near.append((x,y,s))
    # NMS-lite: top-5 spatially distinct
    near.sort(key=lambda o:-o[2]); keep=[]
    for o in near:
        if all(abs(o[0]-k[0])+abs(o[1]-k[1])>0.02 for k in keep): keep.append(o)
        if len(keep)>=5: break
    obs.append(keep)

GAP, CAP = round(0.8*FPS), round(2.6*FPS)
arrivals=[]
for fi in range(N):
    rcx, rcy = ring_at(fi)
    if any(o[1] < rcy-0.012 for o in obs[fi]):
        if not arrivals or fi-arrivals[-1][1] > GAP: arrivals.append([fi,fi])
        else: arrivals[-1][1]=fi

def classify(f0, f1):
    """v6 chain rule: ENTRY above the ring -> NET-BRAKE pause in the cone
    -> no RE-RISE. Physics: only the net stops a ball mid-air. Misses cross
    the cone at free-fall speed (>=0.02/frame vertical, no >=2-frame slow
    cluster); the static net-knot fires forever but never has a fresh entry
    within 4 frames + 0.05 x-continuity; rim rattles pause on the iron but
    re-rise right after. Verified per-event on gt/night/zoom*.jpg."""
    lim = min(f1+1, N)
    for b1 in range(f0, lim):
        rcx, rcy = ring_at(b1)
        for o in obs[b1]:
            dx, dy = o[0]-rcx, o[1]-rcy
            if not (-0.015 <= dy <= 0.055 and abs(dx) <= 0.05): continue
            # A: entry above the ring, <=4 frames before, x-continuous
            A = None
            for a in range(max(f0, b1-4), b1):
                acx, acy = ring_at(a)
                for p in obs[a]:
                    adx, ady = p[0]-acx, p[1]-acy
                    if -0.13 <= ady <= -0.018 and abs(adx) <= 0.09 and abs(p[0]-o[0]) <= 0.05:
                        A = a; break
                if A is not None: break
            if A is None: continue
            # static-fixture guard: if this pause spot already fired in >=3
            # of the 8 frames BEFORE the entry, it's the net-knot, not a ball
            pre_hits = 0
            for k in range(max(0, A-8), A):
                kcx, kcy = ring_at(k)
                if any(abs(q[0]-kcx-dx) <= 0.02 and abs(q[1]-kcy-dy) <= 0.02 for q in obs[k]):
                    pre_hits += 1
            if pre_hits >= 3: continue
            # B: extend the pause run (frame gap <=3, slow drift only)
            run_len, last_f, last = 1, b1, o
            for k in range(b1+1, min(b1+16, lim)):
                if k - last_f > 3: break
                kcx, kcy = ring_at(k)
                best = None
                for q in obs[k]:
                    qdx, qdy = q[0]-kcx, q[1]-kcy
                    if not (-0.015 <= qdy <= 0.055 and abs(qdx) <= 0.05): continue
                    steps = k - last_f
                    if abs(q[1]-last[1]) > 0.014*steps or abs(q[0]-last[0]) > 0.02*steps: continue
                    if best is None or q[2] > best[2]: best = q
                if best is not None:
                    run_len += 1; last_f, last = k, best
            if run_len < 2: continue
            # re-rise kill: solid obs back above the ring right after the pause
            rise = False
            for k in range(last_f+1, min(last_f+7, lim)):
                kcx, kcy = ring_at(k)
                if any(q[2] >= 0.04 and (q[1]-kcy) <= -0.025 and abs(q[0]-last[0]) <= 0.06
                       for q in obs[k]):
                    rise = True; break
            if rise: continue
            return 'M', f'net-brake {A}->{b1}..{last_f} ({run_len}f)'
    return 'X', 'no net-brake'

results=[]
for i,a in enumerate(arrivals):
    end = arrivals[i+1][0]-1 if i+1 < len(arrivals) else N-1
    end = min(end, a[0]+CAP)
    v, why = classify(a[0], end)
    results.append((a[0]/FPS, end/FPS, v, why))

print(f'\narrivals: {len(results)}')
for t0,t1,v,why in results: print(f'  {t0:5.1f}-{t1:5.1f}s {v} ({why})')
print('pred:', '-'.join(v for _,_,v,_ in results))
print('gt  :', '-'.join(v for _,v in GT), f'({len(GT)} events)')

gt_used=[False]*len(GT); assign={}
# pass 1: strict containment (GT time inside the window)
for ri,(t0,t1,v,why) in enumerate(results):
    for gi,(gt_t,gv) in enumerate(GT):
        if not gt_used[gi] and t0 <= gt_t <= t1:
            gt_used[gi]=True; assign[ri]=gi; break
# pass 2: nearest unused within +-1.6s of window start
for ri,(t0,t1,v,why) in enumerate(results):
    if ri in assign: continue
    bi=-1
    for gi,(gt_t,gv) in enumerate(GT):
        if not gt_used[gi] and abs(gt_t-t0) <= 1.6:
            if bi<0 or abs(GT[bi][0]-t0) > abs(gt_t-t0): bi=gi
    if bi>=0: gt_used[bi]=True; assign[ri]=bi
ok=0; phantom=[]
for ri,(t0,t1,v,why) in enumerate(results):
    if ri in assign:
        gi=assign[ri]
        if v==GT[gi][1]: ok+=1
        else: print(f'  BAD @{t0:.1f} pred {v} vs GT {GT[gi][1]}@{GT[gi][0]} ({why})')
    else: phantom.append(round(t0,1))
missed=[g for g,u in zip(GT,gt_used) if not u]
print(f'matched {len(assign)}/{len(GT)} | verdicts OK {ok}/{len(assign)} | phantom {phantom} | missed {missed}')
