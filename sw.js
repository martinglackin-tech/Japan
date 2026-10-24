// Offline support. Bump CORE_CACHE when the list of core files changes.
const CORE_CACHE = 'jf-japan-core-v3';
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
    'icons/icon-512.png',
    'icons/icon-maskable-512.png',
    'icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CORE_CACHE)
            // Skip the HTTP cache so a deploy is never precached with stale files.
            .then(cache => cache.addAll(CORE_FILES.map(file => new Request(file, { cache: 'reload' }))))
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

// The app's own files are fetched from the network first, so the page and its scripts
// always come from the same deploy; the cache is only used offline. (Serving cached
// scripts first once paired a new index.html with an old app.js, leaving a blank page.)
function networkFirst(request, cacheKey = request) {
    return fetch(request, { cache: 'no-cache' })
        .then(response => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CORE_CACHE).then(cache => cache.put(cacheKey, copy));
            }
            return response;
        })
        .catch(() => caches.match(cacheKey, { ignoreSearch: true }));
}

// Fonts don't change, so serve them from the cache and refresh in the background.
function staleWhileRevalidate(event, cacheName) {
    return caches.open(cacheName).then(cache =>
        cache.match(event.request).then(cached => {
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
            event.respondWith(networkFirst(request, 'index.html'));
            return;
        }
        if (url.pathname.includes('/audio/') && !url.pathname.endsWith('/audio/index.json')) {
            // Recordings never change in place (new text gets a new file name).
            event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
            return;
        }
        event.respondWith(networkFirst(request));
        return;
    }

    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(event, FONT_CACHE));
    }
    // Everything else (e.g. the online voice) goes straight to the network.
});

// Google Fonts splits each font into files by character range. The page sends its font
// stylesheets and the characters it shows (see app.js), so the files it needs are cached
// on the first visit, before this worker was handling the page's requests.
function inUnicodeRange(range, codePoint) {
    return range.split(',').some(part => {
        const [lo, hi = lo] = part.trim().replace(/^U\+/i, '').split('-');
        const low = parseInt(lo.replace(/\?/g, '0'), 16);
        const high = parseInt((hi === lo ? lo.replace(/\?/g, 'F') : hi), 16);
        return codePoint >= low && codePoint <= high;
    });
}

async function cacheFonts(cssUrls, chars) {
    const cache = await caches.open(FONT_CACHE);
    const codePoints = [...chars].map(c => c.codePointAt(0));
    const save = async (url) => {
        if (await cache.match(url)) return cache.match(url);
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response.clone());
        return response;
    };
    for (const cssUrl of cssUrls) {
        const css = await (await save(cssUrl)).text();
        const files = (css.match(/@font-face\s*{[^}]*}/g) || []).filter(face => {
            const range = face.match(/unicode-range:\s*([^;}]+)/);
            return !range || codePoints.some(cp => inUnicodeRange(range[1], cp));
        }).map(face => (face.match(/url\(([^)]+)\)/) || [])[1]).filter(Boolean);
        await Promise.all(files.map(url => save(url.replace(/['"]/g, '')).catch(() => {})));
    }
}

self.addEventListener('message', (event) => {
    const { data } = event;
    if (!data || data.type !== 'cache-fonts' || !Array.isArray(data.css) || typeof data.chars !== 'string') return;
    const css = data.css.filter(url => url.startsWith('https://fonts.googleapis.com/'));
    event.waitUntil(cacheFonts(css, data.chars).catch(() => {}));
});
