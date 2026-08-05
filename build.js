/**
 * build.js — Copy web assets to www/ for Capacitor & GitHub Pages
 *
 * Source of truth: root files (js/, styles/, features/, app-v10/, etc.)
 * Output: www/ (served by Capacitor and deployed to GitHub Pages)
 *
 * Run: node build.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC = __dirname;
const DEST = path.join(__dirname, 'www');

// Cache-bust stamp: git short hash (falls back to timestamp outside git)
let STAMP;
try {
  STAMP = execSync('git rev-parse --short HEAD', { cwd: SRC }).toString().trim();
} catch (e) {
  STAMP = Date.now().toString(36);
}

// Files and folders to copy into www/
const COPY_TARGETS = [
  'shared.css',
  'manifest.json',
  'js',
  'styles',
  'features',
  'models',
  'assets',
  'icons',
  'vendor',           // A10: bundled ONNX Runtime (see app-v10/index.html) —
                      // the CV engine must ship with the app, not load from a CDN
  'app-v10',          // v10 fresh app (pristine magazine design) — the only UI
];

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

/* Delete anything in a COPIED directory that the source no longer has.
   This build copied and never deleted, so www/ accumulated forever:
   two orphan stylesheets from a redesign, and — the reason this exists —
   29 dead js/ files that kept shipping to the web deploy and the phone
   long after they were removed from source. Deleting a file used to be
   a no-op as far as what actually ships.

   Scoped to the directories build.js owns, never to www/ itself: the
   root also holds generated files (sw.js, index.html) that have no
   source counterpart and must survive. */
function pruneOrphans(src, dest, rel) {
  if (!fs.existsSync(dest) || !fs.statSync(dest).isDirectory()) return 0;
  let removed = 0;
  for (const child of fs.readdirSync(dest)) {
    const s = path.join(src, child);
    const d = path.join(dest, child);
    if (!fs.existsSync(s)) {
      fs.rmSync(d, { recursive: true, force: true });
      console.log(`  ✗ removed stale ${path.posix.join(rel, child)}`);
      removed++;
    } else if (fs.statSync(d).isDirectory()) {
      removed += pruneOrphans(s, d, path.posix.join(rel, child));
    }
  }
  return removed;
}

/* Development payload that must never reach a deploy. www/ is served
   publicly (GitHub Pages), so these were live URLs: 54MB of calibration
   audit frames, 16MB of eval clips, and six debug harness pages anyone
   could open. build.js copies and never deletes, so they also survived
   every rebuild once they had landed. Pruned AFTER the copy, which also
   cleans up whatever an earlier build left behind. */
const PRUNE_FROM_WWW = [
  '_audit', '_eval', 'v2-preview',
  'debug-auto-rim-eval.html', 'debug-eval-run.html', 'debug-l7-eval.html',
  'debug-pose-poc.html', 'debug-pose-shot-bench.html', 'debug-shot-log.html',
];

// Ensure www/ exists
fs.mkdirSync(DEST, { recursive: true });

// Copy each target
for (const target of COPY_TARGETS) {
  const srcPath = path.join(SRC, target);
  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠ Skipped ${target} (not found)`);
    continue;
  }
  const destPath = path.join(DEST, target);
  copyRecursive(srcPath, destPath);
  const stale = fs.statSync(srcPath).isDirectory()
    ? pruneOrphans(srcPath, destPath, target) : 0;
  console.log(`✓ Copied ${target}${stale ? ` (${stale} stale removed)` : ''}`);
}

// Prune the dev payload — including anything a previous build left here.
for (const junk of PRUNE_FROM_WWW) {
  const p = path.join(DEST, junk);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`✓ Pruned ${junk}`);
  }
}

// Cache-bust: stamp every ?v=... asset URL in the built app-v10/index.html
// with the current git hash. The SOURCE file keeps a literal '?v=dev' —
// nobody hand-bumps versions anymore (p15→p20 was done by hand five times
// in one session before this existed).
const builtIndex = path.join(DEST, 'app-v10', 'index.html');
if (fs.existsSync(builtIndex)) {
  const html = fs.readFileSync(builtIndex, 'utf8').replace(/\?v=[\w.-]+/g, '?v=' + STAMP);
  fs.writeFileSync(builtIndex, html);
  console.log(`✓ Stamped app-v10/index.html assets with ?v=${STAMP}`);
}

// Legacy-PWA kill switch. Two jobs:
// 1. The deploy workflow runs `sed` on www/sw.js — the file must exist or
//    CI fails (it HAS failed since the PWA cleanup removed sw.js; the
//    workflow file itself can't be edited with the current credential).
// 2. Phones that installed the old PWA still hold a service worker that
//    serves the cached June app forever. Shipping this self-destructing
//    sw.js at the same URL makes those clients drop caches + unregister.
const killSwitchSW = `/* Legacy-PWA kill switch — CourtIQ moved to Capacitor. */
const CACHE_VERSION = '${STAMP}';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
`;
fs.writeFileSync(path.join(DEST, 'sw.js'), killSwitchSW);
console.log('✓ Created www/sw.js (legacy-PWA kill switch)');

// Create www/index.html redirect (GitHub Pages + Capacitor entry point) → app-v10
if (process.env.BUILD_TARGET === 'mobile-only') {
  console.log('⏭  Skipped www/index.html (BUILD_TARGET=mobile-only)');
} else {
  const redirectHTML = `<!DOCTYPE html>
<html lang="en" style="background:#FBF5E8;">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#FBF5E8" />
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />
  <meta name="robots" content="noindex" />
  <title>CourtIQ</title>
  <script>window.location.replace('app-v10/index.html');</script>
  <style>
    html, body {
      margin: 0; padding: 0;
      background: #FBF5E8;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #222;
      font-family: sans-serif; font-size: 14px; opacity: 0.4;
    }
  </style>
</head>
<body>Loading CourtIQ...</body>
</html>`;
  fs.writeFileSync(path.join(DEST, 'index.html'), redirectHTML);
  console.log('✓ Created www/index.html (redirect → app-v10/index.html)');
}

// Version stamp -- the on-device diagnostic badge shows this, so "which
// build is the phone ACTUALLY running" is never a guessing game again.
try {
  const { execSync } = require('child_process');
  const hash = execSync('git rev-parse --short HEAD').toString().trim();
  const stamp = hash + ' ' + new Date().toISOString().slice(5, 16).replace('T', ' ');
  fs.writeFileSync(path.join(DEST, 'version.js'),
    'window.__COURTIQ_BUILD = ' + JSON.stringify(stamp) + ';\n');
  console.log('version stamp: ' + stamp);
} catch (e) { console.warn('version stamp skipped:', e.message); }

console.log('\n✅ Build complete → www/');
