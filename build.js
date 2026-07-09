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

const SRC = __dirname;
const DEST = path.join(__dirname, 'www');

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

// Ensure www/ exists
fs.mkdirSync(DEST, { recursive: true });

// Copy each target
for (const target of COPY_TARGETS) {
  const srcPath = path.join(SRC, target);
  if (!fs.existsSync(srcPath)) {
    console.warn(`⚠ Skipped ${target} (not found)`);
    continue;
  }
  copyRecursive(srcPath, path.join(DEST, target));
  console.log(`✓ Copied ${target}`);
}

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

console.log('\n✅ Build complete → www/');
