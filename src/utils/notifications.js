// Notification system for video reminders
class NotificationManager {
  constructor() {
    this.permission = Notification.permission || 'default'
    this.checkInterval = null
  }

  // Request notification permission
  async requestPermission() {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications')
      return false
    }

    // If already granted, return true
    if (this.permission === 'granted') {
      return true
    }

    // Request permission
    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      
      if (permission === 'granted') {
        // Show success notification
        this.showNotification('Notifications Enabled! 🎉', {
          body: "You'll receive reminders at 9 AM when you have videos to review.",
          icon: '/icons/icon-192.png'
        })
        return true
      }
      return false
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }

  // Show a notification
  showNotification(title, options = {}) {
    if (this.permission !== 'granted') {
      console.log('Notification permission not granted')
      return
    }

    // Default options
    const defaultOptions = {
      icon: '/notification-icon.png',
      badge: '/notification-icon.png',
      vibrate: [200, 100, 200],
      tag: 'video-reminder',
      requireInteraction: true, // Don't auto-dismiss
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'later', title: 'Remind Later' }
      ]
    }

    // Merge options
    const notificationOptions = { ...defaultOptions, ...options }

    // If service worker is available, use it
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, notificationOptions)
      })
    } else {
      // Fallback to regular notification
      new Notification(title, notificationOptions)
    }
  }

  // Check if we should show notifications
  checkForNotifications() {
    // Only check once per day and at the right time (existing logic)
    const now = new Date();
    const settings = this.getSettings();
    const [hour, minute] = settings.time.split(':').map(Number);
    const lastCheck = localStorage.getItem('lastNotificationCheck');
    const lastCheckDate = lastCheck ? new Date(lastCheck) : null;
  
    const hasCheckedToday = lastCheckDate && this.isSameDay(now, lastCheckDate);
    const isTimeForNotification = now.getHours() === hour && now.getMinutes() === minute;
  
    // Check if it's time and we haven't already sent one today
    if (!isTimeForNotification || hasCheckedToday) {
      // On app startup, we can check regardless of time if we haven't checked today
      if (!lastCheckDate || !this.isSameDay(now, lastCheckDate)) {
          // Find reminders without sending a notification, just to have the count ready
      } else {
          return; // Not time yet or already checked
      }
    }
  
    // Get today's reminders
    const videos = JSON.parse(localStorage.getItem('videos') || '[]');
    const todaysReminders = this.getTodaysReminders(videos).filter(r => !r.currentReminder.completed); // Only notify for PENDING videos
  
    if (todaysReminders.length > 0) {
      // --- THIS IS THE SECTION THAT IS CHANGING ---
  
      // 1. Title is now clean and text-only
      const title = `${todaysReminders.length} Video${todaysReminders.length > 1 ? 's' : ''} to Review Today`;
  
      // 2. Body is now a simple list of video titles, no icons/emojis
      const videoTitles = todaysReminders.slice(0, 3).map(r => r.title).join('\n');
      const body = videoTitles + (todaysReminders.length > 3 ? `\n...and ${todaysReminders.length - 3} more` : '');
  
      // 3. Show the notification
      this.showNotification(title, {
        body: body,
        data: { 
          url: '/', 
          tab: 'today',
          count: todaysReminders.length 
        }
      });
    }

    // Update last check time
    localStorage.setItem('lastNotificationCheck', now.toISOString());
  }

  // Get today's reminders (similar to store logic)
  getTodaysReminders(videos) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const reminders = []
    
    videos.forEach(video => {
      if (!video.isActive) return
      
      video.reminders?.forEach((reminder, index) => {
        if (reminder.completed) return
        
        const reminderDate = new Date(reminder.date)
        reminderDate.setHours(0, 0, 0, 0)
        
        if (reminderDate.getTime() === today.getTime()) {
          reminders.push({
            ...video,
            currentReminder: reminder,
            reminderIndex: index
          })
        }
      })
    })
    
    return reminders
  }

  // Schedule daily notification check
  scheduleDailyCheck() {
    // Clear any existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    // Function to check if it's 9 AM
    const checkTime = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      
      // Check at 9:00 AM
      if (hours === 9 && minutes === 0) {
        this.checkForNotifications()
      }
      
      // Also check on app startup
      const lastCheck = localStorage.getItem('lastNotificationCheck')
      if (!lastCheck) {
        this.checkForNotifications()
      }
    }

    // Check immediately
    checkTime()

    // Then check every minute
    this.checkInterval = setInterval(checkTime, 60000) // Check every minute
  }

  // Setup background sync for notifications
  async setupBackgroundSync() {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      console.log('Background sync not supported')
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      await registration.sync.register('check-reminders')
      console.log('Background sync registered')
    } catch (error) {
      console.error('Background sync registration failed:', error)
    }
  }

  // Helper function to check if two dates are the same day
  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate()
  }

  // Get notification settings
  getSettings() {
    const settings = localStorage.getItem('notificationSettings')
    return settings ? JSON.parse(settings) : {
      enabled: true,
      time: '09:00',
      sound: true,
      vibrate: true
    }
  }

  // Save notification settings
  saveSettings(settings) {
    localStorage.setItem('notificationSettings', JSON.stringify(settings))
  }

  // Test notification
  testNotification() {
    this.showNotification('Test Notification 🔔', {
      body: 'Notifications are working! You\'ll be reminded at 9 AM when you have videos to review.',
      requireInteraction: false
    })
  }
}

// Create and export singleton instance
export const notificationManager = new NotificationManager()
