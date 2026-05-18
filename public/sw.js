// Service Worker for WeebVIP
const CACHE_NAME = 'weebvip-v1';
const API_CACHE_NAME = 'weebvip-api-v1';
const IMAGE_CACHE_NAME = 'weebvip-images-v1';

// URLs to cache on install
const STATIC_CACHE_URLS = [
  '/',
  '/airing',
  '/assets/icons/logo6-rev-sm_sm.png'
];

// API endpoints to cache
const API_PATTERNS = [
  /^https:\/\/weeb-api\.staging\.weeb\.vip\/.*/,
  /^https:\/\/gateway\.staging\.weeb\.vip\/graphql$/
];

// Image patterns to cache
const IMAGE_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/
];

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Caching static resources');
      return cache.addAll(STATIC_CACHE_URLS);
    }).then(() => {
      console.log('✅ Service Worker: Installation complete');
    }).catch(error => {
      console.error('❌ Service Worker: Installation failed', error);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('🧹 Service Worker: Cleaning up old caches');
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (![CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME].includes(cacheName)) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Activation complete');
    }).catch(error => {
      console.error('❌ Service Worker: Activation failed', error);
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests (only cache GET requests)
  if (API_PATTERNS.some(pattern => pattern.test(request.url))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Only cache successful GET responses
          if (response.status === 200 && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached version on network failure
          return caches.match(request);
        })
    );
    return;
  }

  // Handle image requests
  if (IMAGE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(cache => {
        return cache.match(request).then(response => {
          if (response) {
            return response;
          }
          return fetch(request).then(fetchResponse => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }

  // Handle other requests with cache-first strategy for static assets
  if (url.pathname.startsWith('/assets/') || url.pathname.includes('.')) {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request);
      })
    );
    return;
  }

  // Handle navigation requests with network-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful navigation responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached version or offline page
          return caches.match(request).then(response => {
            return response || caches.match('/');
          });
        })
    );
  }
});