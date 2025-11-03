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
  console.log('Periodic sync triggered:', event.tag);
  if (event.tag === 'check-reminders-daily') {
    event.waitUntil(checkAndNotify());
  }
});

// One-time background sync fallback
self.addEventListener('sync', (event) => {
  console.log('Sync triggered:', event.tag);
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkAndNotify());
  }
});

// Function to check for reminders and show notification
async function checkAndNotify() {
  try {
    console.log('Checking for reminders...');
    
    // Get all clients (open tabs/windows)
    const allClients = await clients.matchAll({ type: 'window' });
    
    // If app is open, let it handle notifications
    if (allClients.length > 0) {
      // Send message to client to check
      allClients.forEach(client => {
        client.postMessage({ type: 'check-reminders' });
      });
      return;
    }
    
    // App is closed, we need to check ourselves
    // Get the last check time
    const lastCheckKey = 'lastNotificationDate';
    const today = new Date().toDateString();
    
    // Try to get data from IndexedDB (for last check)
    const lastCheck = await getFromIndexedDB(lastCheckKey);
    
    if (lastCheck === today) {
      console.log('Already checked today');
      return;
    }
    
    // Get videos from cache (we'll cache them when app is open)
    const cache = await caches.open('data-cache-v1');
    const cachedResponse = await cache.match('/api/videos');
    
    let videos = [];
    if (cachedResponse) {
      videos = await cachedResponse.json();
    } else {
      console.log('SW: No cached videos found at /api/videos');
    }
    
    // Check for today's pending reminders
    const todaysReminders = getTodaysReminders(videos);
    const pendingCount = todaysReminders.filter(r => !r.completed).length;
    
    if (pendingCount > 0) {
      await self.registration.showNotification('Futterwacken Reminder', {
        body: `You have ${pendingCount} video${pendingCount > 1 ? 's' : ''} to review today!`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'daily-reminder',
        requireInteraction: false,
        vibrate: [200, 100, 200],
        actions: [
          {
            action: 'open',
            title: 'Open App'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ],
        data: {
          dateOfArrival: Date.now(),
          pendingCount: pendingCount
        }
      });
      
      // Mark as checked
      await saveToIndexedDB(lastCheckKey, today);
    }
    
    console.log(`Notification check complete. Pending: ${pendingCount}`);
  } catch (error) {
    console.error('Error in checkAndNotify:', error);
  }
}

// Helper function to parse today's reminders
function getTodaysReminders(videos) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  
  const reminders = [];
  
  videos.forEach(video => {
    if (!video.isActive) return;
    
    if (video.reminders) {
      video.reminders.forEach(reminder => {
        const reminderDate = new Date(reminder.date);
        reminderDate.setHours(0, 0, 0, 0);
        
        if (reminderDate.getTime() === todayTime) {
          reminders.push({
            videoId: video.id,
            title: video.title,
            day: reminder.day,
            completed: reminder.completed
          });
        }
      });
    }
    
    // Check monthly reminders
    if (video.repeatMonthly) {
      const lastDate = new Date(video.repeatMonthly.lastDate);
      const nextMonthly = new Date(lastDate);
      nextMonthly.setMonth(nextMonthly.getMonth() + 1);
      nextMonthly.setHours(0, 0, 0, 0);
      
      if (nextMonthly.getTime() === todayTime) {
        reminders.push({
          videoId: video.id,
          title: video.title,
          day: 'Monthly',
          completed: false
        });
      }
    }
  });
  
  return reminders;
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
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

// Message event listener for communication with the app
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'CHECK_REMINDERS') {
    event.waitUntil(checkAndNotify());
  }
  
  // Cache videos data when sent from the app
  if (event.data && event.data.type === 'CACHE_VIDEOS') {
    event.waitUntil(
      caches.open('data-cache-v1').then(cache => {
        const response = new Response(JSON.stringify(event.data.videos), {
          headers: { 'Content-Type': 'application/json' }
        });
        return cache.put('/api/videos', response);
      })
    );
  }
});

// Helper functions for IndexedDB (for storing last check time)
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ServiceWorkerData', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data');
      }
    };
  });
}

async function saveToIndexedDB(key, value) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    store.put(value, key);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Error saving to IndexedDB:', error);
  }
}

async function getFromIndexedDB(key) {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['data'], 'readonly');
    const store = transaction.objectStore('data');
    const request = store.get(key);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error reading from IndexedDB:', error);
    return null;
  }
}