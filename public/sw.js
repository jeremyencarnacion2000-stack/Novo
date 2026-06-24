// Service Worker for Novo Offline Support

const CACHE_NAME = 'novo-v2';
const API_CACHE_NAME = 'novo-api-v2';

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
  self.clients.claim();
});

// Fetch event - handle caching and offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

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
  } else {
    // Handle static assets
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          // Cache static assets
          if (response.status === 200 && (request.destination === 'document' ||
              request.destination === 'script' ||
              request.destination === 'style' ||
              request.destination === 'image' ||
              request.destination === 'font')) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/').then((cachedResponse) => {
              return cachedResponse || new Response('Offline - Content not available', { status: 503 });
            });
          }
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