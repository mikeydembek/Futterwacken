class NotificationManager {
  constructor() {
    this.permission = 'default';
    if (typeof Notification !== 'undefined') {
      this.permission = Notification.permission;
    }
    this.settings = this.loadSettings();
    this.dailyCheckInterval = null;
  }

  loadSettings() {
    const stored = localStorage.getItem('notificationSettings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse notification settings:', e);
      }
    }
    return {
      enabled: true,
      time: '09:00',
      sound: true,
      vibrate: true
    };
  }

  saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
  }

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
      const maybePromise = Notification.requestPermission((permission) => {
        result = permission;
      });

      if (maybePromise && typeof maybePromise.then === 'function') {
        result = await maybePromise;
      } else if (!result) {
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

  scheduleDailyCheck() {
    if (this.dailyCheckInterval) {
      clearInterval(this.dailyCheckInterval);
    }

    if (!this.settings.enabled || this.permission !== 'granted') {
      console.log('Daily check not scheduled - notifications disabled or not permitted');
      return;
    }

    this.syncVideosToServiceWorker();
    this.checkForNotifications();

    this.dailyCheckInterval = setInterval(() => {
      this.checkNotificationTime();
      this.syncVideosToServiceWorker();
    }, 30 * 60 * 1000);

    console.log('Daily notification check scheduled');
  }

  async syncVideosToServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.ready;
      const { videoStore } = await import('../stores/videoStore');

      const serializableVideos = videoStore.videos.map(video => ({
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
      }));

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CACHE_VIDEOS',
          videos: JSON.parse(JSON.stringify(serializableVideos))
        });
        console.log('Synced videos to Service Worker');
      }
    } catch (error) {
      console.error('Error syncing to Service Worker:', error);
    }
  }

  checkNotificationTime() {
    if (!this.settings.enabled || this.permission !== 'granted') return;

    const now = new Date();
    const [hours, minutes] = this.settings.time.split(':').map(Number);

    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);
    const timeDiff = Math.abs(now - targetTime);

    if (timeDiff < 30 * 60 * 1000) {
      const lastCheck = localStorage.getItem('lastNotificationDate');
      const today = new Date().toDateString();

      if (lastCheck !== today) {
        this.checkForNotifications();
        localStorage.setItem('lastNotificationDate', today);
      }
    }
  }

  // UPDATED: Show directly when visible; SW only when not visible
  async checkForNotifications() {
    try {
      const { videoStore } = await import('../stores/videoStore');

      if (!videoStore.videos || videoStore.videos.length === 0) {
        await videoStore.loadVideos();
      }

      const todaysReminders = videoStore.getTodaysReminders();
      const pendingReminders = todaysReminders.filter(video => {
        return video.currentReminder && !video.currentReminder.completed;
      });

      if (pendingReminders.length > 0 && this.permission === 'granted') {
        const title = 'Futterwacken Reminder';
        const body = `You have ${pendingReminders.length} video${pendingReminders.length > 1 ? 's' : ''} to review today!`;

        const isVisible = (typeof document !== 'undefined') && document.visibilityState === 'visible';

        if (isVisible) {
          // App in foreground: show via Notification API (no SW bounce)
          this.showNotification(title, body);
        } else if ('serviceWorker' in navigator) {
          // App not visible: ask SW registration to show
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
              body,
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: 'futterwacken-reminder',
              requireInteraction: false,
              vibrate: this.settings.vibrate ? [200, 100, 200] : undefined,
              silent: !this.settings.sound
            });
          } catch (e) {
            // Fallback to Notification API
            this.showNotification(title, body);
          }
        } else {
          // Final fallback
          this.showNotification(title, body);
        }
      }
    } catch (error) {
      console.error('Error checking for notifications:', error);
    }
  }

  showNotification(title, body, options = {}) {
    if (this.permission !== 'granted') return null;

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
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, { ...defaultOptions, ...options, body });
        });
      }
      return null;
    }
  }

  async testNotification() {
    if (this.permission !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        alert('Please enable notifications in your browser settings to receive reminders.');
        return false;
      }
    }

    try {
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
            actions: [{ action: 'close', title: 'Got it!' }]
          });
          console.log('Test notification sent via Service Worker');
          return true;
        }
      }
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

  async setupBackgroundSync() {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await this.syncVideosToServiceWorker();

      if ('periodicSync' in registration) {
        try {
          const status = await navigator.permissions.query({
            name: 'periodic-background-sync'
          });
          
          console.log('Periodic background sync permission:', status.state);
          
          if (status.state === 'granted') {
            await registration.periodicSync.register('check-reminders-daily', {
              minInterval: 12 * 60 * 60 * 1000
            });
            console.log('✅ Periodic background sync registered successfully');
            return true;
          } else if (status.state === 'prompt') {
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

  getPermissionStatus() {
    return this.permission;
  }

  async updatePermissionStatus() {
    if (typeof Notification !== 'undefined') {
      this.permission = Notification.permission;
    }
    return this.permission;
  }

  destroy() {
    if (this.dailyCheckInterval) {
      clearInterval(this.dailyCheckInterval);
      this.dailyCheckInterval = null;
    }
  }
}

const notificationManager = new NotificationManager();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'check-reminders') {
      // When SW pings while app is open, run a check and show directly if pending
      notificationManager.checkForNotifications();
    }
  });
}

export { notificationManager };
export const requestNotificationPermission = () => notificationManager.requestPermission();
export const scheduleBackgroundSync = () => notificationManager.setupBackgroundSync();
export const testNotification = () => notificationManager.testNotification();
export const getNotificationPermission = () => notificationManager.getPermissionStatus();
export const updateNotificationPermission = () => notificationManager.updatePermissionStatus();