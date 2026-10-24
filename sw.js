// Offline support. Bump CORE_CACHE when the list of core files changes.
const CORE_CACHE = 'jf-japan-core-v1';
const FONT_CACHE = 'jf-japan-fonts-v1';
// Filled by app.js (loadRecordings); listed here so activate doesn't delete it.
const AUDIO_CACHE = 'jf-japan-audio-v1';

const CORE_FILES = [
    './',
    'index.html',
    'styles.css',
    'data.js',
    'app.js',
    'vendor/confetti.browser.js',
    'manifest.webmanifest',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CORE_CACHE)
            .then(cache => cache.addAll(CORE_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    const keep = [CORE_CACHE, FONT_CACHE, AUDIO_CACHE];
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => !keep.includes(key)).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// Serve from cache straight away, then refresh the cache in the background,
// so a new deploy shows up on the next visit.
function staleWhileRevalidate(event, cacheName) {
    return caches.open(cacheName).then(cache =>
        cache.match(event.request, { ignoreSearch: true }).then(cached => {
            const network = fetch(event.request)
                .then(response => {
                    if (response && (response.ok || response.type === 'opaque')) {
                        cache.put(event.request, response.clone());
                    }
                    return response;
                })
                .catch(() => cached);
            if (cached) {
                event.waitUntil(network.then(() => {}));
                return cached;
            }
            return network;
        })
    );
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        if (request.mode === 'navigate') {
            // Any navigation inside the app falls back to the cached page when offline.
            event.respondWith(
                fetch(request)
                    .then(response => {
                        if (response.ok) {
                            const copy = response.clone();
                            caches.open(CORE_CACHE).then(cache => cache.put('index.html', copy));
                        }
                        return response;
                    })
                    .catch(() => caches.match('index.html'))
            );
            return;
        }
        if (url.pathname.endsWith('/audio/index.json')) {
            // Network first so newly generated recordings are picked up.
            event.respondWith(fetch(request).catch(() => caches.match(request, { ignoreSearch: true })));
            return;
        }
        if (url.pathname.includes('/audio/')) {
            event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
            return;
        }
        event.respondWith(staleWhileRevalidate(event, CORE_CACHE));
        return;
    }

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(event, FONT_CACHE));
    }
    // Everything else (e.g. the online voice) goes straight to the network.
});
