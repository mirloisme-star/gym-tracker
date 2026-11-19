// Bump VERSION whenever any file below changes, so phones pick up the new build.
const VERSION = 'gym-v6';
const FILES = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/body-map.js',
  'js/body-paths.js',
  'js/body-svg.js',
  'js/charts.js',
  'js/coach.js',
  'js/coach-prompt.js',
  'js/daily.js',
  'js/dashboard.js',
  'js/home.js',
  'js/onboarding.js',
  'js/photo.js',
  'js/program.js',
  'js/settings.js',
  'js/stats.js',
  'js/store.js',
  'js/templates.js',
  'js/timer.js',
  'js/ui.js',
  'js/util.js',
  'js/workout.js',
  'fonts/Vazirmatn-UI-FD-Regular.woff2',
  'fonts/Vazirmatn-UI-FD-Bold.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/welcome.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});
