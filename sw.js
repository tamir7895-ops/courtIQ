/* ============================================================
   SERVICE WORKER — CourtIQ PWA
   Cache-first for static assets, network-first for API calls.

   IMPORTANT: All paths are relative (no leading /) so this works
   on both localhost AND GitHub Pages (which serves from /courtIQ/).
   ============================================================ */
const CACHE_VERSION = 20;
const CACHE_NAME = 'courtiq-v' + CACHE_VERSION;  // bump this number on each deploy
const STATIC_ASSETS = [
  './',
  './index.html',
  // Styles
  './styles/main.css',
  './styles/animations.css',
  './styles/components.css',
  './styles/drills.css',
  './styles/workouts.css',
  './styles/shot-tracker.css',
  './styles/feature-heroes.css',
  './styles/charts.css',
  './styles/move-library.css',
  './styles/profile.css',
  './styles/daily-workout.css',
  './styles/gamification.css',
  './styles/dashboard-redesign.css',
  './styles/onboarding.css',
  './styles/archetype.css',
  './styles/social.css',
  './styles/shop.css',
  './styles/challenge.css',
  // Core JS
  './js/utils.js',
  './js/auth.js',
  './js/nav.js',
  './js/supabase-client.js',
  './js/data-service.js',
  './js/animations.js',
  './js/sidebar.js',
  './js/sound-effects.js',
  // Dashboard JS
  './js/dashboard.js',
  './js/feature-modals.js',
  './js/feature-tabs.js',
  './js/pricing.js',
  './js/onboarding.js',
  './js/streak.js',
  './js/daily-challenge.js',
  // Feature JS
  './js/drill-engine.js',
  './js/drill-animations.js',
  './js/shot-tracker.js',
  './js/progress-charts.js',
  './js/move-library.js',
  './js/move-animations.js',
  './js/player-profile.js',
  './js/daily-workout.js',
  './js/gamification.js',
  './js/archetype-engine.js',
  './js/social-hub.js',
  './js/ai-coach.js',
  './js/court-heatmap.js',
  './js/notifications.js',
  './js/workout-timer.js',
  './js/badges.js',
  './styles/badges.css',
  './js/video-review.js',
  './features/shot-tracking/utils/heatmapGenerator.js',
  './manifest.json'
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

/* ── Push notification click — open the app ──────────────── */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.includes('index.html') && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

/* ── Push event (for future server-side push) ────────────── */
self.addEventListener('push', function (event) {
  var data = { title: 'CourtIQ', body: 'Time to train!' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'assets/logo-icon.svg',
      badge: 'icons/icon-192.png',
      vibrate: [200, 100, 200]
    })
  );
});

/* ── Fetch: cache-first for static, network-first for API ── */
self.addEventListener('fetch', function (event) {
  var url = event.request.url;

  // DEVELOPMENT: always go to network for localhost — never cache local files
  if (url.includes('127.0.0.1') || url.includes('localhost')) {
    event.respondWith(fetch(event.request));
    return;
  }

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

  // Strip cache-busting query params (?v=3) for cache matching
  var cleanUrl = event.request.url.replace(/\?v=\d+$/, '');
  var cacheRequest = cleanUrl !== event.request.url ? new Request(cleanUrl) : event.request;

  event.respondWith(
    caches.match(cacheRequest).then(function (cached) {
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
