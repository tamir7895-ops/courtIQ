/**
 * CourtIQ — Live-Reload Dev Server
 * ─────────────────────────────────
 * • Serves basketball-ai/ as a static site
 * • Watches ALL files for changes (CSS, JS, HTML, JSON…)
 * • Pushes a Server-Sent Event to every open browser tab
 * • Browser tab reloads automatically — zero manual refresh needed
 *
 * Zero external dependencies — pure Node.js built-ins only.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT, 10) || 8080;

/* ── MIME types ─────────────────────────────────────────────── */
const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css',
  '.js':    'application/javascript',
  '.json':  'application/json',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
  '.ttf':   'font/ttf',
  '.webp':  'image/webp',
};

/* ── SSE client registry ─────────────────────────────────────── */
// Each entry is a ServerResponse kept open for SSE streaming
const clients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => {
    try { res.write(msg); } catch (_) { clients.delete(res); }
  });
}

/* ── Inject live-reload <script> into HTML ───────────────────── */
const LIVE_SCRIPT = `
<script>
(function(){
  var src = new EventSource('/__live');
  src.addEventListener('reload', function(){ location.reload(); });
  src.addEventListener('css', function(e){
    // Hot-swap CSS without full reload
    var file = JSON.parse(e.data).file;
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function(el){
      if(el.href && el.href.indexOf(file) !== -1){
        var url = el.href.split('?')[0];
        el.href = url + '?t=' + Date.now();
      }
    });
  });
  src.onerror = function(){ setTimeout(function(){ location.reload(); }, 1500); };
})();
</script>`;

function injectLiveScript(html) {
  const tag = html.lastIndexOf('</body>');
  if (tag !== -1) return html.slice(0, tag) + LIVE_SCRIPT + html.slice(tag);
  return html + LIVE_SCRIPT;
}

/* ── HTTP server ─────────────────────────────────────────────── */
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];

  /* ── SSE endpoint ── */
  if (urlPath === '/__live') {
    res.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 2000\n\n'); // auto-reconnect in 2s if dropped
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  /* ── Static file ── */
  let filePath = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);

  // Security: block path traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 — Not found: ' + urlPath);
      return;
    }

    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type':  mime,
      'Cache-Control': 'no-cache, no-store',
      'Access-Control-Allow-Origin': '*',
    });

    // Inject live-reload script into HTML files
    if (ext === '.html') {
      res.end(injectLiveScript(data.toString('utf8')));
    } else {
      res.end(data);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  ⚡ CourtIQ Live Server');
  console.log('  ─────────────────────────────────────');
  console.log('  http://127.0.0.1:' + PORT);
  console.log('  Watching: ' + ROOT);
  console.log('  Live reload: ON');
  console.log('');
});

/* ── File watcher ────────────────────────────────────────────── */
const IGNORE = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db']);
const DEBOUNCE_MS = 150; // collapse rapid saves into one reload

let debounceTimer = null;
let pendingChanges = new Map(); // path → ext, collapse multiple edits
const watched = new Set();      // prevent duplicate watchers

function flushChanges() {
  const changes = new Map(pendingChanges);
  pendingChanges.clear();

  let hasCSS  = false;
  let hasOther = false;
  const cssFiles = [];

  for (const [fullPath, ext] of changes) {
    const rel = path.relative(ROOT, fullPath);
    console.log('  ↺  Changed: ' + rel);
    if (ext === '.css') { hasCSS = true; cssFiles.push(path.basename(fullPath)); }
    else                { hasOther = true; }
  }

  if (hasOther) {
    // Any non-CSS change → single full reload
    broadcast('reload', { file: 'multiple' });
  } else if (hasCSS) {
    // CSS-only → hot-swap each file
    cssFiles.forEach(f => broadcast('css', { file: f }));
  }
}

function handleChange(eventType, fullPath) {
  const ext  = path.extname(fullPath).toLowerCase();
  const base = path.basename(fullPath);

  // Ignore hidden files, temp files, and common noise
  if (base.startsWith('.') || base.startsWith('~') || base.endsWith('~')) return;

  pendingChanges.set(fullPath, ext);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushChanges, DEBOUNCE_MS);
}

function watchDir(dir) {
  if (watched.has(dir)) return;  // prevent duplicate directory watchers
  watched.add(dir);

  fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
    if (err) return;
    entries.forEach(entry => {
      if (IGNORE.has(entry.name)) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        watchDir(full); // recurse
      } else if (!watched.has(full)) {
        watched.add(full);
        fs.watch(full, { persistent: true }, (evt) => handleChange(evt, full));
      }
    });
  });

  // Watch directory for new files only (debounced re-scan)
  let dirTimer = null;
  fs.watch(dir, { persistent: true }, () => {
    clearTimeout(dirTimer);
    dirTimer = setTimeout(() => {
      fs.readdir(dir, { withFileTypes: true }, (err, entries) => {
        if (err) return;
        entries.forEach(entry => {
          if (IGNORE.has(entry.name)) return;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            watchDir(full);
          } else if (!watched.has(full)) {
            watched.add(full);
            fs.watch(full, { persistent: true }, (evt) => handleChange(evt, full));
          }
        });
      });
    }, 300);
  });
}

watchDir(ROOT);
console.log('  Watching for file changes…\n');
