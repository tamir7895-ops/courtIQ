import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime
ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

const INPUT_SIZE = 640;
const NUM_CLASSES = 2;
const STRIDE = 7; // cx, cy, w, h, objectness, ball_score, hoop_score
const CLASS_NAMES = ['Basketball', 'Basketball Hoop'];
const COLORS = ['#f97316', '#3b82f6']; // orange for ball, blue for hoop

let session = null;
let currentModelPath = null;
let _debugFrameCount = 0;

export async function loadModel(modelPath) {
  if (modelPath === currentModelPath && session) return session;
  
  if (session) {
    await session.release();
    session = null;
  }

  try {
    console.log('[Inference] Loading model from:', modelPath);

    // Fetch model as ArrayBuffer first to avoid ONNX Runtime URL issues
    const response = await fetch(modelPath);
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching model`);
    const arrayBuffer = await response.arrayBuffer();
    console.log('[Inference] Model downloaded:', (arrayBuffer.byteLength / 1024 / 1024).toFixed(1), 'MB');

    session = await ort.InferenceSession.create(arrayBuffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
    currentModelPath = modelPath;
    console.log('[Inference] Model loaded successfully. Inputs:', session.inputNames, 'Outputs:', session.outputNames);
    return session;
  } catch (err) {
    console.error('[Inference] Failed to load model:', err);
    throw err;
  }
}

export function preprocessFrame(videoElement, canvas, ctx) {
  const vw = videoElement.videoWidth;
  const vh = videoElement.videoHeight;
  
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  
  // Letterbox resize (maintain aspect ratio)
  const scale = Math.min(INPUT_SIZE / vw, INPUT_SIZE / vh);
  const newW = Math.round(vw * scale);
  const newH = Math.round(vh * scale);
  const padX = (INPUT_SIZE - newW) / 2;
  const padY = (INPUT_SIZE - newH) / 2;
  
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(videoElement, padX, padY, newW, newH);
  
  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = imageData;
  
  // Convert to CHW float32 (no normalization for YOLOX - expects 0-255)
  const float32Data = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  const area = INPUT_SIZE * INPUT_SIZE;
  
  for (let i = 0; i < area; i++) {
    const idx = i * 4;
    float32Data[i] = data[idx];               // R
    float32Data[i + area] = data[idx + 1];    // G
    float32Data[i + area * 2] = data[idx + 2]; // B
  }
  
  return {
    tensor: new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    scale,
    padX,
    padY
  };
}

// YOLOX grid+stride decode: raw model output → pixel coordinates
function decodeYoloxGrid(rawData) {
  const sz = INPUT_SIZE; // 640
  const strides = [8, 16, 32];
  const output = new Float32Array(rawData); // copy to avoid mutating original
  let idx = 0;
  for (const stride of strides) {
    const gridSize = Math.floor(sz / stride);
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const off = idx * STRIDE;
        output[off]     = (output[off]     + x) * stride; // cx
        output[off + 1] = (output[off + 1] + y) * stride; // cy
        output[off + 2] = Math.exp(output[off + 2]) * stride; // w
        output[off + 3] = Math.exp(output[off + 3]) * stride; // h
        idx++;
      }
    }
  }
  return output;
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

export async function runInference(videoElement, canvas, ctx, confThreshold = 0.25) {
  if (!session) throw new Error('Model not loaded');

  const { tensor, scale, padX, padY } = preprocessFrame(videoElement, canvas, ctx);

  const startTime = performance.now();
  const results = await session.run({ images: tensor });
  const inferenceTime = performance.now() - startTime;

  // Get output tensor and decode grid offsets
  const rawOutput = results[Object.keys(results)[0]];
  const data = decodeYoloxGrid(rawOutput.data);
  const numDetections = data.length / STRIDE;

  // Auto-detect: if obj/class values are negative, output is raw logits (needs sigmoid)
  let needsSigmoid = false;
  for (let si = 0; si < Math.min(data.length, 700); si += STRIDE) {
    if (data[si + 4] < 0 || data[si + 5] < 0 || data[si + 6] < 0) {
      needsSigmoid = true;
      break;
    }
  }

  // Debug: find top objectness scores to understand model output
  let topScores = [];
  for (let i = 0; i < numDetections; i++) {
    const off = i * STRIDE;
    const rawObj = data[off + 4];
    const obj = needsSigmoid ? sigmoid(rawObj) : rawObj;
    const rawBall = data[off + 5];
    const rawHoop = data[off + 6];
    const ball = needsSigmoid ? sigmoid(rawBall) : rawBall;
    const hoop = needsSigmoid ? sigmoid(rawHoop) : rawHoop;
    const bestConf = obj * Math.max(ball, hoop);
    if (topScores.length < 5 || bestConf > topScores[topScores.length - 1].conf) {
      topScores.push({ i, obj: obj.toFixed(3), ball: ball.toFixed(3), hoop: hoop.toFixed(3), conf: bestConf });
      topScores.sort((a, b) => b.conf - a.conf);
      if (topScores.length > 5) topScores.pop();
    }
  }
  if (_debugFrameCount++ % 30 === 0) {
    console.log(`[Inference] sigmoid=${needsSigmoid} | Top 5 detections:`, topScores, `| threshold=${confThreshold}`);
  }

  // Decode detections
  const detections = [];

  for (let i = 0; i < numDetections; i++) {
    const off = i * STRIDE;
    const obj = needsSigmoid ? sigmoid(data[off + 4]) : data[off + 4];
    if (obj < 0.01) continue;

    const cx = data[off];
    const cy = data[off + 1];
    const w  = data[off + 2];
    const h  = data[off + 3];

    const ballScore = obj * (needsSigmoid ? sigmoid(data[off + 5]) : data[off + 5]);
    const hoopScore = obj * (needsSigmoid ? sigmoid(data[off + 6]) : data[off + 6]);

    const bestClass = hoopScore > ballScore ? 1 : 0;
    const confidence = bestClass === 0 ? ballScore : hoopScore;
    if (confidence < confThreshold) continue;

    // Convert from letterboxed coords back to original video coords
    const x1 = (cx - w / 2 - padX) / scale;
    const y1 = (cy - h / 2 - padY) / scale;
    const x2 = (cx + w / 2 - padX) / scale;
    const y2 = (cy + h / 2 - padY) / scale;

    detections.push({
      x1, y1, x2, y2,
      confidence,
      objectness: obj,
      classId: bestClass,
      className: CLASS_NAMES[bestClass],
      color: COLORS[bestClass]
    });
  }

  // NMS per class
  const nmsDetections = nms(detections, 0.45);

  return { detections: nmsDetections, inferenceTime };
}

function nms(detections, iouThreshold) {
  const result = [];
  
  for (let cls = 0; cls < NUM_CLASSES; cls++) {
    const classDetections = detections
      .filter(d => d.classId === cls)
      .sort((a, b) => b.confidence - a.confidence);
    
    const keep = [];
    const suppressed = new Set();
    
    for (let i = 0; i < classDetections.length; i++) {
      if (suppressed.has(i)) continue;
      keep.push(classDetections[i]);
      
      for (let j = i + 1; j < classDetections.length; j++) {
        if (suppressed.has(j)) continue;
        if (iou(classDetections[i], classDetections[j]) > iouThreshold) {
          suppressed.add(j);
        }
      }
    }
    
    result.push(...keep);
  }
  
  return result;
}

function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  
  return intersection / (areaA + areaB - intersection);
}

export function releaseModel() {
  if (session) {
    session.release();
    session = null;
    currentModelPath = null;
  }
}

export { CLASS_NAMES, COLORS };
