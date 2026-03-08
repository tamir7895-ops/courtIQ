/**
 * Generates PWA icons (icon-192.png and icon-512.png) for CourtIQ.
 * Run once: node generate-icons.js
 * Requires only Node.js built-ins (zlib, fs, path).
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, 'icons');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// --- PNG helpers -----------------------------------------------------------

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput  = Buffer.concat([typeBytes, data]);
  return Buffer.concat([
    u32be(data.length),
    typeBytes,
    data,
    u32be(crc32(crcInput))
  ]);
}

/**
 * Build a solid-color PNG with a centred text symbol.
 * We skip text rendering (pure Node built-ins) and just draw coloured rectangles.
 */
function buildPNG(size, bgR, bgG, bgB) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 2;  // colour type: RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Raw image data: one filter byte (0) + RGB per row
  const rowSize = 1 + size * 3;
  const raw     = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    const base = y * rowSize;
    raw[base] = 0; // filter None

    // Draw a simple design: orange background with dark circle
    const cx = size / 2, cy = size / 2, r = size * 0.42;
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let R, G, B;
      if (dist > r) {
        // Background: dark (#0e1014)
        R = 14; G = 16; B = 20;
      } else if (dist > r * 0.90) {
        // Circle border: dark orange (#c47a0e)
        R = 196; G = 122; B = 14;
      } else {
        // Circle fill: orange (#f5a623)
        R = bgR; G = bgG; B = bgB;

        // Basketball seam lines (dark)
        const ang  = Math.atan2(dy, dx);
        const seamV = Math.abs(dx / (dist + 1));
        const seamH = Math.abs(dy / (dist + 1));
        const arc1  = Math.abs(Math.cos(ang * 2 - Math.PI / 2));
        const arc2  = Math.abs(Math.cos(ang * 2 + Math.PI / 2));
        const inSeam = seamV < 0.07 || seamH < 0.07 || arc1 < 0.07 || arc2 < 0.07;
        if (inSeam) { R = 60; G = 40; B = 10; }
      }

      const offset = base + 1 + x * 3;
      raw[offset]     = R;
      raw[offset + 1] = G;
      raw[offset + 2] = B;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// Orange: #f5a623 = (245, 166, 35)
const [R, G, B] = [245, 166, 35];

const sizes = [192, 512];
sizes.forEach(function (sz) {
  const png  = buildPNG(sz, R, G, B);
  const file = path.join(OUT_DIR, 'icon-' + sz + '.png');
  fs.writeFileSync(file, png);
  console.log('Generated:', file, '(' + png.length + ' bytes)');
});

console.log('Done! Icons saved to icons/');
