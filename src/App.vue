<template>
<div id="app">
  <!-- Header -->
  <header class="global-header">
    <div class="header-content">
      <HamburgerMenu />
    </div>
  </header>
  
  <!-- Main content area -->
  <main class="main-content">
    <AddVideo v-if="activeTab === 'add'" />
    <TodayReminders v-else-if="activeTab === 'today'" />
    <Calendar v-else-if="activeTab === 'calendar'" />
  </main>
  
  <!-- Tab bar at bottom -->
  <TabBar 
    :active-tab="activeTab" 
    @change-tab="activeTab = $event"
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
import { notificationManager } from './utils/notifications';
import { videoStore } from './stores/videoStore'; // Ensure this is correctly imported

export default {
name: 'App',
components: {
  TabBar,
  HamburgerMenu,
  AddVideo,
  TodayReminders,
  Calendar
},
data() {
  return {
    activeTab: 'today'
  }
},
computed: {
  // These are fine but not displayed, keeping for potential future use
  headerTitle() {
    const titles = {
      'add': 'Add New Video',
      'today': "Today's Reminders",
      'calendar': 'Calendar'
    };
    return titles[this.activeTab] || 'Futterwacken';
  },
  headerSubtitle() {
    const subtitles = {
      'add': 'Add a video to your learning schedule',
      'today': this.getTodayDate(),
      'calendar': 'Your video review schedule'
    };
    return subtitles[this.activeTab] || '';
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
      // The check on startup is now handled in scheduleDailyCheck
    }
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'check-reminders') {
          notificationManager.checkForNotifications();
        }
      });
    }
  }
},
// --- THE FIX IS HERE ---
// Add the 'async' keyword to the mounted hook
async mounted() {
  // Await the loading of videos from IndexedDB
  await videoStore.loadVideos();
  this.initializeNotifications();
  
  // Then initialize notifications
  this.initializeNotifications();
}
}
</script>

<style scoped>
/* All styles from the last stable version remain the same */
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
background: transparent; 
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