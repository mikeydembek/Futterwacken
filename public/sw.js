// Service Worker with Notification Support
const CACHE_NAME = 'video-learning-v2'; // Consider updating this to v3 to force an update

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache essential assets
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json'
        // Add other core assets here if needed, like your main JS/CSS bundles
      ]);
    })
  );
  self.skipWaiting(); // Activate the new service worker immediately
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match the current version
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // Take control of all clients immediately
});

// Fetch event (serves from cache first, then network)
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((response) => {
      // If we have a cached response, return it
      if (response) {
        return response;
      }
      // Otherwise, fetch from the network
      return fetch(event.request);
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked.', event);
  event.notification.close();
  
  // Handle action buttons
  if (event.action === 'open' || event.action === '') {
    // This action opens the app and focuses it
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Check if the app window is already open
        for (const client of clientList) {
          // Use a more robust check for the URL
          if (new URL(client.url).pathname === '/' && 'focus' in client) {
            console.log('Service Worker: Focusing existing client.');
            return client.focus();
          }
        }
        // If not open, open a new window
        if (clients.openWindow) {
          console.log('Service Worker: Opening new window.');
          return clients.openWindow('/');
        }
      })
    );
  } else if (event.action === 'later') {
    // This action snoozes the notification for 1 hour
    console.log('Service Worker: Snoozing notification for 1 hour.');
    
    // THE FIX IS HERE: The snoozed notification is now text-only
    setTimeout(() => {
      self.registration.showNotification('Reminder', { // Removed emoji
        body: 'You still have videos to review today!', // Text-only body
        icon: '/notification-icon.png', // Uses your custom icon
        badge: '/notification-icon.png',
        tag: 'video-reminder-snooze' // Use a different tag for the snoozed one
      });
    }, 3600000); // 1 hour in milliseconds
  }
});

// Background sync for checking reminders
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync event triggered:', event.tag);
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkAndNotify());
  }
});

// Function to check reminders and show notification
async function checkAndNotify() {
  console.log('Service Worker: checkAndNotify triggered by background sync.');
  // The service worker can't directly access localStorage.
  // It sends a message to any open client (app window) to perform the check.
  const allClients = await self.clients.matchAll({ includeUncontrolled: true });
  if (allClients.length > 0) {
    // Send a message to the first available client
    allClients[0].postMessage({ type: 'check-reminders' });
    console.log('Service Worker: Sent "check-reminders" message to a client.');
  } else {
    // This is a limitation. If no window is open, this background sync can't fetch data.
    // A full offline solution would require moving data to IndexedDB.
    console.log('Service Worker: No clients found to perform reminder check.');
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('Service Worker: Periodic sync event triggered:', event.tag);
  if (event.tag === 'check-reminders-daily') {
    event.waitUntil(checkAndNotify());
  }
});