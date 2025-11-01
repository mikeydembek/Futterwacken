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

  // Request notification permission
  async requestPermission() {
    if (typeof Notification === 'undefined') {
      console.log('Notifications not supported');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      console.log('Notification permission:', permission);
      return permission;
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

    // Check immediately on startup
    this.checkForNotifications();

    // Then check every hour to see if it's time for the daily notification
    this.dailyCheckInterval = setInterval(() => {
      this.checkNotificationTime();
    }, 60 * 60 * 1000); // Check every hour

    console.log('Daily notification check scheduled');
  }

  // Check if it's time to show notification
  checkNotificationTime() {
    if (!this.settings.enabled || this.permission !== 'granted') {
      return;
    }

    const now = new Date();
    const [hours, minutes] = this.settings.time.split(':').map(Number);
    
    // Check if we're within the notification hour
    if (now.getHours() === hours) {
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
        const today = new Date().toDateString();
        const todayReminder = video.reminders && video.reminders.find(
          r => r.date === today
        );
        return todayReminder && !todayReminder.watched;
      });

      if (pendingReminders.length > 0 && this.permission === 'granted') {
        this.showNotification(
          'Futterwacken Reminder',
          `You have ${pendingReminders.length} video${pendingReminders.length > 1 ? 's' : ''} to review today!`
        );
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

    const notification = new Notification(title, { ...defaultOptions, ...options });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  }

  // Test notification
  async testNotification() {
    if (this.permission !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return false;
      }
    }

    try {
      this.showNotification(
        'Test Notification',
        'Notifications are working correctly!',
        { tag: 'test-notification' }
      );
      return true;
    } catch (error) {
      console.error('Error showing test notification:', error);
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
      
      // Check if periodic background sync is supported
      if ('periodicSync' in registration) {
        try {
          const status = await navigator.permissions.query({
            name: 'periodic-background-sync'
          });
          
          if (status.state === 'granted') {
            await registration.periodicSync.register('check-reminders-daily', {
              minInterval: 12 * 60 * 60 * 1000 // 12 hours
            });
            console.log('Periodic background sync registered');
            return true;
          } else {
            console.log('Periodic background sync permission not granted');
          }
        } catch (permError) {
          console.log('Periodic background sync not available:', permError.message);
        }
      } else {
        console.log('Periodic background sync not supported');
        
        // Fallback: use regular sync if available
        if ('sync' in registration) {
          await registration.sync.register('check-reminders');
          console.log('One-time background sync registered');
          return true;
        }
      }
    } catch (error) {
      console.error('Error setting up background sync:', error);
    }
    
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

// Export the manager instance and methods
export { notificationManager };

// Also export individual functions for backward compatibility
export const requestNotificationPermission = () => notificationManager.requestPermission();
export const scheduleBackgroundSync = () => notificationManager.setupBackgroundSync();
export const testNotification = () => notificationManager.testNotification();
export const getNotificationPermission = () => notificationManager.getPermissionStatus();
export const updateNotificationPermission = () => notificationManager.updatePermissionStatus();