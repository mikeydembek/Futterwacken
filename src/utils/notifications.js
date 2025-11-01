class NotificationManager {
  constructor() {
    this.permission = 'default';
    if (typeof Notification !== 'undefined') {
      this.permission = Notification.permission;
    }
    this.settings = this.loadSettings();
    this.dailyCheckInterval = null;
  }

  // Load settings from localStorage
  loadSettings() {
    const stored = localStorage.getItem('notificationSettings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse notification settings:', e);
      }
    }
    // Default settings
    return {
      enabled: true,
      time: '09:00',
      sound: true,
      vibrate: true
    };
  }

  // Save settings to localStorage
  saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
  }

  // Get current settings
  getSettings() {
    return this.settings;
  }

   // Request notification permission (supports both Promise and callback forms for iOS)
   async requestPermission() {
    if (typeof Notification === 'undefined') {
      console.log('Notifications not supported');
      return 'denied';
    }

    try {
      let result = null;

      // Some versions of iOS Safari implement a callback instead of a Promise.
      const maybePromise = Notification.requestPermission((permission) => {
        // Callback form (older Safari/iOS)
        result = permission;
      });

      if (maybePromise && typeof maybePromise.then === 'function') {
        // Modern browsers return a Promise
        result = await maybePromise;
      } else if (!result) {
        // Fallback: read current state if callback didn’t fire synchronously
        result = Notification.permission;
      }

      this.permission = result || 'default';
      console.log('Notification permission:', this.permission);
      return this.permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  // Schedule daily check for notifications
  scheduleDailyCheck() {
    // Clear any existing interval
    if (this.dailyCheckInterval) {
      clearInterval(this.dailyCheckInterval);
    }

    // Check if notifications are enabled and permitted
    if (!this.settings.enabled || this.permission !== 'granted') {
      console.log('Daily check not scheduled - notifications disabled or not permitted');
      return;
    }

    // Sync video data to Service Worker
    this.syncVideosToServiceWorker();

    // Check immediately on startup
    this.checkForNotifications();

    // Then check every 30 minutes to see if it's time for the daily notification
    this.dailyCheckInterval = setInterval(() => {
      this.checkNotificationTime();
      // Also sync data periodically
      this.syncVideosToServiceWorker();
    }, 30 * 60 * 1000); // Check every 30 minutes

    console.log('Daily notification check scheduled');
  }

  // Sync videos to Service Worker for background checks
  async syncVideosToServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const { videoStore } = await import('../stores/videoStore');
      
      // Create a clean, serializable copy of videos data
      const serializableVideos = videoStore.videos.map(video => {
        return {
          id: video.id,
          title: video.title,
          url: video.url || '',
          notes: video.notes || '',
          isFileUpload: video.isFileUpload || false,
          fileName: video.fileName || null,
          fileSize: video.fileSize || null,
          fileType: video.fileType || null,
          dateAdded: video.dateAdded,
          reminders: video.reminders || [],
          repeatMonthly: video.repeatMonthly || null,
          isActive: video.isActive !== undefined ? video.isActive : true
        };
      });
      
      // Send videos data to Service Worker to cache
      if (registration.active) {
        // Convert to JSON string first to ensure it's serializable
        const message = {
          type: 'CACHE_VIDEOS',
          videos: JSON.parse(JSON.stringify(serializableVideos))
        };
        
        registration.active.postMessage(message);
        console.log('Synced videos to Service Worker');
      }
    } catch (error) {
      console.error('Error syncing to Service Worker:', error);
    }
  }

  // Check if it's time to show notification
  checkNotificationTime() {
    if (!this.settings.enabled || this.permission !== 'granted') {
      return;
    }

    const now = new Date();
    const [hours, minutes] = this.settings.time.split(':').map(Number);
    
    // Check if we're within the notification window (within 30 minutes of set time)
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);
    const timeDiff = Math.abs(now - targetTime);
    
    if (timeDiff < 30 * 60 * 1000) { // Within 30 minutes
      const lastCheck = localStorage.getItem('lastNotificationDate');
      const today = new Date().toDateString();
      
      // Only notify once per day
      if (lastCheck !== today) {
        this.checkForNotifications();
        localStorage.setItem('lastNotificationDate', today);
      }
    }
  }

  // Check for pending reminders and show notification
  async checkForNotifications() {
    try {
      // Dynamically import to avoid circular dependency
      const { videoStore } = await import('../stores/videoStore');
      
      // Make sure videos are loaded
      if (!videoStore.videos || videoStore.videos.length === 0) {
        await videoStore.loadVideos();
      }
      
      const todaysReminders = videoStore.getTodaysReminders();
      const pendingReminders = todaysReminders.filter(video => {
        return video.currentReminder && !video.currentReminder.completed;
      });

      if (pendingReminders.length > 0 && this.permission === 'granted') {
        // If we have a service worker, ask it to show the notification
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'CHECK_REMINDERS'
          });
        } else {
          // Fallback to regular notification
          this.showNotification(
            'Futterwacken Reminder',
            `You have ${pendingReminders.length} video${pendingReminders.length > 1 ? 's' : ''} to review today!`
          );
        }
      }
    } catch (error) {
      console.error('Error checking for notifications:', error);
    }
  }

  // Show a notification
  showNotification(title, body, options = {}) {
    if (this.permission !== 'granted') {
      console.log('Cannot show notification - permission not granted');
      return null;
    }

    const defaultOptions = {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'futterwacken-notification',
      requireInteraction: false,
      silent: !this.settings.sound,
      vibrate: this.settings.vibrate ? [200, 100, 200] : undefined
    };

    try {
      const notification = new Notification(title, { ...defaultOptions, ...options });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      
      // Fallback to service worker notification if available
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, { ...defaultOptions, ...options, body });
        });
      }
      return null;
    }
  }

  // Test notification
  async testNotification() {
    if (this.permission !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        alert('Please enable notifications in your browser settings to receive reminders.');
        return false;
      }
    }

    try {
      // Try service worker notification first for better reliability
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.showNotification) {
          await registration.showNotification('Test Notification 🎉', {
            body: 'Great! You\'ll receive daily reminders at your set time, even when the app is closed.',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'test-notification',
            requireInteraction: false,
            vibrate: [200, 100, 200],
            actions: [
              { action: 'close', title: 'Got it!' }
            ]
          });
          console.log('Test notification sent via Service Worker');
          return true;
        }
      }
      
      // Fallback to regular notification
      this.showNotification(
        'Test Notification 🎉',
        'Notifications are working! Install the app for background reminders.',
        { tag: 'test-notification' }
      );
      console.log('Test notification sent via Notification API');
      return true;
    } catch (error) {
      console.error('Error showing test notification:', error);
      alert('Could not show notification. Please check your browser settings.');
      return false;
    }
  }

  // Setup background sync
  async setupBackgroundSync() {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Sync videos first
      await this.syncVideosToServiceWorker();
      
      // Check if periodic background sync is supported
      if ('periodicSync' in registration) {
        try {
          // First check if we have permission
          const status = await navigator.permissions.query({
            name: 'periodic-background-sync'
          });
          
          console.log('Periodic background sync permission:', status.state);
          
          if (status.state === 'granted') {
            // Register periodic sync with the user's preferred time
            await registration.periodicSync.register('check-reminders-daily', {
              minInterval: 12 * 60 * 60 * 1000 // 12 hours minimum
            });
            console.log('✅ Periodic background sync registered successfully');
            return true;
          } else if (status.state === 'prompt') {
            // Try to register anyway - might prompt user
            try {
              await registration.periodicSync.register('check-reminders-daily', {
                minInterval: 12 * 60 * 60 * 1000
              });
              console.log('✅ Periodic background sync registered after prompt');
              return true;
            } catch (e) {
              console.log('📱 Install the app to enable background notifications');
            }
          } else {
            console.log('❌ Background sync permission denied - install the app and grant permissions');
          }
        } catch (permError) {
          console.log('⚠️ Periodic background sync not available:', permError.message);
          console.log('💡 This browser may not support background notifications');
        }
      } else {
        console.log('⚠️ Periodic background sync not supported on this browser');
        
        // Fallback: use regular sync if available
        if ('sync' in registration) {
          try {
            await registration.sync.register('check-reminders');
            console.log('✅ One-time background sync registered as fallback');
            return true;
          } catch (e) {
            console.log('❌ Background sync registration failed:', e.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error setting up background sync:', error);
    }
    
    console.log('📱 For background notifications: Install the app to your home screen');
    return false;
  }

  // Get permission status
  getPermissionStatus() {
    return this.permission;
  }

  // Update permission status
  async updatePermissionStatus() {
    if (typeof Notification !== 'undefined') {
      this.permission = Notification.permission;
    }
    return this.permission;
  }

  // Clean up
  destroy() {
    if (this.dailyCheckInterval) {
      clearInterval(this.dailyCheckInterval);
      this.dailyCheckInterval = null;
    }
  }
}

// Create a singleton instance
const notificationManager = new NotificationManager();

// Listen for messages from Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'check-reminders') {
      notificationManager.checkForNotifications();
    }
  });
}

// Export the manager instance and methods
export { notificationManager };

// Also export individual functions for backward compatibility
export const requestNotificationPermission = () => notificationManager.requestPermission();
export const scheduleBackgroundSync = () => notificationManager.setupBackgroundSync();
export const testNotification = () => notificationManager.testNotification();
export const getNotificationPermission = () => notificationManager.getPermissionStatus();
export const updateNotificationPermission = () => notificationManager.updatePermissionStatus();