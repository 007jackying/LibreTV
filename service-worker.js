const CACHE = 'static-v1';

// Static extensions worth caching
const STATIC_RE = /\.(js|css|woff2?|png|svg|ico|webp)(\?.*)?$/;

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    // Clean up old cache versions
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    // Only handle GET; skip cross-origin and API routes
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return;

    if (STATIC_RE.test(url.pathname)) {
        // Cache-first: serve from cache, fall back to network then cache the response
        event.respondWith(
            caches.open(CACHE).then(cache =>
                cache.match(request).then(cached => {
                    if (cached) return cached;
                    return fetch(request).then(response => {
                        if (response.ok) cache.put(request, response.clone());
                        return response;
                    });
                })
            )
        );
    }
    // Everything else: default network fetch (no SW involvement)
});
