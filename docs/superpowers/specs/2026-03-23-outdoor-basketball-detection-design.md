# Outdoor Basketball Detection — v5 Model + JS Bug Fixes

**Date:** 2026-03-23
**Status:** Approved
**Author:** Claude + Tamir

---

## Problem

The current YOLOX-tiny v4 model (mAP@50 = 91.5%) was trained exclusively on indoor gym footage (29K images from 2HYPE NBA videos). It fails completely on outdoor/streetball courts:

- **Ball detection:** 0% on outdoor video frames (tested with Python inference)
- **Hoop detection:** Weak/oversized bounding boxes outdoors
- **Color fallback:** Tracks skin/clothing/UI buttons instead of ball
- **Result:** 0 Made, false Attempts, tracking jumps to players

## Goal

Make shot tracking work reliably on **both indoor gyms and outdoor streetball courts**, with a phone held by a friend from the side.

## Approach

**Fine-tune v4 checkpoint with outdoor basketball data** — preserves indoor knowledge while adding outdoor generalization.

---

## 1. Data Strategy

### Source
Search Roboflow Universe for outdoor basketball datasets with COCO-format annotations (basketball + hoop classes).

### Target
5-10K outdoor images covering:
- Streetball courts (asphalt, concrete, parks)
- Lighting: daylight, sunset, dusk, artificial lights
- Hoop types: with/without backboard, chain nets, standard rims
- Ball sizes: close-up to distant (3-pointer range)
- Camera angle: side view (phone held by friend)

### Merge Strategy
- Keep existing 29K indoor images unchanged
- Add outdoor images to `longshot-detection-5/`
- Combined dataset: ~35-39K images
- Maintain category IDs: basketball=0, hoop=1

### Category Mapping
If outdoor dataset uses different category names/IDs:
- Map to our schema: basketball=0, hoop=1
- Remap annotations programmatically before merge

---

## 2. Training Configuration

### File: `exps/courtiq_basketball_v5.py`

| Parameter | v4 Value | v5 Value | Reason |
|-----------|----------|----------|--------|
| max_epoch | 80 | 50 | Fine-tune on fine-tune, converges faster |
| basic_lr_per_img | 0.005/64 | 0.001/64 | Lower LR to preserve indoor knowledge |
| warmup_epochs | 10 | 5 | Already warm-started |
| no_aug_epochs | 15 | 10 | Shorter polish phase |
| eval_interval | 10 | 5 | More frequent eval to catch regression |
| checkpoint | COCO pretrained | v4 best_ckpt.pth | Continue from indoor-trained model |

### Architecture (unchanged)
- YOLOX-tiny: depth=0.33, width=0.375, 5M params
- Input: 416×416
- Classes: 2 (basketball, hoop)
- Output: [1, 3549, 7]

---

## 3. JS Bug Fixes (parallel to training)

### Bug 1: Rim Zone Too Large
**Symptom:** Dashed hoop line spans entire screen width
**Root Cause:** Hoop bounding box from model is oversized
**Fix:** Constrain max hoop width to 20% of frame width, max height to 15%. Reject detections exceeding these limits.

### Bug 2: Ball Tracker Follows Players
**Symptom:** Green dot tracks person's body, not ball
**Root Cause:** Color fallback detects skin/clothing as orange. ML confidence 0.005 accepts noise.
**Fix:**
- Raise ball confidence threshold: 0.005 → 0.05
- Add size validation: ball cannot be > 8% of frame area
- Add velocity check: reject jumps > 200px between consecutive frames
- Filter color detection: require circularity ratio > 0.5

### Bug 3: Tracking Stops Mid-Flight
**Symptom:** Ball tracking drops during shot arc
**Root Cause:** MAX_GAP_FRAMES=12 too short, Kalman prediction ends too quickly
**Fix:**
- Increase MAX_PREDICT to 60 frames (~2 seconds at 30fps)
- Strengthen gravity model: 0.4 → 0.6 px/frame²
- During active shot arc, extend prediction window

### Bug 4: False Shot Attempts
**Symptom:** Normal movements counted as shot attempts
**Root Cause:** Any upward ball movement triggers attempt detection
**Fix:**
- Require minimum arc height: ball must rise ≥ 15% of frame height above start point
- Require minimum upward velocity sustained for 5+ frames
- Add cooldown: no new attempt within 1.5s of last detection

---

## 4. Post-Training Pipeline

```
v4/best_ckpt.pth + outdoor_data
        ↓
   Train v5 (50 epochs)
        ↓
   best_ckpt.pth (v5)
        ↓
   export_onnx.py → basketball_yolox_tiny_v5.onnx
        ↓
   Replace models/basketball_yolox_tiny.onnx
        ↓
   Test on 3 video types:
     1. Indoor gym
     2. Outdoor daylight
     3. Outdoor evening
        ↓
   A/B compare v4 vs v5 indoor mAP
        ↓
   Deploy to GitHub Pages
```

---

## 5. Success Criteria

| Metric | Target |
|--------|--------|
| mAP@50 Indoor | ≥ 90% (no regression from v4) |
| mAP@50 Outdoor | ≥ 75% |
| Ball detection outdoor | Detected in 70%+ of frames |
| Hoop detection outdoor | Detected in 90%+ of frames (static target) |
| False attempts | < 2 per minute |
| Tracking continuity | Ball tracked through 80%+ of shot arc |
| Model size | ≤ 21 MB ONNX |
| Inference speed | ≤ 10ms per frame |

---

## 6. What Does NOT Change

- Model architecture (YOLOX-tiny)
- Number of classes (2)
- Input resolution (416×416)
- ONNX output format ([1, 3549, 7])
- Shot state machine logic (IDLE → RISING → FALLING → NEAR_RIM → MADE/MISS)
- Kalman filter structure (just parameter tuning)
- UI/UX of shot tracker screen

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Indoor mAP regression | Eval on indoor-only val set each epoch |
| Outdoor dataset quality | Manual spot-check 100 random images |
| Category ID mismatch | Remap script validates before merge |
| Training time | 50 epochs × ~5min = ~4 hours on RTX 5050 |
| Color detection still needed | Keep as fallback but with stricter filters |

---

## 8. Timeline

| Phase | Duration |
|-------|----------|
| Find + download outdoor dataset | 1 hour |
| Merge + validate annotations | 30 min |
| Train v5 (50 epochs) | 4-6 hours |
| Export ONNX + test | 30 min |
| JS bug fixes (parallel) | 2 hours |
| Integration testing | 1 hour |
| **Total** | **~8-10 hours** |
