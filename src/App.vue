<template>
<!-- TEMPLATE REMAINS EXACTLY THE SAME -->
<div id="app">
  <!-- Header -->
  <header class="global-header">
    <div class="header-content">
      <HamburgerMenu @navigate="currentView = $event" />
    </div>
  </header>
  
  <!-- Main content area -->
  <main class="main-content">
    <AddVideo v-if="currentView === 'add'" />
    <TodayReminders v-else-if="currentView === 'today'" />
    <Calendar v-else-if="currentView === 'calendar'" />
    <NotificationSettings v-else-if="currentView === 'notifications'" />
    <DataManagement v-else-if="currentView === 'data'" />
    <AboutSection v-else-if="currentView === 'about'" />
  </main>
  
  <!-- Tab bar at bottom -->
  <TabBar 
    :active-tab="currentView" 
    @change-tab="currentView = $event"
  />
</div>
</template>

<script>
// Imports
import TabBar from './components/TabBar.vue';
import HamburgerMenu from './components/HamburgerMenu.vue';
import AddVideo from './views/AddVideo.vue';
import TodayReminders from './views/TodayReminders.vue';
import Calendar from './views/Calendar.vue';
import NotificationSettings from './components/NotificationSettings.vue';
import DataManagement from './components/DataManagement.vue';
import AboutSection from './components/AboutSection.vue';
import { notificationManager } from './utils/notifications';
import { videoStore } from './stores/videoStore';

export default {
name: 'App',
components: {
  TabBar,
  HamburgerMenu,
  AddVideo,
  TodayReminders,
  Calendar,
  NotificationSettings,
  DataManagement,
  AboutSection
},
data() {
  return {
    currentView: 'today'
  };
},
computed: {
  headerTitle() {
    const titles = {
      'add': 'Add New Video',
      'today': "Today's Reminders",
      'calendar': 'Calendar'
    };
    return titles[this.currentView] || 'Futterwacken';
  },
  headerSubtitle() {
    const subtitles = {
      'add': 'Add a video to your learning schedule',
      'today': this.getTodayDate(),
      'calendar': 'Your video review schedule'
    };
    return subtitles[this.currentView] || '';
  }
},
methods: {
  getTodayDate() {
    return new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  },
  async initializeNotifications() {
    if ('Notification' in window && Notification.permission === 'granted') {
      notificationManager.scheduleDailyCheck();
      notificationManager.setupBackgroundSync();
    }
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'check-reminders') {
          notificationManager.checkForNotifications();
        }
      });
    }
  },

  // Push current videos to the SW cache so background checks use fresh data
  async syncVideosToSW() {
    try {
      if (!('serviceWorker' in navigator)) return;
      await navigator.serviceWorker.ready;

      // Prepare a serializable snapshot of videos
      const serializable = (videoStore.videos || []).map(function(v) {
        return {
          id: v.id,
          title: v.title,
          url: v.url || '',
          notes: v.notes || '',
          isFileUpload: v.isFileUpload || false,
          fileName: v.fileName || null,
          fileSize: v.fileSize || null,
          fileType: v.fileType || null,
          dateAdded: v.dateAdded,
          reminders: v.reminders || [],
          repeatMonthly: v.repeatMonthly || null,
          isActive: (v.isActive !== undefined) ? v.isActive : true
        };
      });

      const active = navigator.serviceWorker.controller;
      if (active) {
        active.postMessage({
          type: 'CACHE_VIDEOS',
          videos: JSON.parse(JSON.stringify(serializable))
        });
      }
    } catch(e) {
      console.log('SW sync skipped:', e && e.message);
    }
  },

  // Run an immediate reminder check and sync when app comes to foreground
  async onForeground() {
    await this.syncVideosToSW();
    await notificationManager.checkForNotifications();
  },

  // Visibility handler to detect returning to app
  handleVisibility() {
    if (document.visibilityState === 'visible') {
      this.onForeground();
    }
  }
},
async mounted() {
  // iOS FIX: Await the loading of videos from storage
  await videoStore.loadVideos();
  
  // Register service worker (will fail on StackBlitz, works in production)
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    } catch (error) {
      console.log('Service Worker not available (expected on StackBlitz)');
    }
  }
  
  // Initialize notifications
  this.initializeNotifications();

  // Trigger reminder check and sync on app open
  this.onForeground();

  // Also re-check when returning to app
  window.addEventListener('focus', this.onForeground);
  document.addEventListener('visibilitychange', this.handleVisibility);
},
beforeUnmount() {
  window.removeEventListener('focus', this.onForeground);
  document.removeEventListener('visibilitychange', this.handleVisibility);
}
};
</script>

<style scoped>
#app {
height: 100vh;
display: flex;
flex-direction: column;
position: relative;
background: linear-gradient(
  to bottom,
  var(--bg-secondary) 0%,
  #1F2937 20%,
  #1F2937 100%
);
}

.global-header {
padding: var(--space-md);
background: #1F2937; /* CHANGED: From transparent to match app background */
border-bottom: none;
position: sticky;
top: 0;
z-index: 100;
min-height: 60px;
display: flex;
align-items: center;
}

.header-content {
width: 100%;
display: flex;
justify-content: flex-end;
align-items: center;
}

.main-content {
flex: 1;
overflow-y: auto;
display: flex;
flex-direction: column;
background: transparent;
}
</style>