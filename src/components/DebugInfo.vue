<template>
<div v-if="showDebug" class="debug-info">
  <button @click="showDebug = false" class="close-debug">×</button>
  <h4>Debug Info</h4>
  <p><strong>User Agent:</strong> {{ userAgent }}</p>
  <p><strong>Platform:</strong> {{ platform }}</p>
  <p><strong>iOS Device:</strong> {{ isIOS ? 'Yes' : 'No' }}</p>
  <p><strong>Safari:</strong> {{ isSafari ? 'Yes' : 'No' }}</p>
  <p><strong>IndexedDB:</strong> {{ hasIndexedDB ? 'Supported' : 'Not Supported' }}</p>
  <p><strong>Service Worker:</strong> {{ hasServiceWorker ? 'Supported' : 'Not Supported' }}</p>
  <p><strong>Notifications:</strong> {{ notificationStatus }}</p>
  <p><strong>Screen:</strong> {{ screenInfo }}</p>
  <p><strong>Errors:</strong> {{ errors.length > 0 ? errors.join(', ') : 'None' }}</p>
</div>
<button v-else @click="showDebug = true" class="debug-toggle">🐛</button>
</template>

<script>
export default {
name: 'DebugInfo',
data() {
  return {
    showDebug: false,
    userAgent: '',
    platform: '',
    isIOS: false,
    isSafari: false,
    hasIndexedDB: false,
    hasServiceWorker: false,
    notificationStatus: 'Unknown',
    screenInfo: '',
    errors: []
  };
},
mounted() {
  this.gatherDebugInfo();
  this.setupErrorHandlers();
},
methods: {
  gatherDebugInfo() {
    // User agent and platform
    this.userAgent = navigator.userAgent;
    this.platform = navigator.platform;
    
    // Detect iOS
    this.isIOS = /iPad|iPhone|iPod/.test(this.userAgent) && !window.MSStream;
    
    // Detect Safari
    this.isSafari = /^((?!chrome|android).)*safari/i.test(this.userAgent);
    
    // Feature detection
    this.hasIndexedDB = 'indexedDB' in window;
    this.hasServiceWorker = 'serviceWorker' in navigator;
    
    // Notification status
    if ('Notification' in window) {
      this.notificationStatus = Notification.permission;
    } else {
      this.notificationStatus = 'Not supported';
    }
    
    // Screen info
    this.screenInfo = `${window.innerWidth}x${window.innerHeight} (${window.devicePixelRatio}x)`;
  },
  setupErrorHandlers() {
    window.addEventListener('error', (event) => {
      this.errors.push(`${event.message} at ${event.filename}:${event.lineno}`);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.errors.push(`Promise rejection: ${event.reason}`);
    });
  }
}
};
</script>

<style scoped>
.debug-toggle {
position: fixed;
bottom: 100px;
right: 10px;
width: 40px;
height: 40px;
border-radius: 50%;
background: rgba(0, 0, 0, 0.7);
border: 2px solid white;
color: white;
font-size: 20px;
z-index: 9998;
cursor: pointer;
}

.debug-info {
position: fixed;
bottom: 60px;
left: 10px;
right: 10px;
max-height: 50vh;
overflow-y: auto;
background: rgba(0, 0, 0, 0.95);
color: #00ff00;
padding: 15px;
font-family: monospace;
font-size: 12px;
z-index: 9999;
border-radius: 8px;
border: 1px solid #00ff00;
}

.close-debug {
position: absolute;
top: 5px;
right: 5px;
background: none;
border: none;
color: #00ff00;
font-size: 24px;
cursor: pointer;
}

.debug-info h4 {
margin-bottom: 10px;
color: #00ff00;
}

.debug-info p {
margin: 5px 0;
word-break: break-all;
}

.debug-info strong {
color: #00ffff;
}
</style>