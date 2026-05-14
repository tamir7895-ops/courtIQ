# CourtIQ Model Evaluator

Local web tool to evaluate YOLOX basketball detection models on video.

## Quick Start

```bash
cd tools/model-evaluator
npm install
npm run dev
```

Then open http://localhost:5173

## Features

- Upload any basketball video (MP4, MOV, WebM)
- Run YOLOX ONNX inference entirely in-browser (no server needed)
- Real-time bounding boxes overlay on video
- Live metrics: FPS, inference time, confidence scores
- Per-class stats: ball detection rate, hoop detection rate
- Confidence distribution chart
- Adjustable confidence threshold slider
- Compare v4 vs v6 models, or load custom .onnx files

## Models

Uses the existing ONNX models from the project:
- `../../models/basketball_yolox_tiny.onnx` (v4)
- `../../models/basketball_yolox_tiny_v6.onnx` (v6)

Or upload any custom YOLOX model with the same architecture (640x640 input, [1,8400,7] output).
