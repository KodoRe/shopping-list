/* Home Kitchen — service worker.
 *
 * SCOPE OF RESPONSIBILITY (read before editing):
 *   This SW caches the STATIC APP SHELL so the app installs and opens offline.
 *   It must NEVER cache the data API (/api/*). The browser Store layer
 *   (js/store.js) already owns offline data via localStorage; if the SW also
 *   cached /api responses we'd serve stale data that fights the Store — a
 *   subtle, data-corrupting bug. So: /api/* is always network-only, full stop.
 *
 * CACHE STRATEGY
 *   - install : precache the shell, then skipWaiting (new SW activates at once).
 *   - /api/*  : network-only, bypass cache entirely.
 *   - nav     : network-first → fall back to cached index.html when offline.
 *   - assets  : cache-first → instant, offline-capable; refresh in background.
 *   - activate: delete old shell caches, clients.claim.
 *
 * VERSIONING
 *   Bump CACHE_VERSION whenever a shell asset changes. It is kept in lock-step
 *   with the ?v=NN cache-bust query already used across index.html so there is a
 *   single mental version for the whole shell.
 */
'use strict';

const CACHE_VERSION = 'v16';
const SHELL_CACHE = `hk-shell-${CACHE_VERSION}`;

// The static shell. Query-stripped paths; the fetch handler matches by pathname
// so the ?v=NN busters on the live pages still resolve to these entries.
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/config.js',
  '/supabase-client.js',
  '/js/shelf-life.js',
  '/js/local-api.js',
  '/js/store.js',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

// ---- install: precache shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ---- activate: purge old shell caches, take control ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('hk-shell-') && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Strip the ?v=NN (and any) query so a busted asset URL still hits its cache entry.
function shellKey(url) {
  return new URL(url).pathname;
}

// ---- fetch: route by request kind ----
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever handle same-origin GETs. Cross-origin (fonts CDN) and non-GET
  // (the whole /api write surface) pass straight through to the network.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HARD RULE: never cache the data API. Network-only.
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') {
    return; // default browser fetch
  }

  // Navigations: network-first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then(
        (hit) => hit || caches.match('/')
      ))
    );
    return;
  }

  // Static assets: cache-first (match by pathname so ?v=NN still resolves),
  // falling back to network and warming the cache on a miss.
  event.respondWith(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.match(shellKey(req.url)).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          // Only cache good, basic (same-origin) responses.
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(shellKey(req.url), res.clone());
          }
          return res;
        });
      })
    )
  );
});
