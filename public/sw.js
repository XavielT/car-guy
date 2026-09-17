/**
 * Service worker for the web build.
 *
 * Music Hub gets this from @angular/service-worker via ngsw-config.json; Expo
 * has no equivalent, so this is the hand-written counterpart. It exists for two
 * reasons: installability (Chrome wants a fetch handler before it will offer
 * "Install app"), and so a driver at a pump with no signal still gets the app.
 *
 * Bump CACHE when the caching rules below change. Build output does not need a
 * bump: everything under /_expo/static/ is content-hashed, so a new build asks
 * for new filenames and the stale entries are only ever dead weight.
 */
const CACHE = 'carguy-v1';

self.addEventListener('install', () => {
  // Nothing to precache: the export is hashed and the shell is picked up on
  // first visit. Take over straight away rather than waiting for a tab close.
  self.skipWaiting();
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

  // Hashed build output and bundled assets: the filename already identifies the
  // contents, so cache-first is safe and makes repeat launches instant.
  if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ??
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
    return;
  }

  // Pages: network first, so a deploy is picked up immediately, falling back to
  // the last copy of this route and finally to the app entry point.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit ?? caches.match('/'))
            .then((hit) => hit ?? Response.error()),
        ),
    );
  }
});
