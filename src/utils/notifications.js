// Notification system for video reminders
class NotificationManager {
  constructor() {
    this.permission = Notification.permission || 'default';
    this.checkInterval = null;
    // Bind methods
    Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(prop => prop !== 'constructor' && typeof this[prop] === 'function')
      .forEach(prop => this[prop] = this[prop].bind(this));
  }

  // Request notification permission
  async requestPermission() {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;

      if (permission === 'granted') {
        this.showNotification('Notifications Enabled', {
          body: "You'll now receive background reminders.",
          requireInteraction: false
        });
        
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          if (registration && 'periodicSync' in registration) {
            const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
            if (status.state === 'granted') {
              await registration.periodicSync.register('check-reminders-daily', {
                minInterval: 12 * 60 * 60 * 1000,
              });
              console.log('Periodic background sync registered.');
            }
          } else {
            console.log('Periodic background sync is not supported.');
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Show a notification
  showNotification(title, options = {}) {
    if (this.permission !== 'granted') return;
    const defaultOptions = {
      icon: '/notification-icon.png', badge: '/notification-icon.png',
      vibrate: [200, 100, 200], tag: 'video-reminder',
      requireInteraction: true,
      actions: [{ action: 'open', title: 'Open App' }, { action: 'later', title: 'Remind Later' }]
    };
    const notificationOptions = { ...defaultOptions, ...options };
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, notificationOptions));
    } else {
      new Notification(title, notificationOptions);
    }
  }

  // Check for notifications
  checkForNotifications() {
    const settings = this.getSettings();
    const [hour, minute] = settings.time.split(':').map(Number);
    const now = new Date();
    if (now.getHours() !== hour || now.getMinutes() !== minute) return;

    const lastCheck = localStorage.getItem('lastNotificationCheck');
    if (lastCheck && this.isSameDay(now, new Date(lastCheck))) return;

    const videos = JSON.parse(localStorage.getItem('videos') || '[]');
    const pending = this.getTodaysReminders(videos).filter(r => !r.currentReminder.completed);

    if (pending.length > 0) {
      const title = `${pending.length} Video${pending.length > 1 ? 's' : ''} to Review`;
      const body = pending.slice(0, 3).map(r => r.title).join('\n');
      this.showNotification(title, { body });
    }
    localStorage.setItem('lastNotificationCheck', now.toISOString());
  }

  // Get today's reminders
  getTodaysReminders(videos) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const reminders = [];
    videos.forEach(video => {
      if (!video.isActive) return;
      video.reminders?.forEach(reminder => {
        const rDate = new Date(reminder.date); rDate.setHours(0, 0, 0, 0);
        if (rDate.getTime() === today.getTime()) {
          reminders.push({ ...video, currentReminder: reminder });
        }
      });
    });
    return reminders;
  }

  // Schedule daily check
  scheduleDailyCheck() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    const check = () => this.checkForNotifications();
    check(); // Initial check
    this.checkInterval = setInterval(check, 60000);
  }

  // Setup background sync
  async setupBackgroundSync() {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('check-reminders');
    console.log('Background sync registered');
  }

  // Helper
  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  }

  // Settings
  getSettings() {
    const s = localStorage.getItem('notificationSettings');
    return s ? JSON.parse(s) : { enabled: true, time: '09:00', sound: true, vibrate: true };
  }
  saveSettings(s) {
    localStorage.setItem('notificationSettings', JSON.stringify(s));
  }

  // Test
  testNotification() {
    this.showNotification('Test Notification', {
      body: 'Notifications are working!', requireInteraction: false
    });
  }
}

export const notificationManager = new NotificationManager();