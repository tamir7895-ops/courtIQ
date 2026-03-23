# Outdoor Basketball Detection v5 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fine-tune the YOLOX-tiny v4 basketball detector with outdoor data so it works on both indoor gyms and outdoor streetball courts, and fix 4 JS tracking bugs.

**Architecture:** Add 5-10K outdoor basketball images to the existing 29K indoor dataset, fine-tune from v4 checkpoint for 50 epochs with lower LR. Fix JS bugs in shotDetection.js (hoop size, ball tracking, mid-flight dropout, false attempts) in parallel.

**Tech Stack:** Python/PyTorch (YOLOX training), ONNX Runtime Web (browser inference), Vanilla JS (shot tracking UI)

**Spec:** `docs/superpowers/specs/2026-03-23-outdoor-basketball-detection-design.md`

---

## File Structure

### New Files
- `training_data/YOLOX/exps/courtiq_basketball_v5.py` — v5 training config
- `training_data/YOLOX/scripts/download_outdoor_data.py` — fetch + merge outdoor dataset
- `training_data/YOLOX/scripts/validate_dataset.py` — verify annotations integrity
- `models/basketball_yolox_tiny_v4_backup.onnx` — v4 backup before replacement

### Modified Files
- `features/shot-tracking/shotDetection.js` — bug fixes (hoop size, ball tracking, arc, false attempts)
- `models/basketball_yolox_tiny.onnx` — replaced with v5 model

### Unchanged Files
- `features/shot-tracking/yoloxWorker.js` — no changes needed
- `features/shot-tracking/shotService.js` — no changes needed
- `training_data/YOLOX/exps/courtiq_basketball_v4.py` — preserved as reference

---

## Chunk 1: Data Pipeline (Tasks 1-3)

### Task 1: Find and Download Outdoor Basketball Dataset

**Files:**
- Create: `training_data/YOLOX/scripts/download_outdoor_data.py`

- [ ] **Step 1: Search Roboflow for outdoor basketball datasets**

Search Roboflow Universe for datasets with basketball + hoop annotations. Target: COCO format, outdoor/streetball images, 5-10K images.

```bash
# Search via Roboflow API or browse universe.roboflow.com
# Look for: "basketball outdoor", "streetball", "basketball court outdoor"
# Requirements: COCO format, 2 classes (ball + hoop), >2K images
```

- [ ] **Step 2: Write download + remap script**

```python
#!/usr/bin/env python3
"""Download outdoor basketball dataset and remap to CourtIQ categories."""
import json
import os
import shutil
from pathlib import Path

# Configuration — update after finding dataset
DATASET_URL = ""  # Roboflow download URL
TARGET_DIR = Path(__file__).parent.parent / "longshot-detection-5"
INDOOR_DIR = Path(__file__).parent.parent / "longshot-detection-4"

# Category mapping: outdoor dataset IDs → our IDs
# basketball=0, hoop=1
CATEGORY_MAP = {}  # Fill after inspecting outdoor dataset

def remap_annotations(ann_path, output_path, cat_map):
    """Remap category IDs and validate COCO format."""
    with open(ann_path) as f:
        data = json.load(f)

    # Remap categories
    data["categories"] = [
        {"id": 0, "name": "basketball", "supercategory": "object"},
        {"id": 1, "name": "hoop", "supercategory": "object"},
    ]

    # Remap annotation category IDs
    for ann in data["annotations"]:
        old_id = ann["category_id"]
        if old_id in cat_map:
            ann["category_id"] = cat_map[old_id]
        else:
            raise ValueError(f"Unknown category_id {old_id}")

    with open(output_path, "w") as f:
        json.dump(data, f)

    print(f"Remapped {len(data['annotations'])} annotations → {output_path}")

def merge_datasets(indoor_dir, outdoor_dir, output_dir):
    """Merge indoor + outdoor into combined dataset."""
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "train2017").mkdir(exist_ok=True)
    (output_dir / "val2017").mkdir(exist_ok=True)
    (output_dir / "annotations").mkdir(exist_ok=True)

    # Copy indoor images
    for split in ["train2017", "val2017"]:
        src = indoor_dir / split
        dst = output_dir / split
        for f in src.iterdir():
            shutil.copy2(f, dst / f.name)
        print(f"Copied {len(list(src.iterdir()))} indoor {split} images")

    # Copy outdoor images (prefix to avoid name collisions)
    for split in ["train2017", "val2017"]:
        src = outdoor_dir / split
        dst = output_dir / split
        for f in src.iterdir():
            shutil.copy2(f, dst / f"outdoor_{f.name}")
        print(f"Copied {len(list(src.iterdir()))} outdoor {split} images")

    # Merge annotations
    for split_ann in ["instances_train.json", "instances_valid.json"]:
        indoor_ann = json.load(open(indoor_dir / "annotations" / split_ann))
        outdoor_ann = json.load(open(outdoor_dir / "annotations" / split_ann))

        # Offset outdoor IDs to avoid collisions
        max_img_id = max(img["id"] for img in indoor_ann["images"]) + 1
        max_ann_id = max(ann["id"] for ann in indoor_ann["annotations"]) + 1

        for img in outdoor_ann["images"]:
            img["id"] += max_img_id
            img["file_name"] = f"outdoor_{img['file_name']}"

        for ann in outdoor_ann["annotations"]:
            ann["id"] += max_ann_id
            ann["image_id"] += max_img_id

        merged = {
            "images": indoor_ann["images"] + outdoor_ann["images"],
            "annotations": indoor_ann["annotations"] + outdoor_ann["annotations"],
            "categories": indoor_ann["categories"],
        }

        out_path = output_dir / "annotations" / split_ann
        with open(out_path, "w") as f:
            json.dump(merged, f)

        print(f"Merged {split_ann}: {len(merged['images'])} images, {len(merged['annotations'])} annotations")

if __name__ == "__main__":
    # Step 1: Download outdoor dataset (update URL after finding)
    # Step 2: Remap categories
    # Step 3: Merge with indoor
    merge_datasets(INDOOR_DIR, TARGET_DIR / "outdoor_only", TARGET_DIR)
```

- [ ] **Step 3: Run download script**

```bash
cd training_data/YOLOX
python scripts/download_outdoor_data.py
```

Expected: Downloads outdoor dataset, remaps categories, merges with indoor.

- [ ] **Step 4: Commit**

```bash
git add training_data/YOLOX/scripts/download_outdoor_data.py
git commit -m "feat: add outdoor basketball dataset download + merge script"
```

---

### Task 2: Validate Merged Dataset

**Files:**
- Create: `training_data/YOLOX/scripts/validate_dataset.py`

- [ ] **Step 1: Write validation script**

```python
#!/usr/bin/env python3
"""Validate merged dataset integrity."""
import json
import os
from pathlib import Path

def validate(data_dir):
    data_dir = Path(data_dir)
    errors = []

    for split, ann_file in [("train2017", "instances_train.json"), ("val2017", "instances_valid.json")]:
        ann_path = data_dir / "annotations" / ann_file
        img_dir = data_dir / split

        with open(ann_path) as f:
            data = json.load(f)

        # Check categories
        cats = {c["id"]: c["name"] for c in data["categories"]}
        assert cats == {0: "basketball", 1: "hoop"}, f"Bad categories: {cats}"

        # Check all images exist on disk
        img_files = set(os.listdir(img_dir))
        ann_files = set(img["file_name"] for img in data["images"])
        missing = ann_files - img_files
        if missing:
            errors.append(f"{split}: {len(missing)} images referenced but missing")

        # Check annotation category IDs
        bad_cats = [a for a in data["annotations"] if a["category_id"] not in (0, 1)]
        if bad_cats:
            errors.append(f"{split}: {len(bad_cats)} annotations with invalid category_id")

        # Check bbox validity
        bad_bbox = [a for a in data["annotations"] if a["bbox"][2] <= 0 or a["bbox"][3] <= 0]
        if bad_bbox:
            errors.append(f"{split}: {len(bad_bbox)} annotations with invalid bbox")

        # Stats
        n_ball = sum(1 for a in data["annotations"] if a["category_id"] == 0)
        n_hoop = sum(1 for a in data["annotations"] if a["category_id"] == 1)

        print(f"\n{split}:")
        print(f"  Images: {len(data['images'])} (on disk: {len(img_files)})")
        print(f"  Annotations: {len(data['annotations'])} (ball: {n_ball}, hoop: {n_hoop})")
        print(f"  Match: {len(ann_files & img_files)}/{len(ann_files)}")

    if errors:
        print(f"\n❌ ERRORS: {errors}")
        return False
    else:
        print("\n✅ Dataset valid!")
        return True

if __name__ == "__main__":
    validate("longshot-detection-5")
```

- [ ] **Step 2: Run validation**

```bash
cd training_data/YOLOX
python scripts/validate_dataset.py
```

Expected:
```
train2017:
  Images: ~35000 (on disk: ~35000)
  Annotations: ~47000 (ball: ~23000, hoop: ~24000)
  Match: 35000/35000

val2017:
  Images: ~1400 (on disk: ~1400)
  Annotations: ~1900 (ball: ~950, hoop: ~950)
  Match: 1400/1400

✅ Dataset valid!
```

- [ ] **Step 3: Spot-check 10 random outdoor images visually**

```bash
python -c "
import json, random, os
from PIL import Image
ann = json.load(open('longshot-detection-5/annotations/instances_train.json'))
outdoor = [img for img in ann['images'] if img['file_name'].startswith('outdoor_')]
samples = random.sample(outdoor, min(10, len(outdoor)))
for s in samples:
    path = f'longshot-detection-5/train2017/{s[\"file_name\"]}'
    img = Image.open(path)
    print(f'{s[\"file_name\"]}: {img.size}')
"
```

- [ ] **Step 4: Commit**

```bash
git add training_data/YOLOX/scripts/validate_dataset.py
git commit -m "feat: add dataset validation script"
```

---

### Task 3: Create v5 Training Config

**Files:**
- Create: `training_data/YOLOX/exps/courtiq_basketball_v5.py`

- [ ] **Step 1: Write v5 config**

```python
#!/usr/bin/env python3
"""
CourtIQ Basketball Detection — YOLOX-tiny v5 Training Config
============================================================
Fine-tune v4 (indoor-only) with mixed indoor+outdoor dataset.
Lower LR to preserve indoor knowledge while learning outdoor.
"""
import os
from yolox.exp import Exp as MyExp


class Exp(MyExp):
    def __init__(self):
        super(Exp, self).__init__()
        self.num_classes = 2
        self.depth = 0.33       # YOLOX-tiny
        self.width = 0.375      # YOLOX-tiny
        self.exp_name = "courtiq_basketball_v5"
        self.input_size = (416, 416)
        self.test_size = (416, 416)
        self.max_epoch = 50
        self.data_num_workers = 4
        self.eval_interval = 5   # frequent eval to catch indoor regression

        # Dataset paths — merged indoor+outdoor (COCO format)
        self.data_dir = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "longshot-detection-5"
        ))
        self.train_ann = "instances_train.json"
        self.val_ann = "instances_valid.json"
        self.train_name = "train2017"
        self.val_name = "val2017"

        # Lower LR for fine-tune on fine-tune
        self.warmup_epochs = 5
        self.basic_lr_per_img = 0.001 / 64.0  # 5x lower than v4
        self.no_aug_epochs = 12                # ~24% for domain adaptation

        # Same augmentation as v4
        self.mosaic_prob = 1.0
        self.mixup_prob = 0.5
        self.hsv_prob = 1.0
        self.flip_prob = 0.5
        self.mosaic_scale = (0.5, 1.5)
        self.multiscale_range = 5
```

- [ ] **Step 2: Verify config loads**

```bash
cd training_data/YOLOX
python -c "
import importlib.util
spec = importlib.util.spec_from_file_location('exp', 'exps/courtiq_basketball_v5.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
exp = mod.Exp()
print(f'Classes: {exp.num_classes}')
print(f'Epochs: {exp.max_epoch}')
print(f'Data dir: {exp.data_dir}')
print(f'LR: {exp.basic_lr_per_img}')
print('✅ Config OK')
"
```

- [ ] **Step 3: Commit**

```bash
git add training_data/YOLOX/exps/courtiq_basketball_v5.py
git commit -m "feat: add v5 training config for indoor+outdoor"
```

---

## Chunk 2: JS Bug Fixes (Tasks 4-7)

These run in PARALLEL with training. No model dependency.

### Task 4: Fix Hoop Size Bug

**Files:**
- Modify: `features/shot-tracking/shotDetection.js` — hoop area filter

- [ ] **Step 1: Find the hoop area filter**

Search for `0.4` near hoop detection logic (~line 1020). The current filter allows hoop bounding box up to 40% of frame area.

- [ ] **Step 2: Tighten hoop constraints**

Replace the hoop area check. Add aspect ratio validation:

```javascript
// OLD: area < frameArea * 0.4
// NEW: Constrain hoop to realistic size
var hoopMaxArea = frameArea * 0.08;  // 8% max (was 40%)
var hoopMinArea = frameArea * 0.001; // tiny hoops in distance
var hoopAR = w / h;                  // aspect ratio

if (area > hoopMaxArea || area < hoopMinArea) continue;
if (hoopAR < 1.5 || hoopAR > 5.0) continue; // hoops are wider than tall
```

- [ ] **Step 3: Test locally — upload video, verify rim zone is reasonable size**

```bash
# Start local server
node serve.js
# Open http://127.0.0.1:8080 → Shot Tracker → Upload indoor video
# Verify: dashed rim line is ~15-20% of screen width, not full width
```

- [ ] **Step 4: Commit**

```bash
git add features/shot-tracking/shotDetection.js
git commit -m "fix: constrain hoop bounding box to 8% max area + aspect ratio check"
```

---

### Task 5: Fix Ball Tracker Following Players

**Files:**
- Modify: `features/shot-tracking/shotDetection.js` — ball confidence + velocity filter

- [ ] **Step 1: Raise ball confidence threshold**

Find `BALL_CONFIDENCE` constant (should be 0.005). Change to 0.05:

```javascript
// OLD
var BALL_CONFIDENCE = 0.005;
// NEW — reject ultra-low confidence noise
var BALL_CONFIDENCE = 0.05;
```

- [ ] **Step 2: Add velocity jump rejection**

In the ball tracking update function, add a check before accepting new ball position:

```javascript
// After getting new ball detection (normX, normY):
if (this._lastBallX !== null) {
    var dx = Math.abs(normX - this._lastBallX);
    var dy = Math.abs(normY - this._lastBallY);
    var jump = Math.sqrt(dx * dx + dy * dy);
    // Reject jumps > 15% of frame diagonal (teleportation = false detection)
    if (jump > 0.15 && this._consecutiveDetections < 3) {
        return; // Skip this detection
    }
}
```

- [ ] **Step 3: Add color detection compactness filter**

In color fallback, add cluster shape check:

```javascript
// After finding orange cluster bounding box:
var clusterAR = clusterW / clusterH;
if (clusterAR < 0.5 || clusterAR > 2.0) {
    // Too elongated — likely arm/leg, not ball
    continue;
}
```

- [ ] **Step 4: Test — upload video, verify green dot stays on ball**

- [ ] **Step 5: Commit**

```bash
git add features/shot-tracking/shotDetection.js
git commit -m "fix: ball tracker no longer follows players — confidence + velocity + shape filters"
```

---

### Task 6: Fix Tracking Stops Mid-Flight

**Files:**
- Modify: `features/shot-tracking/shotDetection.js` — Kalman parameters

- [ ] **Step 1: Update Kalman prediction limit**

Find `KALMAN_MAX_PREDICT = 45` (line ~64):

```javascript
// OLD
var KALMAN_MAX_PREDICT = 45;
// NEW — 2 seconds for long 3-pointers
var KALMAN_MAX_PREDICT = 60;
```

- [ ] **Step 2: Strengthen gravity model**

Find gravity constant (~0.4):

```javascript
// OLD
var GRAVITY = 0.4;
// NEW — closer to real basketball arc
var GRAVITY = 0.6;
```

- [ ] **Step 3: Extend prediction during active shot**

In the Kalman predict function, during RISING/FALLING states use extended window:

```javascript
// During active shot arc, allow longer prediction
if (this._shotState === 'RISING' || this._shotState === 'FALLING') {
    maxPredict = KALMAN_MAX_PREDICT * 1.5; // 90 frames during active shot
}
```

- [ ] **Step 4: Test — upload video with visible shot arc, verify tracking continues through flight**

- [ ] **Step 5: Commit**

```bash
git add features/shot-tracking/shotDetection.js
git commit -m "fix: Kalman tracks ball through full shot arc — extended prediction + stronger gravity"
```

---

### Task 7: Fix False Shot Attempts

**Files:**
- Modify: `features/shot-tracking/shotDetection.js` — shot attempt validation

- [ ] **Step 1: Add minimum arc height requirement**

Find shot detection logic (near state transitions to RISING). Add height check:

```javascript
// Before counting a new attempt:
var arcHeight = this._shotStartY - this._ballMinY; // normalized upward travel
if (arcHeight < 0.15) {
    // Ball didn't rise enough — not a real shot
    return;
}
```

- [ ] **Step 2: Add sustained upward velocity check**

```javascript
// Require 5+ consecutive frames of upward movement before RISING
if (this._upwardFrameCount < 5) {
    this._upwardFrameCount++;
    return; // Don't transition to RISING yet
}
```

- [ ] **Step 3: Test — upload video, count false attempts (target: < 2 per minute)**

- [ ] **Step 4: Commit**

```bash
git add features/shot-tracking/shotDetection.js
git commit -m "fix: reduce false shot attempts — require min arc height + sustained velocity"
```

---

## Chunk 3: Training + Deployment (Tasks 8-11)

### Task 8: Train v5 Model

**Files:**
- Input: `training_data/YOLOX/YOLOX_outputs/courtiq_basketball_v4/best_ckpt.pth`
- Output: `training_data/YOLOX/YOLOX_outputs/courtiq_basketball_v5/best_ckpt.pth`

- [ ] **Step 1: Start training**

```bash
cd training_data/YOLOX
python -m yolox.tools.train \
    -expn courtiq_basketball_v5 \
    -f exps/courtiq_basketball_v5.py \
    -d 1 -b 16 --fp16 \
    -c YOLOX_outputs/courtiq_basketball_v4/best_ckpt.pth \
    2>&1
```

Expected: ~4-6 hours on RTX 5050, 50 epochs.

- [ ] **Step 2: Monitor training progress**

Check every 30 min:
```bash
tail -5 YOLOX_outputs/courtiq_basketball_v5/train_log.txt
```

Watch for:
- Loss decreasing (should start ~3.0, go to ~2.0)
- mAP@50 at eval intervals (every 5 epochs)
- No crashes or NaN losses

- [ ] **Step 3: Verify final metrics**

```bash
grep "Average Precision.*IoU=0.50 " YOLOX_outputs/courtiq_basketball_v5/train_log.txt | tail -5
```

Target: mAP@50 ≥ 85% combined (indoor + outdoor in val set).

- [ ] **Step 4: Run indoor-only eval (regression check)**

```bash
python -m yolox.tools.eval \
    -expn courtiq_basketball_v5 \
    -f exps/courtiq_basketball_v5.py \
    -d 1 -b 16 \
    -c YOLOX_outputs/courtiq_basketball_v5/best_ckpt.pth \
    --test-ann instances_valid_indoor_only.json
```

Target: indoor mAP@50 ≥ 90%. If below → ROLLBACK to v4.

---

### Task 9: Export v5 to ONNX

**Files:**
- Input: `YOLOX_outputs/courtiq_basketball_v5/best_ckpt.pth`
- Output: `models/basketball_yolox_tiny.onnx`
- Backup: `models/basketball_yolox_tiny_v4_backup.onnx`

- [ ] **Step 1: Backup v4 model**

```bash
cp models/basketball_yolox_tiny.onnx models/basketball_yolox_tiny_v4_backup.onnx
```

- [ ] **Step 2: Export v5 to ONNX**

```bash
cd training_data/YOLOX
python tools/export_onnx.py \
    -f exps/courtiq_basketball_v5.py \
    -c YOLOX_outputs/courtiq_basketball_v5/best_ckpt.pth \
    --output-name basketball_yolox_tiny_v5.onnx
```

- [ ] **Step 3: Copy to models directory**

```bash
cp training_data/YOLOX/basketball_yolox_tiny_v5.onnx models/basketball_yolox_tiny.onnx
```

- [ ] **Step 4: Verify ONNX file**

```bash
python -c "
import onnxruntime as ort
import numpy as np
sess = ort.InferenceSession('models/basketball_yolox_tiny.onnx')
inp = np.random.randn(1, 3, 416, 416).astype(np.float32)
out = sess.run(None, {sess.get_inputs()[0].name: inp})
print(f'Output shape: {out[0].shape}')  # Should be (1, 3549, 7)
print(f'File size: {os.path.getsize(\"models/basketball_yolox_tiny.onnx\") / 1e6:.1f} MB')
"
```

Expected: `(1, 3549, 7)`, ~20 MB.

- [ ] **Step 5: Commit**

```bash
git add models/basketball_yolox_tiny.onnx models/basketball_yolox_tiny_v4_backup.onnx
git commit -m "feat: deploy v5 model (indoor+outdoor) — keep v4 as backup"
```

---

### Task 10: Integration Testing

**Files:** None (testing only)

- [ ] **Step 1: Test indoor video**

```bash
node serve.js
# Open http://127.0.0.1:8080 → Shot Tracker → Upload indoor gym video
# Verify: ball detected, hoop detected, shots counted correctly
# Target: similar accuracy to v4
```

- [ ] **Step 2: Test outdoor daylight video**

```
# Upload outdoor basketball video (daylight)
# Verify: ball detected, hoop detected, rim zone reasonable size
# Target: ball visible 70%+ of time, hoop stable
```

- [ ] **Step 3: Test outdoor evening video**

```
# Upload outdoor basketball video (evening/dusk)
# Verify: at least partial detection
# Note any lighting conditions that still fail
```

- [ ] **Step 4: Document results**

Record actual mAP/detection rates for each condition.

---

### Task 11: Deploy to Production

- [ ] **Step 1: Push all changes to master**

```bash
git checkout master
git merge claude/fix-shot-tracker --no-edit
git push origin master
git checkout claude/fix-shot-tracker
```

- [ ] **Step 2: Verify GitHub Pages deployment**

```
# Wait 60s for GitHub Pages to deploy
# Open https://tamir7895-ops.github.io/courtIQ/?cachebust=200
# Ctrl+Shift+R for hard refresh
# Test Shot Tracker with video upload
```

- [ ] **Step 3: Final commit — update MEMORY.md**

Update project memory with v5 model info, training results, and known limitations.
