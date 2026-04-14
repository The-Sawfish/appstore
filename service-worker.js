/* ==========================================================================
   SAWFISH APP STORE — SERVICE WORKER
   Safe, minimal, iOS-compatible Progressive Web App caching
   Version: 1.0.0
   ========================================================================== */

const CACHE_NAME = 'sawfish-pwa-v3';
const STATIC_CACHE_NAME = 'sawfish-static-v3';
const DYNAMIC_CACHE_NAME = 'sawfish-dynamic-v3';

// Assets to cache immediately on install
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/icon-72.png',
    './icons/icon-96.png',
    './icons/icon-128.png',
    './icons/icon-144.png',
    './icons/icon-152.png',
    './icons/icon-192.png',
    './icons/icon-384.png',
    './icons/icon-512.png',
    './icons/hack.png',
    './icons/game-portal.png',
    './icons/chat.png',
    './icons/call.png',
    './icons/circle.png',
    './icons/2048.png',
    './icons/minecraft.png',
    './icons/blockblast.png',
    './icons/sandboxels.png',
    './icons/run3.png',
    './icons/novaos.png',
    './icons/winripen.png',
    './icons/plutoos.png',
    './icons/ripenos.png',
    './icons/syrup.png',
    './icons/bobtherobber.png',
    './icons/retrobowl.png',
    './icons/paperio2.png'
];

// External domains to cache with different strategy
const EXTERNAL_DOMAINS = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://www.gstatic.com',
    'https://firebase.googleapis.com',
    'https://via.placeholder.com',
    'https://runnova.github.io',
    'https://ripenos.web.app',
    'https://pluto-app.zeon.dev',
    'https://zardoy.github.io',
    'https://aappqq.github.io',
    'https://the-sawfish.github.io',
    'https://jimeneutron.github.io',
    'https://bobtherobberunblocked.github.io'
];

// Cache strategies
const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// ==========================================================================
// INSTALL EVENT
// ==========================================================================
self.addEventListener('install', event => {
    console.log('[ServiceWorker] Install event');
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Caching static assets');
                
                // Add all static assets to cache
                // Use addAll with fallback for failed requests
                const cachePromises = STATIC_ASSETS.map(url => {
                    return caches.open(STATIC_CACHE_NAME)
                        .then(cache => {
                            return cache.add(url)
                                .then(() => {
                                    console.log(`[ServiceWorker] Cached: ${url}`);
                                })
                                .catch(error => {
                                    console.warn(`[ServiceWorker] Failed to cache: ${url}`, error);
                                });
                        });
                });
                
                return Promise.allSettled(cachePromises);
            })
            .then(() => {
                console.log('[ServiceWorker] Static assets cached successfully');
            })
            .catch(error => {
                console.error('[ServiceWorker] Cache install error:', error);
            })
    );
    
    // Activate immediately
    self.skipWaiting();
});

// ==========================================================================
// ACTIVATE EVENT
// ==========================================================================
self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Activate event');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                // Delete old caches
                const deletePromises = cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE_NAME && 
                        cacheName !== DYNAMIC_CACHE_NAME && 
                        cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                });
                
                return Promise.allSettled(deletePromises);
            })
            .then(() => {
                console.log('[ServiceWorker] Claiming clients');
                // Claim all clients immediately
                return self.clients.claim();
            })
    );
    
    // Notify clients about activation
    event.waitUntil(
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_ACTIVATED',
                    version: CACHE_NAME
                });
            });
        })
    );
});

// ==========================================================================
// FETCH EVENT
// ==========================================================================
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Skip Firebase and external API requests (always network)
    if (url.hostname.includes('firebase') || 
        url.hostname.includes('firestore') ||
        url.hostname.includes('api.')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Handle external domains (iframe previews)
    if (isExternalDomain(url)) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }
    
    // Handle navigation requests
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Handle API requests
    if (url.pathname.includes('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Default strategy: stale while revalidate for static assets
    event.respondWith(staleWhileRevalidate(request));
});

// ==========================================================================
// CACHE STRATEGIES
// ==========================================================================

/**
 * Cache First Strategy
 * Try cache first, fall back to network
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[ServiceWorker] Cache first failed:', error);
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const offlineResponse = await caches.match('./index.html');
            if (offlineResponse) {
                return offlineResponse;
            }
        }
        
        throw error;
    }
}

/**
 * Network First Strategy
 * Try network first, fall back to cache
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[ServiceWorker] Network failed, trying cache:', request.url);
        
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            const offlineResponse = await caches.match('./index.html');
            if (offlineResponse) {
                return offlineResponse;
            }
        }
        
        // Return a basic error response
        return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

/**
 * Stale While Revalidate Strategy
 * Return cached version immediately, update from network
 */
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request)
        .then(networkResponse => {
            // Cache successful responses
            if (networkResponse.ok) {
                const cache = caches.open(DYNAMIC_CACHE_NAME);
                cache.then(c => c.put(request, networkResponse.clone()));
            }
            return networkResponse;
        })
        .catch(error => {
            console.log('[ServiceWorker] Network request failed:', error);
            return null;
        });
    
    // Return cached response immediately, or wait for network if no cache
    return cachedResponse || fetchPromise;
}

// ==========================================================================
// HELPER FUNCTIONS
// ==========================================================================

/**
 * Check if URL is from an external domain
 */
function isExternalDomain(url) {
    return EXTERNAL_DOMAINS.some(domain => url.hostname.includes(domain));
}

/**
 * Check if URL should be cached
 */
function shouldCache(url) {
    const pathname = url.pathname;
    
    // Don't cache external resources (handled separately)
    if (isExternalDomain(url)) {
        return false;
    }
    
    // Don't cache data URLs
    if (url.protocol === 'data:') {
        return false;
    }
    
    // Don't cache blob URLs
    if (url.protocol === 'blob:') {
        return false;
    }
    
    // Don't cache query strings (API responses)
    if (pathname.includes('?') && pathname.includes('api')) {
        return false;
    }
    
    return true;
}

// ==========================================================================
// BACKGROUND SYNC (for offline ratings)
// ==========================================================================
self.addEventListener('sync', event => {
    console.log('[ServiceWorker] Sync event:', event.tag);
    
    if (event.tag === 'sync-ratings') {
        event.waitUntil(syncRatings());
    }
});

async function syncRatings() {
    // Get pending ratings from IndexedDB
    // This is a placeholder for offline sync functionality
    console.log('[ServiceWorker] Syncing ratings...');
    
    // Implementation would:
    // 1. Open IndexedDB
    // 2. Get pending ratings
    // 3. Sync with Firestore
    // 4. Clear pending items on success
}

// ==========================================================================
// PUSH NOTIFICATIONS (placeholder)
// ==========================================================================
self.addEventListener('push', event => {
    console.log('[ServiceWorker] Push event received');
    
    const options = {
        body: event.data ? event.data.text() : 'New update available!',
        icon: './icons/icon-192.png',
        badge: './icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Open App'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Sawfish App Store', options)
    );
});

self.addEventListener('notificationclick', event => {
    console.log('[ServiceWorker] Notification click:', event.action);
    
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            self.clients.matchAll().then(clientList => {
                if (clientList.length > 0) {
                    return clientList[0].focus();
                }
                return self.clients.openWindow('/');
            })
        );
    }
});

// ==========================================================================
// MESSAGE HANDLER (communication with main app)
// ==========================================================================
self.addEventListener('message', event => {
    console.log('[ServiceWorker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }).then(() => {
                event.ports[0].postMessage({ success: true });
            })
        );
    }
    
    if (event.data && event.data.type === 'GET_CACHE_SIZE') {
        event.waitUntil(
            getCacheSize().then(size => {
                event.ports[0].postMessage({ size: size });
            })
        );
    }
});

// ==========================================================================
// HELPER: Get cache size
// ==========================================================================
async function getCacheSize() {
    let totalSize = 0;
    
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
            }
        }
    }
    
    return totalSize;
}

// ==========================================================================
// PERIODIC BACKGROUND SYNC (if supported)
// ==========================================================================
self.addEventListener('periodicsync', event => {
    console.log('[ServiceWorker] Periodic sync:', event.tag);
    
    if (event.tag === 'update-content') {
        event.waitUntil(updateContent());
    }
});

async function updateContent() {
    // Check for app updates in background
    console.log('[ServiceWorker] Checking for content updates...');
    
    // This could fetch a manifest.json or version file
    // to check if new content is available
}

// ==========================================================================
// END OF SERVICE WORKER
// ==========================================================================
console.log('[ServiceWorker] Loaded successfully - Version:', CACHE_NAME);
 
