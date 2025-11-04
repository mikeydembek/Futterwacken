class NotificationManager {
  constructor() {
    this.permission = 'default';
    if (typeof Notification !== 'undefined') {
      this.permission = Notification.permission;
    }
    this.settings = this.loadSettings();

    // Foreground scheduling handles
    this.dailyTimeoutId = null;     // precise one-shot timer to the target time
    this.heartbeatIntervalId = null; // lightweight safety heartbeat
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

    // Re-schedule when time or enabled changes
    this.scheduleDailyCheck();
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

      const maybePromise = Notification.requestPermission(function(permission) {
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

  // Precise, foreground-safe scheduler to fire at the user's chosen time
  scheduleDailyCheck() {
    // Clear previous timers
    if (this.dailyTimeoutId) {
      clearTimeout(this.dailyTimeoutId);
      this.dailyTimeoutId = null;
    }
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    if (!this.settings.enabled || this.permission !== 'granted') {
      console.log('Daily check not scheduled - notifications disabled or not permitted');
      return;
    }

    // Immediately sync videos to SW and run a check (useful when user opens app)
    this.syncVideosToServiceWorker();
    // Do not set lastNotificationDate here; only after a real notification is shown
    this.checkNotificationTime(); // may trigger if already near time

    // Compute next fire delay
    const delay = this._millisUntilTodayTime(this.settings.time);
    console.log('Scheduling next foreground reminder in ms:', delay);

    // One-shot precise timer to the next target time (foreground)
    this.dailyTimeoutId = setTimeout(async () => {
      const shown = await this._checkAndMarkIfShown();
      // Always schedule the next day's precise timer after this
      this.scheduleDailyCheck();
    }, delay);

    // Lightweight heartbeat every 15 minutes to keep SW data fresh and catch edge cases
    this.heartbeatIntervalId = setInterval(() => {
      this.syncVideosToServiceWorker();
      // If we're inside a short window around the target time, perform an extra check
      this.checkNotificationTime();
    }, 15 * 60 * 1000);
  }

  // Calculate ms until today's target time; if past, schedule for tomorrow
  _millisUntilTodayTime(hhmm) {
    const parts = (hhmm || '09:00').split(':');
    const hours = parseInt(parts[0], 10) || 9;
    const minutes = parseInt(parts[1], 10) || 0;

    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    let delta = target.getTime() - now.getTime();
    if (delta <= 0) {
      // schedule for tomorrow
      target.setDate(target.getDate() + 1);
      delta = target.getTime() - now.getTime();
    }
    // Safety clamp
    if (delta < 1000) delta = 1000;
    return delta;
  }

  // Only set lastNotificationDate after a real notification is shown
  async _checkAndMarkIfShown() {
    const shown = await this.checkForNotifications(true); // "strict" path
    if (shown) {
      const today = new Date().toDateString();
      localStorage.setItem('lastNotificationDate', today);
    }
    return shown;
  }

  // Sync videos to Service Worker for background checks
  async syncVideosToServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.ready;
      const mod = await import('../stores/videoStore');
      const videoStore = mod.videoStore;

      const serializableVideos = (videoStore.videos || []).map(function(video) {
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
          isActive: (video.isActive !== undefined) ? video.isActive : true
        };
      });

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

  // Keeps the legacy "window" behavior: check inside a short window
  checkNotificationTime() {
    if (!this.settings.enabled || this.permission !== 'granted') return;

    const now = new Date();
    const parts = (this.settings.time || '09:00').split(':');
    const hours = parseInt(parts[0], 10) || 9;
    const minutes = parseInt(parts[1], 10) || 0;

    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    const timeDiff = Math.abs(now.getTime() - target.getTime());

    // Tighten the window to 10 minutes to reduce premature "checked" logic
    if (timeDiff <= 10 * 60 * 1000) {
      const lastCheck = localStorage.getItem('lastNotificationDate');
      const today = new Date().toDateString();

      if (lastCheck !== today) {
        // Only mark lastNotificationDate if a notification is actually shown (handled in _checkAndMarkIfShown)
        this._checkAndMarkIfShown();
      }
    }
  }

  // Show a notification if there are pending reminders
  // Returns true if a notification was actually displayed
  async checkForNotifications(strictReturnBoolean) {
    try {
      const mod = await import('../stores/videoStore');
      const videoStore = mod.videoStore;

      if (!videoStore.videos || videoStore.videos.length === 0) {
        await videoStore.loadVideos();
      }

      const todaysReminders = videoStore.getTodaysReminders();
      const pendingReminders = todaysReminders.filter(function(video) {
        return video.currentReminder && !video.currentReminder.completed;
      });

      if (pendingReminders.length > 0 && this.permission === 'granted') {
        const title = 'Futterwacken Reminder';
        const body = 'You have ' + pendingReminders.length + ' video' + (pendingReminders.length > 1 ? 's' : '') + ' to review today!';

        const isVisible = (typeof document !== 'undefined') && document.visibilityState === 'visible';

        if (isVisible) {
          // App in foreground: show via Notification API (no SW bounce)
          this.showNotification(title, body);
          return !!strictReturnBoolean || true;
        } else if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
              body: body,
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: 'futterwacken-reminder',
              requireInteraction: false,
              vibrate: this.settings.vibrate ? [200, 100, 200] : undefined,
              silent: !this.settings.sound
            });
            return !!strictReturnBoolean || true;
          } catch (e) {
            // Fallback to Notification API
            this.showNotification(title, body);
            return !!strictReturnBoolean || true;
          }
        } else {
          // Final fallback
          this.showNotification(title, body);
          return !!strictReturnBoolean || true;
        }
      }

      return !!strictReturnBoolean ? false : undefined;
    } catch (error) {
      console.error('Error checking for notifications:', error);
      return !!strictReturnBoolean ? false : undefined;
    }
  }

  showNotification(title, body, options) {
    if (this.permission !== 'granted') return null;

    const defaultOptions = {
      body: body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'futterwacken-notification',
      requireInteraction: false,
      silent: !this.settings.sound,
      vibrate: this.settings.vibrate ? [200, 100, 200] : undefined
    };

    try {
      const merged = options ? mergeObjects(defaultOptions, options) : defaultOptions;
      const notification = new Notification(title, merged);
      notification.onclick = function() {
        try { window.focus(); } catch (_) {}
        try { notification.close(); } catch (_) {}
      };
      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function(registration) {
          const merged = options ? mergeObjects(defaultOptions, options) : defaultOptions;
          registration.showNotification(title, mergeObjects(merged, { body: body }));
        });
      }
      return null;
    }

    // Simple shallow merge without Object.assign for legacy safety
    function mergeObjects(a, b) {
      const out = {};
      var k;
      for (k in a) { out[k] = a[k]; }
      for (k in b) { out[k] = b[k]; }
      return out;
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
          const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
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
    if (this.dailyTimeoutId) {
      clearTimeout(this.dailyTimeoutId);
      this.dailyTimeoutId = null;
    }
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }
}

const notificationManager = new NotificationManager();

// When the SW pings while app is open, run a check directly (foreground path)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'check-reminders') {
      notificationManager.checkForNotifications(true).then(function(shown) {
        if (shown) {
          const today = new Date().toDateString();
          localStorage.setItem('lastNotificationDate', today);
        }
      });
    }
  });
}

export { notificationManager };
export const requestNotificationPermission = () => notificationManager.requestPermission();
export const scheduleBackgroundSync = () => notificationManager.setupBackgroundSync();
export const testNotification = () => notificationManager.testNotification();
export const getNotificationPermission = () => notificationManager.getPermissionStatus();
export const updateNotificationPermission = () => notificationManager.updatePermissionStatus();