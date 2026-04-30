/* ══════════════════════════════════════════════════════════════
   YOLOX Preprocessing Web Worker
   Offloads RGBA→CHW transposition from main thread.
   Input:  { imageData: Uint8ClampedArray, size: 640 }
   Output: { buffer: Float32Array }  (structured-clone copy)

   Buffer pooling
   --------------
   YOLOX inference fires ~5×/sec at the default cadence. Allocating a
   fresh 3 MB Float32Array each call (640*640*3) churned the GC and
   occasionally surfaced as a frame stall. We keep a reusable pooled
   buffer and only reallocate when the requested size changes.

   Why we DON'T transfer the buffer:
     postMessage(..., [buf.buffer]) is zero-copy but neuters the source
     buffer on the worker side. After a transfer the pool entry is
     useless and we'd reallocate next call — defeating pooling. We
     therefore drop the transfer list and let structured clone copy
     the bytes (~3 MB ≈ 0.5 ms on modern devices). Net win is the
     elimination of the ~5×/sec 3 MB allocation, which is what was
     putting pressure on the GC.
   ══════════════════════════════════════════════════════════════ */
var pooledBuffer = null;
var pooledSize   = 0;

self.onmessage = function (e) {
  var imgData = e.data.imageData;
  var sz      = e.data.size;
  var chSize  = sz * sz;
  var totalLen = 3 * chSize;

  if (pooledBuffer === null || pooledSize !== totalLen) {
    pooledBuffer = new Float32Array(totalLen);
    pooledSize   = totalLen;
  }

  for (var i = 0; i < chSize; i++) {
    pooledBuffer[i]              = imgData[i * 4];     // R
    pooledBuffer[chSize + i]     = imgData[i * 4 + 1]; // G
    pooledBuffer[chSize * 2 + i] = imgData[i * 4 + 2]; // B
  }

  // Structured-clone copy (no transfer list) so pooledBuffer survives
  // for the next call. Main thread receives its own Float32Array.
  self.postMessage({ buffer: pooledBuffer });
};
