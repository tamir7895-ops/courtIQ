/**
 * ANALYSIS-ONLY eval server (scratch artifact). No shell usage, pure http/fs.
 * - Serves the REPO ROOT statically (so /features, /models, /_eval resolve
 *   exactly like production paths in dashboard.html).
 * - POST /scratch-save?name=<relpath>  -> writes body into scratch/runs/<relpath>
 * Never writes outside scratch/.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..');          // repo root
const RUNS = path.join(__dirname, 'runs');        // scratch/runs
const PORT = parseInt(process.env.PORT, 10) || 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css',
  '.js': 'application/javascript', '.json': 'application/json',
  // NOTE: '.mjs' is deliberately NOT mapped here. Capacitor's iOS asset
  // handler has no ".mjs" MIME entry either, so leaving it as octet-stream
  // keeps this server honest about the iOS condition — a dynamic import()
  // of an octet-stream module FAILS. The app therefore ships ORT's jsep
  // sidecar with a .js extension (see app-v10/index.html). Do not "fix"
  // this line: it is what makes verify_local_ort.html a real iOS check.
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.onnx': 'application/octet-stream', '.wasm': 'application/wasm',
  '.mp4': 'video/mp4', '.task': 'application/octet-stream',
};

http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  if (req.method === 'POST' && u.pathname === '/scratch-save') {
    const name = (u.query.name || 'unnamed.bin').replace(/\.\./g, '').replace(/^[/\\]+/, '');
    const dest = path.join(RUNS, name);
    if (!dest.startsWith(RUNS)) { res.writeHead(400); res.end('bad path'); return; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(dest, Buffer.concat(chunks));
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }

  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/scratch/eval-harness.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(path.normalize(ROOT))) { res.writeHead(403); res.end(); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found: ' + p); return; }
    const ext = path.extname(file).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    // Dev server: never let the browser cache source — edits must always
    // load fresh (a stale cached offlineProcessor.js silently hid a fix).
    const noCache = { 'Cache-Control': 'no-store, must-revalidate' };
    const range = req.headers.range;
    if (range && st.size) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (isNaN(start) || start > end) { start = 0; end = st.size - 1; }
      res.writeHead(206, Object.assign({
        'Content-Type': mime,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + st.size,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
      }, noCache));
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, Object.assign({ 'Content-Type': mime, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' }, noCache));
      fs.createReadStream(file).pipe(res);
    }
  });
}).listen(PORT, () => console.log('eval server on http://localhost:' + PORT + '/ (root=' + ROOT + ')'));
