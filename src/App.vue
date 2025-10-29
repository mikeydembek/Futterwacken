<template>
<div id="app">
  <!-- Header is transparent -->
  <header class="global-header">
    <div class="header-content">
      <HamburgerMenu />
    </div>
  </header>
  
  <!-- Main content area is also transparent -->
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
import TabBar from './components/TabBar.vue'
import HamburgerMenu from './components/HamburgerMenu.vue'
import AddVideo from './views/AddVideo.vue'
import TodayReminders from './views/TodayReminders.vue'
import Calendar from './views/Calendar.vue'
import { notificationManager } from './utils/notifications'

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
  // This computed property was defined outside the main object in your last code
  headerTitle() {
    const titles = {
      'add': 'Add New Video',
      'today': "Today's Reminders",
      'calendar': 'Calendar'
    }
    return titles[this.activeTab] || 'Futterwacken'
  },
  // This was also outside the main object
  headerSubtitle() {
    const subtitles = {
      'add': 'Add a video to your learning schedule',
      'today': this.getTodayDate(),
      'calendar': 'Your video review schedule'
    }
    return subtitles[this.activeTab] || ''
  }
},
methods: {
  // This method needs to be inside the 'methods' object to be called with 'this'
  getTodayDate() {
    return new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    })
  },
  // This also needs to be inside 'methods'
  async initializeNotifications() {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        notificationManager.scheduleDailyCheck();
        notificationManager.setupBackgroundSync();
        notificationManager.checkForNotifications();
      }
    }
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data.type === 'check-reminders') {
          notificationManager.checkForNotifications();
        }
      });
    }
  }
},
mounted() {
  // Now this call will work correctly
  this.initializeNotifications()
}
}
</script>

<style scoped>
#app {
height: 100vh;
display: flex;
flex-direction: column;
position: relative;

/* The entire app background is the gradient */
background: linear-gradient(
  to bottom,
  var(--bg-secondary) 0%,   /* Starts with the header/tab bar color */
  #1F2937 20%,              /* Fades to the darker body color */
  #1F2937 100%              /* The rest is the solid darker color */
);
}

/* Header is transparent */
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

/* Main content area is also transparent */
.main-content {
flex: 1;
overflow-y: auto; /* Allows content to scroll */
display: flex;
flex-direction: column;
background: transparent;
}
</style>