#!/usr/bin/env node
/* iOS sync + prune: build www → cap sync ios → strip dev/eval payload from
   the app bundle. The web deploy (GitHub Pages) keeps everything; the iPhone
   bundle only needs the app + ONE model (~25MB instead of 270MB).
   Run via: npm run ios:sync   (on the Mac before every Xcode build) */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'ios', 'App', 'App', 'public');

execSync('node build.js', { cwd: ROOT, stdio: 'inherit' });
execSync('npx cap sync ios', { cwd: ROOT, stdio: 'inherit' });

// dev/eval payload that must never ship on the phone
const DROP = [
  '_audit', '_eval', 'v2-preview',
  '_test_video.mp4', '_test2.mp4', '_pullups.mp4',
  'WhatsApp Video 2026-03-10 at 10.17.35.mp4',
  'debug-eval-run.html', 'debug-pose-poc.html',
  'debug-pose-shot-bench.html', 'debug-auto-rim-eval.html',
];
// keep ONLY the deployed model — MUST match shotDetection.js's modelPath
// default. When the default model changes, update this list in the SAME
// commit: the pruner deletes everything else, so a stale name here ships
// an iPhone bundle whose engine 404s its own model and silently drops to
// color-only mode (caught in pre-TestFlight verification, 2026-07-17).
const KEEP_MODELS = new Set(['basketball_yolox_tiny_m6_fp16.onnx']);

let freed = 0;
function rm(p) {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  freed += st.isDirectory()
    ? Number(execSync(`du -sk "${p}" 2>/dev/null || echo 0`).toString().split('\t')[0] || 0)
    : st.size / 1024;
  fs.rmSync(p, { recursive: true, force: true });
}
for (const d of DROP) rm(path.join(PUB, d));
const modelsDir = path.join(PUB, 'models');
if (fs.existsSync(modelsDir)) {
  for (const f of fs.readdirSync(modelsDir)) {
    if (!KEEP_MODELS.has(f)) rm(path.join(modelsDir, f));
  }
}
const left = execSync(`du -sm "${PUB}"`).toString().split('\t')[0];
console.log(`✅ iOS bundle pruned — public/ now ${left}MB`);
