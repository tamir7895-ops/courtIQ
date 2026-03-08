/**
 * build.js — Copy web assets to www/ for Capacitor
 * Run: node build.js
 */
const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const DEST = path.join(__dirname, 'www');

// Files and folders to copy into www/
const COPY_TARGETS = [
  'index.html',
  'dashboard.html',
  'shared.css',
  'manifest.json',
  'sw.js',
  'js',
  'styles',
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

// Clean www/
if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
}
fs.mkdirSync(DEST);

// Copy each target
for (const target of COPY_TARGETS) {
  copyRecursive(path.join(SRC, target), path.join(DEST, target));
  console.log(`✓ Copied ${target}`);
}

console.log('\n✅ Build complete → www/');
