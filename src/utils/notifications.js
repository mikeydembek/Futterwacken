const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

class NotificationManager {
  constructor() {
    this.permission = 'default';
    if (typeof Notification !== 'undefined') {
      this.permission = Notification.permission;
    }
    this.settings = this.loadSettings();

    this.dailyTimeoutId = null;
    this.heartbeatIntervalId = null;
  }

  loadSettings() {
    const stored = localStorage.getItem('notificationSettings');
    if (stored) {
      try { return JSON.parse(stored); } catch (e) { console.error('Failed to parse notification settings:', e); }
    }
    return { enabled: true, time: '09:00', sound: true, vibrate: true };
  }

  saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem('notificationSettings', JSON.stringify(this.settings));
    this.scheduleDailyCheck();

    // NEW: if enabled & granted, update server with new time
    if (this.settings.enabled && this.permission === 'granted') {
      this.updateServerSettings(this.settings.time);
    }
  }

  getSettings() {
    return this.settings;
  }

  async requestPermission() {
    if (typeof Notification === 'undefined') return 'denied';
    try {
      let result = null;
      const maybePromise = Notification.requestPermission(function(permission) { result = permission; });
      if (maybePromise && typeof maybePromise.then === 'function') result = await maybePromise;
      else if (!result) result = Notification.permission;

      this.permission = result || 'default';
      console.log('Notification permission:', this.permission);

      // NEW: subscribe for push after permission granted and if enabled
      if (this.permission === 'granted' && this.settings.enabled) {
        await this.subscribeToPush(this.settings.time);
      }
      return this.permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  scheduleDailyCheck() {
    if (this.dailyTimeoutId) { clearTimeout(this.dailyTimeoutId); this.dailyTimeoutId = null; }
    if (this.heartbeatIntervalId) { clearInterval(this.heartbeatIntervalId); this.heartbeatIntervalId = null; }

    if (!this.settings.enabled || this.permission !== 'granted') {
      console.log('Daily check not scheduled - notifications disabled or not permitted');
      return;
    }

    this.syncVideosToServiceWorker();
    this.checkNotificationTime();

    const delay = this._millisUntilTodayTime(this.settings.time);
    console.log('Scheduling next foreground reminder in ms:', delay);

    this.dailyTimeoutId = setTimeout(async () => {
      const shown = await this._checkAndMarkIfShown();
      this.scheduleDailyCheck();
    }, delay);

    this.heartbeatIntervalId = setInterval(() => {
      this.syncVideosToServiceWorker();
      this.checkNotificationTime();
    }, 15 * 60 * 1000);
  }

  _millisUntilTodayTime(hhmm) {
    const parts = (hhmm || '09:00').split(':');
    const hours = parseInt(parts[0], 10) || 9;
    const minutes = parseInt(parts[1], 10) || 0;
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    let delta = target.getTime() - now.getTime();
    if (delta <= 0) { target.setDate(target.getDate() + 1); delta = target.getTime() - now.getTime(); }
    if (delta < 1000) delta = 1000;
    return delta;
  }

  async _checkAndMarkIfShown() {
    const shown = await this.checkForNotifications(true);
    if (shown) {
      const today = new Date().toDateString();
      localStorage.setItem('lastNotificationDate', today);
    }
    return shown;
  }

  async syncVideosToServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.ready;
      const mod = await import('../stores/videoStore');
      const videoStore = mod.videoStore;

      const serializableVideos = (videoStore.videos || []).map(function(video) {
        return {
          id: video.id, title: video.title, url: video.url || '', notes: video.notes || '',
          isFileUpload: video.isFileUpload || false, fileName: video.fileName || null,
          fileSize: video.fileSize || null, fileType: video.fileType || null,
          dateAdded: video.dateAdded, reminders: video.reminders || [],
          repeatMonthly: video.repeatMonthly || null, isActive: (video.isActive !== undefined) ? video.isActive : true
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

  checkNotificationTime() {
    if (!this.settings.enabled || this.permission !== 'granted') return;
    const now = new Date();
    const parts = (this.settings.time || '09:00').split(':');
    const hours = parseInt(parts[0], 10) || 9;
    const minutes = parseInt(parts[1], 10) || 0;
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    const timeDiff = Math.abs(now.getTime() - target.getTime());
    if (timeDiff <= 10 * 60 * 1000) {
      const lastCheck = localStorage.getItem('lastNotificationDate');
      const today = new Date().toDateString();
      if (lastCheck !== today) this._checkAndMarkIfShown();
    }
  }

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

        if (isVisible) { this.showNotification(title, body); return !!strictReturnBoolean || true; }
        else if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
              body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
              tag: 'futterwacken-reminder', requireInteraction: false,
              vibrate: this.settings.vibrate ? [200, 100, 200] : undefined,
              silent: !this.settings.sound
            });
            return !!strictReturnBoolean || true;
          } catch (_) {
            this.showNotification(title, body);
            return !!strictReturnBoolean || true;
          }
        } else {
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
      body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
      tag: 'futterwacken-notification', requireInteraction: false,
      silent: !this.settings.sound, vibrate: this.settings.vibrate ? [200, 100, 200] : undefined
    };
    function merge(a, b) { const out = {}; for (const k in a) out[k] = a[k]; for (const k in b || {}) out[k] = b[k]; return out; }
    try {
      const n = new Notification(title, merge(defaultOptions, options || {}));
      n.onclick = function(){ try{ window.focus(); }catch(_){} try{ n.close(); }catch(_){} };
      return n;
    } catch (error) {
      console.error('Error showing notification:', error);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, merge(defaultOptions, { body })));
      }
      return null;
    }
  }

  // ====== NEW: Web Push client helpers ======

  async subscribeToPush(hhmm) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push not supported'); return null;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';

      if (existing) {
        // Ensure server has latest settings
        await this.sendSubscriptionToServer(existing, tz, hhmm);
        localStorage.setItem('pushEndpoint', existing.endpoint);
        return existing;
      }

      if (!VAPID_PUBLIC_KEY) {
        console.warn('VAPID public key missing. Set VITE_VAPID_PUBLIC_KEY.');
        return null;
      }

      const appServerKey = this._urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey
      });

      await this.sendSubscriptionToServer(subscription, tz, hhmm);
      localStorage.setItem('pushEndpoint', subscription.endpoint);
      console.log('Subscribed to push');
      return subscription;
    } catch (e) {
      console.error('subscribeToPush error:', e);
      return null;
    }
  }

  async updateServerSettings(hhmm) {
    try {
      const endpoint = localStorage.getItem('pushEndpoint');
      if (!endpoint) return;
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';
      await fetch('/api/update-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, timezone: tz, hhmm })
      });
    } catch (e) {
      console.error('updateServerSettings error:', e);
    }
  }

  async unsubscribeFromPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      const endpoint = sub ? sub.endpoint : localStorage.getItem('pushEndpoint');
      if (sub) await sub.unsubscribe();
      if (endpoint) {
        await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint })
        }).catch(()=>{});
      }
      localStorage.removeItem('pushEndpoint');
      console.log('Unsubscribed from push');
    } catch (e) {
      console.error('unsubscribeFromPush error:', e);
    }
  }

  async sendSubscriptionToServer(subscription, timezone, hhmm) {
    try {
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          timezone,
          hhmm
        })
      });
    } catch (e) {
      console.error('sendSubscriptionToServer error:', e);
    }
  }

  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = typeof atob !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  // ====== keep existing exported methods below ======

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
      this.showNotification('Test Notification 🎉', 'Notifications are working! Install the app for background reminders.', { tag: 'test-notification' });
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
            await registration.periodicSync.register('check-reminders-daily', { minInterval: 12 * 60 * 60 * 1000 });
            console.log('✅ Periodic background sync registered successfully');
            return true;
          } else if (status.state === 'prompt') {
            try {
              await registration.periodicSync.register('check-reminders-daily', { minInterval: 12 * 60 * 60 * 1000 });
              console.log('✅ Periodic background sync registered after prompt');
              return true;
            } catch (_) {
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

  getPermissionStatus() { return this.permission; }
  async updatePermissionStatus() { if (typeof Notification !== 'undefined') { this.permission = Notification.permission; } return this.permission; }

  destroy() {
    if (this.dailyTimeoutId) { clearTimeout(this.dailyTimeoutId); this.dailyTimeoutId = null; }
    if (this.heartbeatIntervalId) { clearInterval(this.heartbeatIntervalId); this.heartbeatIntervalId = null; }
  }
}

const notificationManager = new NotificationManager();

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

// NEW: explicit exports (used by NotificationSettings)
export const subscribeToPush = (time) => notificationManager.subscribeToPush(time);
export const unsubscribeFromPush = () => notificationManager.unsubscribeFromPush();
export const updateServerSettings = (time) => notificationManager.updateServerSettings(time);