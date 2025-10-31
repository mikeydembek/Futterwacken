// Notification system for video reminders
class NotificationManager {
  constructor() {
    this.permission = Notification.permission || 'default';
    this.checkInterval = null;
  }

  // Request notification permission
  async requestPermission() {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        // --- FIX #1: REMOVED EMOJI ---
        this.showNotification('Notifications Enabled', {
          body: "You'll now receive reminders at your chosen time.",
          icon: '/notification-icon.png', // Use your custom icon
          requireInteraction: false // Auto-dismiss this welcome notification
        });
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
    if (this.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    // Default options
    const defaultOptions = {
      icon: '/notification-icon.png',
      badge: '/notification-icon.png',
      vibrate: [200, 100, 200],
      tag: 'video-reminder',
      requireInteraction: true,
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'later', title: 'Remind Later' }
      ]
    };

    const notificationOptions = { ...defaultOptions, ...options };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, notificationOptions);
      });
    } else {
      new Notification(title, notificationOptions);
    }
  }

  // Check if we should show notifications
  checkForNotifications() {
    const now = new Date();
    const settings = this.getSettings();
    const [hour, minute] = settings.time.split(':').map(Number);
    const lastCheck = localStorage.getItem('lastNotificationCheck');
    const lastCheckDate = lastCheck ? new Date(lastCheck) : null;
  
    const hasCheckedToday = lastCheckDate && this.isSameDay(now, lastCheckDate);
    const isTimeForNotification = now.getHours() === hour && now.getMinutes() === minute;
  
    if ((!isTimeForNotification || hasCheckedToday) && (lastCheckDate && this.isSameDay(now, lastCheckDate))) {
        return;
    }
  
    const videos = JSON.parse(localStorage.getItem('videos') || '[]');
    const todaysReminders = this.getTodaysReminders(videos).filter(r => !r.currentReminder.completed);
  
    if (todaysReminders.length > 0) {
      // Title and body are already clean here, which is great.
      const title = `${todaysReminders.length} Video${todaysReminders.length > 1 ? 's' : ''} to Review Today`;
      const videoTitles = todaysReminders.slice(0, 3).map(r => r.title).join('\n');
      const body = videoTitles + (todaysReminders.length > 3 ? `\n...and ${todaysReminders.length - 3} more` : '');
  
      this.showNotification(title, {
        body: body,
        data: { 
          url: '/', 
          tab: 'today',
          count: todaysReminders.length 
        }
      });
    }

    localStorage.setItem('lastNotificationCheck', now.toISOString());
  }

  // Get today's reminders (similar to store logic)
  getTodaysReminders(videos) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const reminders = [];
    
    videos.forEach(video => {
      if (!video.isActive) return;
      
      video.reminders?.forEach((reminder) => {
        const reminderDate = new Date(reminder.date);
        reminderDate.setHours(0, 0, 0, 0);
        
        if (reminderDate.getTime() === today.getTime()) {
          reminders.push({
            ...video,
            currentReminder: reminder,
          });
        }
      });
    });
    
    return reminders;
  }

  // Schedule daily notification check
  scheduleDailyCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    const checkTime = () => {
      const now = new Date();
      const settings = this.getSettings();
      const [hour, minute] = settings.time.split(':').map(Number);
      
      if (now.getHours() === hour && now.getMinutes() === minute) {
        this.checkForNotifications();
      }
    };

    // Initial check on startup if needed
    const lastCheck = localStorage.getItem('lastNotificationCheck');
    if (!lastCheck || !this.isSameDay(new Date(), new Date(lastCheck))) {
        checkTime();
    }

    this.checkInterval = setInterval(checkTime, 60000);
  }

  // Setup background sync for notifications
  async setupBackgroundSync() {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      console.log('Background sync not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('check-reminders');
      console.log('Background sync registered');
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }

  // Helper function to check if two dates are the same day
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Get notification settings
  getSettings() {
    const settings = localStorage.getItem('notificationSettings');
    return settings ? JSON.parse(settings) : {
      enabled: true,
      time: '09:00',
      sound: true,
      vibrate: true
    };
  }

  // Save notification settings
  saveSettings(settings) {
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  }

  // Test notification
  testNotification() {
    // --- FIX #2: REMOVED EMOJI ---
    this.showNotification('Test Notification', {
      body: 'Notifications are working! You\'ll be reminded at your chosen time when you have videos to review.',
      requireInteraction: false
    });
  }
}

// Create and export singleton instance
export const notificationManager = new NotificationManager();