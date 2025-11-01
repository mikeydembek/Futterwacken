// Service Worker for Futterwacken
const CACHE_NAME = 'futterwacken-v1';
const urlsToCache = [
  '/',
  '/index.html'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Cache installation failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch((error) => {
        console.error('Fetch failed:', error);
      })
  );
});

// Periodic background sync for daily reminders
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders-daily') {
    event.waitUntil(checkAndNotify());
  }
});

// One-time background sync fallback
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkAndNotify());
  }
});

// Function to check for reminders and show notification
async function checkAndNotify() {
  try {
    // Check if we already showed a notification today
    const today = new Date().toDateString();
    
    // Open IndexedDB to get videos
    const db = await openDB();
    const videos = await getAllVideos(db);
    
    // Filter for today's reminders
    const todaysReminders = videos.filter(video => {
      if (!video.reminders) return false;
      return video.reminders.some(r => r.date === today);
    });
    
    // Filter for pending (unwatched) reminders
    const pendingReminders = todaysReminders.filter(video => {
      const todayReminder = video.reminders.find(r => r.date === today);
      return todayReminder && !todayReminder.watched;
    });
    
    if (pendingReminders.length > 0) {
      await self.registration.showNotification('Futterwacken Reminder', {
        body: `You have ${pendingReminders.length} video${pendingReminders.length > 1 ? 's' : ''} to review today!`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'daily-reminder',
        requireInteraction: false,
        actions: [
          {
            action: 'open',
            title: 'Open App'
          }
        ]
      });
    }
  } catch (error) {
    console.error('Error in checkAndNotify:', error);
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Helper function to open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FutterwackenVideoData', 1);
    
    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('videos')) {
        db.createObjectStore('videos', { keyPath: 'id' });
      }
    };
  });
}

// Helper function to get all videos from IndexedDB
function getAllVideos(db) {
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['videos'], 'readonly');
      const store = transaction.objectStore('videos');
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get videos'));
      };
    } catch (error) {
      reject(error);
    }
  });
}

// Message event listener for communication with the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_REMINDERS') {
    event.waitUntil(checkAndNotify());
  }
});