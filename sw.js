/* ============================================================
   SERVICE WORKER — CourtIQ PWA
   Cache-first for static assets, network-first for API calls.
   ============================================================ */
const CACHE_NAME = 'courtiq-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/styles/main.css',
  '/styles/animations.css',
  '/styles/drills.css',
  '/styles/workouts.css',
  '/styles/shot-tracker.css',
  '/styles/charts.css',
  '/styles/move-library.css',
  '/styles/profile.css',
  '/styles/daily-workout.css',
  '/styles/gamification.css',
  '/js/auth.js',
  '/js/nav.js',
  '/js/dashboard.js',
  '/js/drill-engine.js',
  '/js/shot-tracker.js',
  '/js/progress-charts.js',
  '/js/move-library.js',
  '/js/player-profile.js',
  '/js/daily-workout.js',
  '/js/gamification.js',
  '/js/onboarding.js',
  '/js/data-service.js',
  '/js/animations.js',
  '/manifest.json'
];

/* ── Install: cache static shell ─────────────────────────── */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: remove old caches ────────────────────────── */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: cache-first for static, network-first for API ── */
self.addEventListener('fetch', function (event) {
  var url = event.request.url;

  // Network-first: Supabase, Anthropic, and CDN resources
  if (
    url.includes('supabase.co') ||
    url.includes('anthropic') ||
    url.includes('cdn.jsdelivr') ||
    url.includes('cdnjs.cloudflare') ||
    url.includes('unpkg.com')
  ) {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first for everything else (GET only)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        // Cache new static assets on the fly
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});
