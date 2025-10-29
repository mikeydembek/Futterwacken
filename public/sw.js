// Service Worker with Notification Support
const CACHE_NAME = 'video-learning-v2'

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json'
      ])
    })
  )
  self.skipWaiting() // Activate immediately
})

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim() // Take control immediately
})

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    })
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  // Handle action buttons
  if (event.action === 'open' || event.action === '') {
    // Open the app and focus it
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus()
          }
        }
        // Open new window if not open
        if (clients.openWindow) {
          return clients.openWindow('/')
        }
      })
    )
  } else if (event.action === 'later') {
    // Snooze for 1 hour
    setTimeout(() => {
      self.registration.showNotification('Reminder 🔔', {
        body: 'You still have videos to review today!',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'video-reminder-snooze'
      })
    }, 3600000) // 1 hour
  }
})

// Background sync for checking reminders
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkAndNotify())
  }
})

// Function to check reminders and show notification
async function checkAndNotify() {
  // Get data from IndexedDB or localStorage via client
  const clients = await self.clients.matchAll()
  if (clients.length > 0) {
    clients[0].postMessage({ type: 'check-reminders' })
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders-daily') {
    event.waitUntil(checkAndNotify())
  }
})