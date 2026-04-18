/* ══════════════════════════════════════════════════════════════
   YOLOX Preprocessing Web Worker
   Offloads RGBA→CHW transposition from main thread.
   Input:  { imageData: Uint8ClampedArray, size: 640 }
   Output: { buffer: Float32Array } (transferred, zero-copy)
   ══════════════════════════════════════════════════════════════ */
self.onmessage = function (e) {
  var imgData = e.data.imageData;
  var sz = e.data.size;
  var chSize = sz * sz;
  var buf = new Float32Array(3 * chSize);

  for (var i = 0; i < chSize; i++) {
    buf[i]              = imgData[i * 4];     // R
    buf[chSize + i]     = imgData[i * 4 + 1]; // G
    buf[chSize * 2 + i] = imgData[i * 4 + 2]; // B
  }

  self.postMessage({ buffer: buf }, [buf.buffer]);
};
