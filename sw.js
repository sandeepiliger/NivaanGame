/**
 * Service worker: cache-first for the app shell so the game works with no
 * network at all. Bump CACHE when shipping new files.
 */

const CACHE = 'nivaan-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './styles/base.css',
  './styles/components.css',
  './styles/screens.css',
  './styles/games.css',
  './src/main.js',
  './src/core/dom.js',
  './src/core/rng.js',
  './src/core/bus.js',
  './src/core/store.js',
  './src/core/audio.js',
  './src/core/router.js',
  './src/core/fx.js',
  './src/data/content.js',
  './src/data/catalog.js',
  './src/data/rewards.js',
  './src/engine/visual.js',
  './src/engine/session.js',
  './src/engine/drag.js',
  './src/engine/renderers/choice.js',
  './src/engine/renderers/dragdrop.js',
  './src/engine/renderers/order.js',
  './src/engine/renderers/memory.js',
  './src/engine/renderers/maze.js',
  './src/engine/renderers/coder.js',
  './src/engine/renderers/sudoku.js',
  './src/engine/renderers/symmetry.js',
  './src/engine/renderers/tapcount.js',
  './src/engine/renderers/connect.js',
  './src/games/util.js',
  './src/games/numbers.js',
  './src/games/letters.js',
  './src/games/colors.js',
  './src/games/shapes.js',
  './src/games/logic.js',
  './src/games/maze-lib.js',
  './src/games/coder-lib.js',
  './src/screens/home.js',
  './src/screens/map.js',
  './src/screens/play.js',
  './src/screens/result.js',
  './src/screens/rewards.js',
  './src/screens/progress.js',
  './src/screens/parents.js',
  './src/screens/profiles.js',
  './src/screens/dialogs.js',
  './src/screens/certificate.js',
  './src/ui/mascot.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // addAll rejects the whole batch on a single 404, so cache individually.
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Refresh in the background so updates land on the next launch.
        fetch(request)
          .then((response) => {
            if (response.ok) caches.open(CACHE).then((c) => c.put(request, response.clone()));
          })
          .catch(() => {});
        return cached;
      }
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
