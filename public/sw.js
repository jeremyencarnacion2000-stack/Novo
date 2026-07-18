// Service Worker for Novo Offline Support

// Bump these on every deploy that changes caching behavior — the activate
// handler below only clears caches whose name doesn't match, so reusing a
// name across deploys means old entries never get invalidated.
const CACHE_NAME = 'novo-v4';
const API_CACHE_NAME = 'novo-api-v4';

// Only cache assets that are guaranteed to exist as static files.
// NOTE: Next.js hashes CSS/JS at build time — never list hashed assets here.
const STATIC_ASSETS = [
  '/',
  '/icon.svg',
  '/apple-icon.png'
];

// Install event - cache static resources individually (fail-safe)
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use individual adds wrapped in try-catch so a single 404
      // doesn't abort the entire SW installation.
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Could not cache ${asset}:`, err.message);
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Deliberately NOT calling self.clients.claim() here. Claiming immediately
  // hands control of the page that triggered this install to the SW mid-load,
  // right as the app's own initial fetches (conversations/session/settings)
  // are firing — those in-flight requests get disrupted by the sudden control
  // change and fail with "TypeError: Failed to fetch". Not claiming means the
  // SW simply controls the NEXT navigation instead, which is fine for this
  // app's caching needs and avoids the race entirely.
});

// Fetch event - handle caching and offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NEVER let the SW touch auth or RSC/data navigation payloads. These are a
  // `fetch` with destination 'empty', so without this early return they fell
  // through to the cache-first branch at the bottom — which cached
  // /api/auth/session and then served the STALE (often logged-out) copy on
  // every reload, logging the user out until they cleared their cache. Let
  // them hit the network directly, with cookies, always fresh.
  if (
    url.pathname.startsWith('/api/auth/') ||
    request.headers.get('RSC') === '1' ||
    url.search.includes('_rsc=')
  ) {
    return; // no respondWith → default browser network fetch
  }

  // Handle API requests (exclude next-auth to prevent auth loops or stale session caches)
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return fetch(request).then((response) => {
          // Cache successful GET requests
          if (request.method === 'GET' && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => {
          // Return cached version if available
          return cache.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return offline response for API calls
            return new Response(JSON.stringify({ error: 'Offline', message: 'Content not available offline' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        });
      })
    );
  } else if (
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    // Network-first for anything that determines "which version of the app
    // is running" (HTML shell + hashed JS/CSS). Cache is an offline
    // fallback only — never the source of truth while online. This is what
    // cache-first got wrong: a deploy's new HTML references new chunk
    // hashes, but cache-first kept serving the old HTML forever, which then
    // requested chunks that no longer existed on the new deployment.
    event.respondWith(
      fetch(request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      }).catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (request.mode === 'navigate') {
            return caches.match('/').then((cached) => cached || new Response('Offline - Content not available', { status: 503 }));
          }
        });
      })
    );
  } else {
    // Cache-first for images/fonts/etc — staleness doesn't affect which
    // version of the app is running, so prefer offline resilience here.
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push received:', event);

  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body || 'You have a new notification from Novo',
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.id || 1,
      type: data.type || 'general',
      ...data
    },
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    tag: data.tag || 'novo-notification'
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Novo', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);

  event.notification.close();

  const notificationData = event.notification.data;
  const action = event.action;

  // Handle different actions
  if (action === 'view') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (action === 'dismiss') {
    // Just close the notification (already done above)
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (let client of windowClients) {
          if (client.url.includes('/') && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle background sync for scheduling notifications
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'schedule-notifications') {
    event.waitUntil(scheduleNotifications());
  }
});

// Function to schedule notifications
async function scheduleNotifications() {
  try {
    // Get stored notification schedules from IndexedDB or similar
    // For now, we'll implement this in the main app
    console.log('Scheduling notifications...');
  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Message received in SW:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    // Handle scheduling a specific notification
    const { title, body, delay, data } = event.data;

    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        data
      });
    }, delay);
  }
});