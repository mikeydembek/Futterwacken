const CACHE_NAME = 'futterwacken-v3';
const DB_NAME = 'FutterwackenVideoData';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

// --- SERVICE WORKER LIFECYCLE ---

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- NOTIFICATION AND SYNC LOGIC ---

// Fired when a periodic sync is triggered
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders-daily') {
    console.log('Service Worker: Periodic sync triggered.');
    event.waitUntil(checkAndNotify());
  }
});

// Fired when the notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).pathname === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});


// --- HELPER FUNCTIONS FOR THE SERVICE WORKER ---

// Main function to check and show notification
async function checkAndNotify() {
  console.log('Service Worker: Running background check for notifications...');
  try {
    const videos = await getAllVideosFromDB();
    const reminders = getTodaysReminders(videos);
    const pendingReminders = reminders.filter(r => !r.currentReminder.completed);

    if (pendingReminders.length > 0) {
      console.log(`Service Worker: Found ${pendingReminders.length} pending reminders. Showing notification.`);
      const title = `${pendingReminders.length} Video${pendingReminders.length > 1 ? 's' : ''} to Review Today`;
      const body = pendingReminders.slice(0, 3).map(r => r.title).join('\n') + 
                   (pendingReminders.length > 3 ? `\n...and ${pendingReminders.length - 3} more` : '');

      await self.registration.showNotification(title, {
        body: body,
        icon: '/notification-icon.png',
        badge: '/notification-icon.png',
        tag: 'video-reminder',
      });
    } else {
      console.log('Service Worker: No pending reminders for today.');
    }
  } catch (error) {
    console.error('Service Worker: Error during background check:', error);
  }
}

// Function to get videos directly from IndexedDB
function getAllVideosFromDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
      getAllRequest.onerror = (event) => reject(event.target.error);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

// Re-implementation of getTodaysReminders inside the service worker
function getTodaysReminders(videos) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reminders = [];
  videos.forEach(video => {
    if (!video.isActive) return;
    video.reminders?.forEach((reminder) => {
      const reminderDate = new Date(reminder.date);
      reminderDate.setHours(0, 0, 0, 0);
      if (reminderDate.getTime() === today.getTime()) {
        reminders.push({ ...video, currentReminder: reminder });
      }
    });
  });
  return reminders;
}