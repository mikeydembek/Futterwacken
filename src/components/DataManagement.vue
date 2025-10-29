<template>
<div class="data-management">
  <h3 class="settings-title">Data Management</h3>
  
  <!-- Export Data -->
  <div class="settings-card">
    <h4>Backup Your Data</h4>
    <p class="text-muted">Export all your videos and settings to a file.</p>
    <button @click="exportData" class="btn btn-primary">
      Export Data
    </button>
  </div>

  <!-- Import Data -->
  <div class="settings-card">
    <h4>Restore Data</h4>
    <p class="text-muted">Import a previously exported backup file.</p>
    <button @click="triggerImport" class="btn btn-secondary">
      Import Data
    </button>
    <input 
      ref="importInput"
      type="file"
      accept=".json"
      @change="importData"
      style="display: none"
    />
  </div>

  <!-- Clear Data -->
  <div class="settings-card danger">
    <h4>Clear All Data</h4>
    <p class="text-muted">⚠️ This will permanently delete all videos and settings from this device.</p>
    <button @click="confirmClear" class="btn btn-danger">
      Clear All Data
    </button>
  </div>

  <!-- Success/Error Messages -->
  <div v-if="message" :class="['message', messageType]">
    {{ message }}
  </div>
</div>
</template>

<script>
// Script remains the same
import { videoStore } from '../stores/videoStore'

export default {
name: 'DataManagement',
// ... (rest of the script)
data() {
  return {
    message: '',
    messageType: ''
  }
},
methods: {
  exportData() {
    // ...
  },
  triggerImport() {
    // ...
  },
  async importData(event) {
    // ...
  },
  confirmClear() {
    // ...
  },
  showMessage(text, type) {
    // ...
  }
}
}
</script>

<style scoped>
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

.settings-card h4 {
text-align: center;
margin-bottom: var(--space-sm);
font-size: 16px;
}

.settings-card p {
text-align: center;
margin-bottom: var(--space-md);
font-size: 14px;
}

.settings-card.danger {
border-color: rgba(239, 68, 68, 0.4);
}

.btn { width: 100%; }

.btn-danger {
background: var(--accent-danger);
color: white;
}

.message {
padding: var(--space-md);
border-radius: var(--radius-lg);
margin-top: var(--space-md);
text-align: center;
font-weight: 500;
}
.message.success { background: rgba(16, 185, 129, 0.15); color: var(--accent-success); }
.message.error { background: rgba(239, 68, 68, 0.15); color: var(--accent-danger); }
</style>