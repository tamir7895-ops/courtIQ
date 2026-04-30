/**
 * build.js — Copy web assets to www/ for Capacitor & GitHub Pages
 *
 * Source of truth: root files (js/, styles/, features/, dashboard.html, etc.)
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
  'dashboard.html',
  'shared.css',
  'manifest.json',
  'sw.js',
  'js',
  'styles',
  'features',
  'models',
  'assets',
  'icons',
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

// Create www/index.html redirect (GitHub Pages entry point)
const redirectHTML = `<!DOCTYPE html>
<html lang="en" style="background:#0a0a0a;">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0a0a0a" />
  <link rel="icon" type="image/svg+xml" href="assets/favicon.svg" />
  <meta name="robots" content="noindex" />
  <title>CourtIQ</title>
  <script>window.location.replace('dashboard.html');</script>
  <style>
    html, body {
      margin: 0; padding: 0;
      background: #0a0a0a;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #fff;
      font-family: sans-serif; font-size: 14px; opacity: 0.4;
    }
  </style>
</head>
<body>Loading CourtIQ...</body>
</html>`;
fs.writeFileSync(path.join(DEST, 'index.html'), redirectHTML);
console.log('✓ Created www/index.html (redirect → dashboard.html)');

console.log('\n✅ Build complete → www/');
