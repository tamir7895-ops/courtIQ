# YOLOX v6 Retraining Plan — Basketball Shot Detection

## Current Model Performance (v4)

| Metric | Score | Notes |
|--------|-------|-------|
| mAP@50 | 91.4% | Good for indoor close-up |
| mAP@50:95 | 56.8% | Moderate |
| Ball AP | 52.6% | Weak for small/distant balls |
| Hoop AP | 60.9% | Confused by metal structures |
| Ball detection in TikTok videos | ~1-2% confidence | Almost unusable |
| Hoop detection in TikTok videos | ~13-15% confidence | Detects ceiling instead of rim |

## Root Causes

### 1. Training Data Bias
- v4 trained on **2HYPE NBA indoor videos** (close camera, well-lit, specific gym)
- TikTok/phone videos have: farther camera, different lighting, text overlays, varying angles
- Dataset: 23K images from limited sources → model overfits to that specific visual style

### 2. Ball Size Distribution
- Training data mostly has large balls (close camera)
- TikTok videos: ball is 15-30px in a 416x416 input (very small)
- Small object detection is YOLOX-tiny's weakness

### 3. Hoop Confusion
- "Basketball Hoop" class includes backboard, rim, net, AND supporting structure
- Model learned features that also match metal ceiling structures in gyms
- Need tighter annotation: just the backboard+rim, NOT supporting poles

### 4. Missing Augmentations
- No vertical video crops in training (TikTok is 9:16, training was 16:9)
- No text overlay augmentation (TikTok watermarks confuse the model)
- Limited brightness/exposure variation

---

## v6 Training Specification

### Input/Output
- **Input size**: 640x640 (up from 416x416 for better small-object detection)
- **Output**: [1, 8400, 7] = [cx, cy, w, h, obj, ball, hoop]
- **Architecture**: YOLOX-tiny (depth=0.33, width=0.375, ~5M params)

### Dataset Requirements

**Target: 40,000+ images** (up from 23K)

| Source | Images | Purpose |
|--------|--------|---------|
| Existing v4 dataset | 23,000 | Baseline indoor |
| TikTok basketball compilations | 5,000 | Phone camera angles, vertical, overlays |
| YouTube gym shooting drills | 5,000 | Various gyms, lighting conditions |
| Outdoor basketball clips | 3,000 | Sunlight, shadows, different ball colors |
| Close-up hoop shots (from below) | 2,000 | Hoop-only variety, different backboard styles |
| Synthetic copy-paste augmentation | 5,000 | Small balls pasted onto court backgrounds |

**Total target: ~43,000 images**

### Annotation Guidelines

**Basketball (class 0):**
- Tight bounding box around the ball only
- Include balls in hand, mid-air, on rim, partially occluded
- Mark balls as small as 10px

**Basketball Hoop (class 1):**
- Box should cover **backboard + rim + net** ONLY
- Do NOT include supporting poles, ceiling structure, or scoreboard
- If net is not visible, just backboard + rim

### Augmentation Strategy

```python
# v6 training config
max_epoch = 150
input_size = (640, 640)
basic_lr = 0.002 / 64.0
warmup_epochs = 15
no_aug_epochs = 25

# Critical augmentations
mosaic_prob = 1.0
mosaic_scale = (0.3, 1.7)  # aggressive scale variation
mixup_prob = 0.3            # reduced (preserves small objects)
copypaste_prob = 0.5        # synthetic small ball instances

# NEW for v6
vertical_crop_prob = 0.3    # simulate portrait/TikTok videos
brightness_range = (0.5, 1.5)  # gym lighting variation
text_overlay_prob = 0.2     # simulate watermarks/captions
```

### Vertical Video Handling
Add a custom augmentation that crops 9:16 aspect ratio from 16:9 training images:
```python
def random_vertical_crop(img, boxes):
    """Simulate TikTok-style portrait video from landscape image"""
    h, w = img.shape[:2]
    crop_w = int(h * 9 / 16)
    if crop_w >= w: return img, boxes
    x_start = random.randint(0, w - crop_w)
    cropped = img[:, x_start:x_start+crop_w]
    # Adjust boxes...
    return cropped, adjusted_boxes
```

### Training Infrastructure

| Option | GPU | Time | Cost |
|--------|-----|------|------|
| Local RTX 5050 | 8GB VRAM | ~48h for 150 epochs | Free |
| Google Colab Pro | T4/A100 | ~8-12h | ~$10 |
| Roboflow Train | Cloud | ~2-4h | Credits |

**Recommended: Colab Pro** (A100 is 5x faster than RTX 5050 for 640x640 input)

### Evaluation Checkpoints

| Epoch | Expected mAP@50 | Action |
|-------|-----------------|--------|
| 30 | > 80% | Sanity check — abort if below |
| 60 | > 88% | Compare to v4 baseline |
| 100 | > 92% | Approaching target |
| 150 | > 94% | Final — export ONNX |

### Export & Deployment
```bash
# Export to ONNX (float32)
python tools/export_onnx.py \
  --output-name basketball_yolox_tiny_v6.onnx \
  -f exps/courtiq_basketball_v6.py \
  -c best_ckpt.pth

# Verify output shape
python -c "
import onnxruntime as ort
m = ort.InferenceSession('basketball_yolox_tiny_v6.onnx')
print(m.get_inputs()[0].shape)   # [1, 3, 640, 640]
print(m.get_outputs()[0].shape)  # [1, 8400, 7]
"

# Copy to project
cp basketball_yolox_tiny_v6.onnx www/models/
```

### JS Changes for v6

```javascript
// shotDetection.js updates needed:
var YOLOX_INPUT_SIZE = 640;  // was 416

// Grid table changes:
// Strides [8,16,32] → grids [80x80, 40x40, 20x20] = 8400 anchors
_buildGrid: function () {
    var strides = [8, 16, 32];
    var grids = [80, 40, 20];  // was [52, 26, 13]
    // ... same logic
}
```

---

## Data Collection Workflow

### Step 1: Gather Videos (2-3 hours)
```bash
# Download TikTok basketball compilations
# Use yt-dlp for YouTube drill videos
yt-dlp --format best -o "training_data/videos/%(title)s.%(ext)s" \
  "https://youtube.com/playlist?list=<basketball-drills-playlist>"
```

### Step 2: Extract Frames (1 hour)
```bash
# Extract 1 frame per second
python training_data/extract_youtube_frames.py \
  --input training_data/videos/ \
  --output training_data/frames_v6/ \
  --fps 1
```

### Step 3: Upload to Roboflow (30 min)
- Workspace: `tamirs-workspace-h9nac`
- Project: `longshot-detection-gscqf` → create v6
- Upload frames, annotate with Roboflow's annotation tool

### Step 4: Annotate (8-16 hours total)
- Use Roboflow auto-annotate with v4 model as base
- Manual review + correction of each image
- Focus on: small balls, different hoop styles, no ceiling structures

### Step 5: Train (8-48 hours depending on GPU)
- Use the Colab notebook: https://colab.research.google.com/drive/1bkEH6dyVBJvZb7LbzO3hTyGEiN6l0CQx
- Update config to v6 parameters above

### Step 6: Evaluate & Deploy (1 hour)
- Run evaluation on holdout set
- Compare mAP to v4
- Export ONNX
- Update `shotDetection.js` constants
- Test with TikTok videos

---

## Success Criteria

| Metric | v4 (current) | v6 (target) |
|--------|-------------|-------------|
| mAP@50 | 91.4% | **> 94%** |
| mAP@50:95 | 56.8% | **> 62%** |
| Ball AP | 52.6% | **> 65%** |
| Hoop AP | 60.9% | **> 75%** |
| Ball detection in TikTok video | ~1-2% conf | **> 30% conf** |
| Hoop detection in TikTok video | ~13-15% conf | **> 60% conf** |
| ONNX file size | 20 MB | ~20 MB (same arch) |
| Inference time (WASM) | 7.5ms | ~12ms (640 input) |

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Video collection | 3 hours | 50+ source videos |
| Frame extraction | 1 hour | 15,000+ frames |
| Annotation | 2-3 days | 40,000 annotated images |
| Training | 1-2 days | v6 best checkpoint |
| Evaluation + export | 2 hours | basketball_yolox_tiny_v6.onnx |
| JS integration + testing | 3 hours | Updated shotDetection.js |
| **Total** | **~5 days** | Production v6 model |
