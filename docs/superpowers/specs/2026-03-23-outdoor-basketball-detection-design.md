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

### Validation Split Strategy
- **Indoor val set:** Keep original v4 val (1,149 images) — frozen, never modified
- **Outdoor val set:** Reserve 10-15% of outdoor images as separate val
- **Eval runs on both independently** — indoor mAP must stay ≥ 90%, outdoor mAP tracked separately
- This prevents outdoor images from masking indoor regression

### Category Mapping
If outdoor dataset uses different category names/IDs:
- Map to our schema: basketball=0, hoop=1
- Remap annotations programmatically before merge

---

## 2. Training Configuration

### File: `exps/courtiq_basketball_v5.py`

**Note:** v4 was originally configured for 200 epochs but was reduced to 80 mid-training for efficiency. The `best_ckpt.pth` comes from an 80-epoch run (the docstring in v4 config is outdated and should be corrected).

| Parameter | v4 Value | v5 Value | Reason |
|-----------|----------|----------|--------|
| max_epoch | 80 | 50 | Fine-tune on fine-tune, converges faster |
| basic_lr_per_img | 0.005/64 | 0.001/64 | Lower LR to preserve indoor knowledge |
| warmup_epochs | 10 | 5 | Already warm-started |
| no_aug_epochs | 15 | 12 | ~24% of training — slightly longer for domain adaptation stabilization |
| eval_interval | 10 | 5 | More frequent eval to catch regression |
| checkpoint | COCO pretrained | v4 best_ckpt.pth | Continue from indoor-trained model |

### Architecture (unchanged)
- YOLOX-tiny: depth=0.33, width=0.375, 5M params
- Input: 416×416
- Classes: 2 (basketball, hoop)
- Output: [1, 3549, 7]

---

## 3. JS Bug Fixes (parallel to training)

All coordinate references below use **normalized 0-1 coordinates** (normX/normY) consistent with the existing codebase.

### Bug 1: Rim Zone Too Large
**Symptom:** Dashed hoop line spans entire screen width
**Root Cause:** Hoop area filter at line ~1020 allows `area < frameArea * 0.4` — 40% of frame is far too permissive for a hoop.
**Fix:** Tighten hoop area constraint from 0.4 to 0.08 (8% of frame area max). Also add aspect ratio check: hoop width/height ratio must be 1.5-5.0 (hoops are wider than tall).

### Bug 2: Ball Tracker Follows Players
**Symptom:** Green dot tracks person's body, not ball
**Root Cause:** Color fallback detects skin/clothing as orange. ML confidence 0.005 accepts noise.
**Fix:**
- Raise ball confidence threshold: 0.005 → 0.05
- Add size validation: ball cannot be > 8% of frame area
- Add velocity check: reject position jumps > 0.15 of frame width between consecutive frames (normalized coordinates)
- Filter color detection: require cluster compactness (width/height ratio 0.5-2.0)

### Bug 3: Tracking Stops Mid-Flight
**Symptom:** Ball tracking drops during shot arc
**Root Cause:** Current `KALMAN_MAX_PREDICT = 45` and `MAX_GAP_FRAMES = 24` (not 12 as previously stated). 45 frames is ~1.5s which should cover most shots, but the Kalman gravity model (0.4 px/frame²) underestimates real gravity, causing prediction to drift off the actual arc.
**Fix:**
- Increase KALMAN_MAX_PREDICT: 45 → 60 frames (~2 seconds for long 3-pointers)
- Strengthen gravity model: 0.4 → 0.6 px/frame² (closer to real basketball arc)
- During active shot state (RISING/FALLING), use extended prediction window

### Bug 4: False Shot Attempts
**Symptom:** Normal movements counted as shot attempts
**Root Cause:** Existing arc checks at lines ~1207 and ~1238 only verify `_ballMinY < rim.centerY + offset` — they check proximity to rim but not minimum upward travel distance. Any small upward movement near the rim triggers a shot.
**Fix:**
- Keep existing rim-proximity checks
- **Add:** minimum upward travel ≥ 0.15 normalized height from shot start to peak
- **Add:** sustained upward velocity for ≥ 5 consecutive frames before counting as shot
- Existing `DEBOUNCE_MS = 1500` cooldown is adequate, no change needed

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
   Copy to models/basketball_yolox_tiny.onnx (v4 kept as backup: basketball_yolox_tiny_v4_backup.onnx)
        ↓
   Test on 3 video types:
     1. Indoor gym (must maintain ≥ 90% mAP)
     2. Outdoor daylight
     3. Outdoor evening
        ↓
   A/B compare v4 vs v5 indoor mAP
        ↓
   If indoor mAP < 90%: ROLLBACK to v4, do not deploy
   If indoor mAP ≥ 90%: Deploy to GitHub Pages
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
| Indoor mAP regression | Eval on frozen indoor-only val set each epoch; rollback to v4 if < 90% |
| Outdoor dataset quality | Manual spot-check 100 random images before training |
| Category ID mismatch | Remap script validates before merge |
| Training time | 50 epochs × ~5min = ~4 hours on RTX 5050 |
| Color detection still needed | Keep as fallback but with stricter filters |
| v5 fails completely | v4 ONNX kept as backup, instant rollback |

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
