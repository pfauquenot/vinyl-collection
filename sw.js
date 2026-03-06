const CACHE_NAME = 'vinyltheque-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/app.js',
    '/style.css',
    '/vinyl.png',
    '/favicon.svg',
    '/logo.svg',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/manifest.json'
];

const EXTERNAL_ASSETS = [
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap'
];

// Installation — mise en cache des ressources statiques
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activation — nettoyage des anciens caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch — stratégie network-first pour les API, cache-first pour les assets
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Ne pas intercepter les requêtes Firebase Auth/Firestore API
    if (url.hostname.includes('googleapis.com') && !url.pathname.includes('/css')) {
        return;
    }
    if (url.hostname.includes('firebaseio.com') || url.hostname.includes('firestore.googleapis.com')) {
        return;
    }
    // Ne pas intercepter les requêtes Deezer, Discogs, Anthropic
    if (url.hostname.includes('deezer.com') || url.hostname.includes('discogs.com') || url.hostname.includes('anthropic.com')) {
        return;
    }
    // Ne pas intercepter les requêtes Google Drive
    if (url.hostname.includes('drive.google.com') || url.hostname.includes('content.googleapis.com')) {
        return;
    }

    // Pour les Google Fonts (CSS et fichiers de police) : cache-first
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // Pour les scripts Firebase (CDN gstatic) : cache-first
    if (url.hostname.includes('gstatic.com')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // Pour les pochettes d'albums (images externes) : cache-first
    if (event.request.destination === 'image' && url.origin !== self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => new Response('', { status: 404 }));
            })
        );
        return;
    }

    // Pour les ressources locales : network-first avec fallback cache
    event.respondWith(
        fetch(event.request).then(response => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return response;
        }).catch(() => {
            return caches.match(event.request);
        })
    );
});
