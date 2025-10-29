<template>
<div class="notification-settings">
  <h3 class="settings-title">Notification Settings</h3>
  
  <!-- Permission Status -->
  <div class="settings-card">
    <div class="setting-row">
      <span>Notification Status</span>
      <span :class="['status', permissionStatus]">
        {{ permissionStatusText }}
      </span>
    </div>
    
    <div v-if="browserWarning" class="browser-warning">
      <p>{{ browserWarning }}</p>
    </div>
    
    <button 
      v-if="permissionStatus === 'default'"
      @click="requestPermission"
      class="btn btn-primary"
    >
      Enable Notifications
    </button>
    
    <div v-else-if="permissionStatus === 'denied'" class="permission-denied">
      <p>Notifications are blocked</p>
      <p class="text-muted">To enable them, check your browser or system settings.</p>
    </div>
    
    <button 
      v-else-if="permissionStatus === 'granted'"
      @click="testNotification"
      class="btn btn-secondary"
    >
      Send Test Notification
    </button>
  </div>

  <!-- Settings (only show if granted) -->
  <div v-if="permissionStatus === 'granted'" class="settings-card">
    <label class="setting-row toggle">
      <span>Daily Reminders</span>
      <input 
        type="checkbox" 
        v-model="settings.enabled"
        @change="saveSettings"
      />
    </label>

    <label class="setting-row">
      <span>Reminder Time</span>
      <input 
        type="time" 
        v-model="settings.time"
        @change="saveSettings"
        class="time-input"
      />
    </label>

    <label class="setting-row toggle">
      <span>Sound</span>
      <input 
        type="checkbox" 
        v-model="settings.sound"
        @change="saveSettings"
      />
    </label>

    <label class="setting-row toggle">
      <span>Vibration</span>
      <input 
        type="checkbox" 
        v-model="settings.vibrate"
        @change="saveSettings"
      />
    </label>
  </div>

  <!-- Info Box -->
  <div class="settings-card">
    <h5>How it Works</h5>
    <p class="text-muted">You'll get a reminder at {{ settings.time || '9:00 AM' }} when you have videos to review. This works even when the app is closed (on supported devices).</p>
  </div>
</div>
</template>

<script>
// We'll need the notificationManager for this component to work
import { notificationManager } from '../utils/notifications.js';

export default {
name: 'NotificationSettings',
data() {
  return {
    permissionStatus: 'default',
    settings: {
      enabled: true,
      time: '09:00',
      sound: true,
      vibrate: true
    },
    browserWarning: '',
  }
},
computed: {
  // This was the source of the error. It's now correctly inside the 'computed' object.
  permissionStatusText() {
    const statusMap = {
      granted: '✅ Enabled',
      denied: '❌ Blocked',
      default: '⏸️ Not Set',
    };
    return statusMap[this.permissionStatus] || 'Unknown';
  }
},
methods: {
  async requestPermission() {
    const granted = await notificationManager.requestPermission();
    this.updatePermissionStatus();
    
    if (granted) {
      notificationManager.scheduleDailyCheck();
      notificationManager.setupBackgroundSync();
    }
  },
  
  testNotification() {
    notificationManager.testNotification();
  },
  
  updatePermissionStatus() {
    if ('Notification' in window) {
      this.permissionStatus = Notification.permission;
    }
  },
  
  loadSettings() {
    this.settings = notificationManager.getSettings();
  },
  
  saveSettings() {
    notificationManager.saveSettings(this.settings);
    
    if (this.settings.enabled && this.permissionStatus === 'granted') {
      notificationManager.scheduleDailyCheck();
    }
  }
},
mounted() {
  this.updatePermissionStatus();
  this.loadSettings();
  
  if (this.permissionStatus === 'granted' && this.settings.enabled) {
    notificationManager.scheduleDailyCheck();
    notificationManager.setupBackgroundSync();
  }
}
}
</script>

<style scoped>
/* All styles remain the same, just a simplified version for brevity */
.settings-title {
font-size: 16px;
font-weight: 600;
text-align: center;
margin-bottom: var(--space-lg);
color: var(--text-secondary);
}

.settings-card {
background: var(--bg-secondary);
border: 1px solid var(--bg-tertiary);
border-radius: 48px;
padding: var(--space-md);
margin-bottom: var(--space-md);
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
}

.settings-card h5 {
text-align: center;
margin-bottom: var(--space-sm);
color: var(--accent-primary);
font-weight: 600;
}

.settings-card p.text-muted {
text-align: center;
font-size: 14px;
}

.setting-row {
display: flex;
justify-content: space-between;
align-items: center;
padding: var(--space-sm) 0;
}

.setting-row.toggle {
cursor: pointer;
}

.status { font-size: 14px; font-weight: 600; }
.status.granted { color: var(--accent-success); }
.status.denied { color: var(--accent-danger); }
.status.default { color: var(--accent-warning); }

.browser-warning {
margin: var(--space-md) 0;
padding: var(--space-sm);
background: rgba(255, 152, 0, 0.1);
border: 1px solid var(--accent-warning);
border-radius: var(--radius-md);
color: var(--accent-warning);
font-size: 14px;
}

.permission-denied {
margin-top: var(--space-md);
padding: var(--space-md);
background: rgba(244, 67, 54, 0.1);
border-radius: var(--radius-md);
}
.permission-denied p { text-align: center; margin-bottom: 0; }

.time-input {
background: var(--bg-tertiary);
border: 1px solid var(--bg-tertiary);
border-radius: var(--radius-md);
color: var(--text-primary);
padding: var(--space-xs) var(--space-sm);
}

input[type="checkbox"] {
width: 48px;
height: 24px;
position: relative;
appearance: none;
background: var(--bg-tertiary);
border-radius: 12px;
cursor: pointer;
transition: background 0.3s;
}
input[type="checkbox"]:checked { background: var(--accent-primary); }
input[type="checkbox"]::after {
content: '';
position: absolute;
width: 20px;
height: 20px;
border-radius: 50%;
background: white;
top: 2px;
left: 2px;
transition: transform 0.3s;
}
input[type="checkbox"]:checked::after { transform: translateX(24px); }

.btn { width: 100%; margin-top: var(--space-md); }
</style>