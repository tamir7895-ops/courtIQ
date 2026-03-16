#!/usr/bin/env python3
"""
CourtIQ — YOLOX-tiny Basketball + Hoop Detector Training Script
================================================================
License: Apache 2.0 (YOLOX by Megvii)
Run on Google Colab with GPU runtime.

Classes: 0=basketball, 1=hoop
Input:   416×416
Output:  ONNX (basketball_yolox_tiny.onnx)

Usage on Colab:
  1. Upload this file to Colab
  2. Run each section as separate cells
  3. Download the final .onnx file
"""

# ============================================================
# CELL 1: Install dependencies
# ============================================================
# !pip install torch torchvision  # already on Colab
# !git clone https://github.com/Megvii-BaseDetection/YOLOX.git
# %cd YOLOX
# !pip install -v -e .
# !pip install roboflow pycocotools onnx onnxsim

# ============================================================
# CELL 2: Download dataset from Roboflow
# ============================================================
import os
import json
from pathlib import Path

# >>> FILL IN YOUR API KEY <<<
ROBOFLOW_API_KEY = "YOUR_API_KEY_HERE"
WORKSPACE = "tamirs-workspace-h9nac"
PROJECT = "longshot-detection-gscqf"
VERSION = 2  # the version we just generated

from roboflow import Roboflow
rf = Roboflow(api_key=ROBOFLOW_API_KEY)
project = rf.workspace(WORKSPACE).project(PROJECT)
dataset = project.version(VERSION).download("yolov5")

DATASET_DIR = dataset.location
print(f"Dataset downloaded to: {DATASET_DIR}")

# ============================================================
# CELL 3: Convert YOLOv5 labels to COCO JSON format
# ============================================================
from PIL import Image

CLASS_NAMES = ["basketball", "hoop"]

def yolov5_to_coco(dataset_dir, split):
    """Convert YOLOv5 txt annotations to COCO JSON format."""
    images_dir = Path(dataset_dir) / split / "images"
    labels_dir = Path(dataset_dir) / split / "labels"

    if not images_dir.exists():
        print(f"Skipping {split} — directory not found: {images_dir}")
        return None

    coco = {
        "images": [],
        "annotations": [],
        "categories": [
            {"id": 0, "name": "basketball", "supercategory": "object"},
            {"id": 1, "name": "hoop", "supercategory": "object"},
        ],
    }
    ann_id = 0
    img_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

    for img_id, img_path in enumerate(sorted(images_dir.iterdir())):
        if img_path.suffix.lower() not in img_extensions:
            continue
        try:
            img = Image.open(img_path)
            w, h = img.size
        except Exception as e:
            print(f"  Skip bad image {img_path.name}: {e}")
            continue

        coco["images"].append({
            "id": img_id,
            "file_name": img_path.name,
            "width": w,
            "height": h,
        })

        label_path = labels_dir / (img_path.stem + ".txt")
        if not label_path.exists():
            continue

        for line in label_path.read_text().strip().split("\n"):
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 5:
                continue
            cls_id = int(parts[0])
            cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])

            # YOLOv5 normalized → COCO absolute
            x1 = (cx - bw / 2) * w
            y1 = (cy - bh / 2) * h
            box_w = bw * w
            box_h = bh * h

            coco["annotations"].append({
                "id": ann_id,
                "image_id": img_id,
                "category_id": cls_id,
                "bbox": [round(x1, 2), round(y1, 2), round(box_w, 2), round(box_h, 2)],
                "area": round(box_w * box_h, 2),
                "iscrowd": 0,
            })
            ann_id += 1

    return coco


# Convert all splits
for split in ["train", "valid", "test"]:
    coco_data = yolov5_to_coco(DATASET_DIR, split)
    if coco_data is None:
        continue
    out_path = os.path.join(DATASET_DIR, f"instances_{split}.json")
    with open(out_path, "w") as f:
        json.dump(coco_data, f)
    print(f"  {split}: {len(coco_data['images'])} images, {len(coco_data['annotations'])} annotations → {out_path}")


# ============================================================
# CELL 4: Create YOLOX experiment config
# ============================================================
EXP_FILE = "exps/courtiq_basketball.py"

exp_code = f'''#!/usr/bin/env python3
import os
from yolox.exp import Exp as MyExp


class Exp(MyExp):
    def __init__(self):
        super(Exp, self).__init__()
        # --- Model ---
        self.num_classes = 2
        self.depth = 0.33       # YOLOX-tiny
        self.width = 0.375      # YOLOX-tiny
        self.exp_name = "courtiq_basketball"

        # --- Input ---
        self.input_size = (416, 416)
        self.test_size = (416, 416)
        self.random_size = (10, 20)  # multiscale: 320-640 in steps of 32

        # --- Training ---
        self.max_epoch = 50
        self.warmup_epochs = 3
        self.no_aug_epochs = 5
        self.basic_lr_per_img = 0.01 / 64.0
        self.weight_decay = 5e-4
        self.momentum = 0.9

        # --- Data ---
        self.data_num_workers = 2
        self.eval_interval = 5

        # --- Augmentation ---
        self.mosaic_prob = 1.0
        self.mixup_prob = 0.5
        self.hsv_prob = 1.0
        self.flip_prob = 0.5
        self.degrees = 10.0
        self.translate = 0.1
        self.mosaic_scale = (0.5, 1.5)
        self.mixup_scale = (0.5, 1.5)
        self.shear = 2.0
        self.enable_mixup = True

        # --- Paths (set dynamically) ---
        self.data_dir = "{DATASET_DIR}"
        self.train_ann = "instances_train.json"
        self.val_ann = "instances_valid.json"

    def get_data_dir(self):
        return self.data_dir
'''

os.makedirs(os.path.dirname(EXP_FILE), exist_ok=True)
with open(EXP_FILE, "w") as f:
    f.write(exp_code)
print(f"Experiment config written to {EXP_FILE}")


# ============================================================
# CELL 5: Download pretrained YOLOX-tiny weights
# ============================================================
# !wget -q https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.pth
# print("Pretrained weights downloaded: yolox_tiny.pth")


# ============================================================
# CELL 6: Train!
# ============================================================
# !python tools/train.py \
#     -f exps/courtiq_basketball.py \
#     -d 1 \
#     -b 16 \
#     --fp16 \
#     -c yolox_tiny.pth \
#     -o

# Training output: YOLOX_outputs/courtiq_basketball/best_ckpt.pth


# ============================================================
# CELL 7: Export to ONNX
# ============================================================
# !python tools/export_onnx.py \
#     --output-name basketball_yolox_tiny.onnx \
#     -f exps/courtiq_basketball.py \
#     -c YOLOX_outputs/courtiq_basketball/best_ckpt.pth \
#     --decode_in_inference

# Simplify ONNX graph for faster inference
# !python -m onnxsim basketball_yolox_tiny.onnx basketball_yolox_tiny.onnx


# ============================================================
# CELL 8: Verify ONNX output shape
# ============================================================
import onnxruntime as ort
import numpy as np

def verify_onnx(model_path="basketball_yolox_tiny.onnx"):
    sess = ort.InferenceSession(model_path)
    inp = sess.get_inputs()[0]
    out = sess.get_outputs()[0]
    print(f"Input:  name='{inp.name}' shape={inp.shape} dtype={inp.type}")
    print(f"Output: name='{out.name}' shape={out.shape} dtype={out.type}")

    # Test inference
    dummy = np.random.randn(1, 3, 416, 416).astype(np.float32)
    result = sess.run(None, {inp.name: dummy})
    actual_shape = result[0].shape
    print(f"Actual output shape: {actual_shape}")

    # Validate format
    assert len(actual_shape) == 3, f"Expected 3D output, got {len(actual_shape)}D"
    assert actual_shape[0] == 1, f"Expected batch=1, got {actual_shape[0]}"
    num_cols = actual_shape[2]
    expected_cols = 4 + 1 + 2  # cx,cy,w,h + objectness + 2 classes = 7
    assert num_cols == expected_cols, f"Expected {expected_cols} columns, got {num_cols}"

    print(f"\n✓ Model verified: [1, {actual_shape[1]}, 7]")
    print(f"  Input tensor name: '{inp.name}'")
    print(f"  Output tensor name: '{out.name}'")
    print(f"  Num detections: {actual_shape[1]}")
    print(f"  File size: {os.path.getsize(model_path) / 1024 / 1024:.1f} MB")

# Uncomment after export:
# verify_onnx()


# ============================================================
# CELL 9: Download from Colab
# ============================================================
# from google.colab import files
# files.download("basketball_yolox_tiny.onnx")
