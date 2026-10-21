/* BrowsEye offline shell. Exhibit packages remain local user files and are not
   copied into a cache by this worker. */
const CACHE = 'browseye-shell-v1';
const SHELL = ['/', '/index.html', '/eye.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response;
    }).catch(() => caches.match(event.request).then((saved) => saved || caches.match('/index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then((saved) => saved || fetch(event.request).then((response) => {
    if (response.ok && /\/(assets|vendor)\//.test(new URL(event.request.url).pathname)) {
      caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    }
    return response;
  })));
});
