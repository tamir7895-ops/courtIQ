/**
 * CourtIQ — Live-Reload Dev Server + Overnight Trainer Downloader
 * ────────────────────────────────────────────────────────────────
 * • Serves courtIQ/ as a static site
 * • Watches ALL files for changes (CSS, JS, HTML, JSON…)
 * • Pushes a Server-Sent Event to every open browser tab
 * • API: /api/trainer/start|status|videos — downloads basketball videos
 *
 * Zero external dependencies — pure Node.js built-ins only.
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const ROOT         = __dirname;
const PORT         = parseInt(process.env.PORT, 10) || 8080;
const TRAINING_DIR = path.join(ROOT, 'tools', 'training-videos');
fs.mkdirSync(TRAINING_DIR, { recursive: true });

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
  '.mp4':   'video/mp4',
  '.webm':  'video/webm',
  '.mov':   'video/quicktime',
  '.avi':   'video/x-msvideo',
};

/* ── SSE client registry ─────────────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════════
   OVERNIGHT TRAINER — Video Downloader
   ══════════════════════════════════════════════════════════════ */

const trainer = {
  status:    'idle',   // idle | searching | downloading | done | error
  log:       [],       // [{ts, msg}]
  videos:    [],       // [{name, webPath, size, score}]
  total:     0,
  done:      0,
  errors:    0,
  startedAt: null,
};

function tLog(msg) {
  const entry = { ts: Date.now(), msg };
  trainer.log.push(entry);
  if (trainer.log.length > 300) trainer.log.shift();
  console.log('  [trainer] ' + msg);
}

/* ── Low-level HTTP/HTTPS GET with redirect following ── */
function fetchRaw(rawUrl, redirectsLeft) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft === 0) return reject(new Error('Too many redirects'));
    const parsed = new url.URL(rawUrl);
    const lib    = parsed.protocol === 'https:' ? https : http;
    const opts   = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers:  { 'User-Agent': 'CourtIQ-Trainer/1.0' },
      timeout:  20000,
    };
    const req = lib.request(opts, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new url.URL(res.headers.location, rawUrl).href;
        res.resume();
        return resolve(fetchRaw(next, redirectsLeft - 1));
      }
      resolve(res);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

function fetchJson(rawUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const res = await fetchRaw(rawUrl, 5);
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => { body += d; if (body.length > 2 * 1024 * 1024) res.destroy(); });
      res.on('end',  () => { try { resolve(JSON.parse(body)); } catch(e) { reject(e); } });
      res.on('error', reject);
    } catch(e) { reject(e); }
  });
}

/* ── Stream a URL to disk, max 80 MB ── */
function downloadToFile(rawUrl, destPath) {
  return new Promise(async (resolve, reject) => {
    const MAX = 80 * 1024 * 1024;
    try {
      const res = await fetchRaw(rawUrl, 5);
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const ws  = fs.createWriteStream(destPath);
      let bytes = 0;
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > MAX) { res.destroy(); ws.destroy(); reject(new Error('File too large')); }
      });
      res.pipe(ws);
      ws.on('finish', () => resolve(bytes));
      ws.on('error',  reject);
      res.on('error', reject);
    } catch(e) { reject(e); }
  });
}

/* ── Score a candidate video (0–1) ── */
function scoreCandidate(identifier, fileName, fileSizeBytes, title) {
  let score = 0;

  // Size sweet spot: 3 MB – 60 MB
  const mb = fileSizeBytes / (1024 * 1024);
  if      (mb >= 5  && mb <= 30)  score += 0.40;
  else if (mb >= 3  && mb <= 60)  score += 0.25;
  else if (mb >= 1  && mb <= 80)  score += 0.10;
  else                            return 0;  // discard

  // Prefer mp4
  if (fileName.toLowerCase().endsWith('.mp4'))  score += 0.20;
  else if (fileName.toLowerCase().endsWith('.webm')) score += 0.10;
  else                                           score -= 0.10;

  // Title keywords
  const t = (title + ' ' + identifier).toLowerCase();
  const ballKeys = ['basketball','shoot','shot','basket','layup','dribble','free throw','practice','drill','court','game','hoops','nba'];
  for (const k of ballKeys) if (t.includes(k)) { score += 0.08; break; }
  const goodKeys = ['training','practice','drill','tutorial','how to'];
  for (const k of goodKeys) if (t.includes(k)) { score += 0.05; break; }

  return Math.min(1, score);
}

/* ── Search Archive.org for basketball videos ── */
async function searchArchive(query, rows) {
  const apiUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&mediatype=movies&fl[]=identifier,title&sort[]=downloads+desc&rows=${rows}&output=json`;
  tLog(`Searching: "${query}"…`);
  const data = await fetchJson(apiUrl);
  return (data.response && data.response.docs) ? data.response.docs : [];
}

/* ── Get video files for an Archive.org identifier ── */
async function getVideoFiles(identifier, title) {
  const meta = await fetchJson(`https://archive.org/metadata/${identifier}`);
  if (!meta.files) return [];

  const videoExts = ['.mp4', '.webm', '.avi', '.mov', '.mkv'];
  const results   = [];

  for (const f of meta.files) {
    if (!f.name) continue;
    const ext = path.extname(f.name).toLowerCase();
    if (!videoExts.includes(ext)) continue;
    const size  = parseInt(f.size, 10) || 0;
    const score = scoreCandidate(identifier, f.name, size, title || identifier);
    if (score > 0.3) {
      results.push({
        identifier,
        fileName: f.name,
        fileUrl:  `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
        size,
        score,
        title: title || identifier,
      });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

/* ── Main download pipeline ── */
async function runTrainerDownload() {
  trainer.status    = 'searching';
  trainer.log       = [];
  trainer.videos    = [];
  trainer.total     = 0;
  trainer.done      = 0;
  trainer.errors    = 0;
  trainer.startedAt = Date.now();

  tLog('🏀 Overnight Trainer — מתחיל חיפוש סרטונים ב-Archive.org…');

  const queries = [
    'basketball shooting practice drill',
    'basketball free throw training',
    'basketball layup fundamentals',
    'basketball offense shooting',
    'basketball game highlights shot',
  ];

  // Gather candidates
  const candidates = [];
  for (const q of queries) {
    try {
      const docs = await searchArchive(q, 15);
      tLog(`  נמצאו ${docs.length} תוצאות עבור "${q}"`);
      for (const doc of docs) {
        try {
          const files = await getVideoFiles(doc.identifier, doc.title);
          for (const f of files) candidates.push(f);
        } catch(e) { /* skip */ }
        // small delay to be polite
        await new Promise(r => setTimeout(r, 300));
      }
    } catch(e) {
      tLog(`⚠️ שגיאת חיפוש: ${e.message}`);
    }
  }

  if (candidates.length === 0) {
    trainer.status = 'error';
    tLog('❌ לא נמצאו סרטונים מתאימים');
    return;
  }

  // Deduplicate by URL, sort by score, pick top 20
  const seen   = new Set();
  const unique = candidates.filter(c => {
    if (seen.has(c.fileUrl)) return false;
    seen.add(c.fileUrl);
    return true;
  });
  unique.sort((a, b) => b.score - a.score);
  const picks = unique.slice(0, 20);

  tLog(`📋 נבחרו ${picks.length} סרטונים הכי טובים להורדה`);
  trainer.total  = picks.length;
  trainer.status = 'downloading';

  for (let i = 0; i < picks.length; i++) {
    const c    = picks[i];
    const ext  = path.extname(c.fileName).toLowerCase();
    const safe = `video_${String(i + 1).padStart(2, '0')}_${c.identifier.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}${ext}`;
    const dest = path.join(TRAINING_DIR, safe);

    // Skip if already exists and is same size
    try {
      const st = fs.statSync(dest);
      if (st.size > 1024 * 100) {
        tLog(`✅ [${i+1}/${picks.length}] כבר קיים: ${safe}`);
        trainer.videos.push({ name: safe, webPath: `/tools/training-videos/${safe}`, size: st.size, score: c.score });
        trainer.done++;
        continue;
      }
    } catch(_) {}

    tLog(`⬇️  [${i+1}/${picks.length}] מוריד: ${c.title.slice(0, 50)} (${(c.size / 1024 / 1024).toFixed(1)} MB, score=${c.score.toFixed(2)})`);
    try {
      const bytes = await downloadToFile(c.fileUrl, dest);
      trainer.videos.push({ name: safe, webPath: `/tools/training-videos/${safe}`, size: bytes, score: c.score });
      trainer.done++;
      tLog(`✅ [${i+1}/${picks.length}] הורד: ${safe} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
    } catch(e) {
      trainer.errors++;
      tLog(`❌ [${i+1}/${picks.length}] נכשל: ${e.message}`);
      try { fs.unlinkSync(dest); } catch(_) {}
    }

    // Pause between downloads
    await new Promise(r => setTimeout(r, 800));
  }

  trainer.status = 'done';
  tLog(`🎉 סיום! הורדו ${trainer.done} סרטונים (${trainer.errors} שגיאות). מוכן לאימון!`);
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
    res.write('retry: 2000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  /* ── CORS preflight ── */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' });
    res.end();
    return;
  }

  /* ── Trainer API: /api/trainer/start ── */
  if (urlPath === '/api/trainer/start') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    if (trainer.status === 'idle' || trainer.status === 'done' || trainer.status === 'error') {
      runTrainerDownload().catch(e => {
        trainer.status = 'error';
        tLog('💥 Fatal error: ' + e.message);
      });
      res.end(JSON.stringify({ ok: true, msg: 'started' }));
    } else {
      res.end(JSON.stringify({ ok: false, msg: 'already running: ' + trainer.status }));
    }
    return;
  }

  /* ── Trainer API: /api/trainer/status ── */
  if (urlPath === '/api/trainer/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      status:    trainer.status,
      total:     trainer.total,
      done:      trainer.done,
      errors:    trainer.errors,
      videos:    trainer.videos,
      log:       trainer.log.slice(-50),   // last 50 log lines
      elapsedMs: trainer.startedAt ? Date.now() - trainer.startedAt : 0,
    }));
    return;
  }

  /* ── Trainer API: /api/trainer/videos ── */
  if (urlPath === '/api/trainer/videos') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    // Also scan disk for any existing videos
    let files = [];
    try {
      files = fs.readdirSync(TRAINING_DIR)
        .filter(f => ['.mp4','.webm','.mov','.avi'].includes(path.extname(f).toLowerCase()))
        .map(f => {
          const st = fs.statSync(path.join(TRAINING_DIR, f));
          return { name: f, webPath: `/tools/training-videos/${f}`, size: st.size };
        });
    } catch(_) {}
    res.end(JSON.stringify({ videos: files }));
    return;
  }

  /* ── Trainer API: /api/trainer/reset ── */
  if (urlPath === '/api/trainer/reset') {
    trainer.status = 'idle';
    trainer.log    = [];
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true }));
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
  console.log('  Trainer API: /api/trainer/start|status|videos');
  console.log('');
});

/* ── File watcher ────────────────────────────────────────────── */
const IGNORE = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db', 'training-videos']);
const DEBOUNCE_MS = 150;

let debounceTimer = null;
let pendingChanges = new Map();
const watched = new Set();

function flushChanges() {
  const changes = new Map(pendingChanges);
  pendingChanges.clear();

  let hasCSS   = false;
  let hasOther = false;
  const cssFiles = [];

  for (const [fullPath, ext] of changes) {
    const rel = path.relative(ROOT, fullPath);
    console.log('  ↺  Changed: ' + rel);
    if (ext === '.css') { hasCSS = true; cssFiles.push(path.basename(fullPath)); }
    else                { hasOther = true; }
  }

  if (hasOther) {
    broadcast('reload', { file: 'multiple' });
  } else if (hasCSS) {
    cssFiles.forEach(f => broadcast('css', { file: f }));
  }
}

function handleChange(eventType, fullPath) {
  const ext  = path.extname(fullPath).toLowerCase();
  const base = path.basename(fullPath);
  if (base.startsWith('.') || base.startsWith('~') || base.endsWith('~')) return;
  pendingChanges.set(fullPath, ext);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushChanges, DEBOUNCE_MS);
}

function watchDir(dir) {
  if (watched.has(dir)) return;
  watched.add(dir);

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
