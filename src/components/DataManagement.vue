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
import { videoStore } from '../stores/videoStore';
import { videoFileStorage } from '../utils/videoStorage';

export default {
name: 'DataManagement',
data() {
  return {
    message: '',
    messageType: '' // 'success' | 'error'
  };
},
methods: {
  // Create a timestamped backup filename
  buildFilename() {
    const d = new Date();
    const pad = function(n) { return String(n).padStart(2, '0'); };
    const name = 'futterwacken-backup-' +
      d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' +
      pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds()) + '.json';
    return name;
  },

  // Export only metadata (videos array) as JSON
  exportData() {
    try {
      // Use the store's exporter (returns a JSON string of the videos array)
      const jsonStr = videoStore.exportVideos();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.buildFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showMessage('Backup exported successfully.', 'success');
    } catch (e) {
      console.error('Export failed:', e);
      this.showMessage('Export failed. Please try again.', 'error');
    }
  },

  triggerImport() {
    if (this.$refs.importInput) {
      this.$refs.importInput.value = '';
      this.$refs.importInput.click();
    }
  },

  async importData(event) {
    try {
      const input = event && event.target ? event.target : null;
      const file = input && input.files && input.files[0] ? input.files[0] : null;
      if (!file) return;

      if (file.type && file.type.indexOf('json') === -1 && file.name.toLowerCase().slice(-5) !== '.json') {
        this.showMessage('Please select a valid JSON file.', 'error');
        return;
      }

      // Read file content
      const text = await file.text();

      // We support either:
      // 1) A raw array of videos: [ {..video..}, ... ]
      // 2) An object with { videos: [ ... ] } for compatibility
      var parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        this.showMessage('Invalid JSON file.', 'error');
        return;
      }

      let payloadStr = null;
      if (Array.isArray(parsed)) {
        payloadStr = JSON.stringify(parsed);
      } else if (parsed && Array.isArray(parsed.videos)) {
        payloadStr = JSON.stringify(parsed.videos);
      } else {
        this.showMessage('Backup does not contain a valid videos list.', 'error');
        return;
      }

      // Import into the store (this overwrites current videos with the imported list)
      const ok = videoStore.importVideos(payloadStr);
      if (ok) {
        // Ensure reactive state is up-to-date
        await videoStore.loadVideos();
        // Optionally sync to Service Worker (non-invasive)
        this.maybeSyncServiceWorker();
        this.showMessage('Backup restored successfully.', 'success');
      } else {
        this.showMessage('Import failed. Please check the file and try again.', 'error');
      }
    } catch (e) {
      console.error('Import error:', e);
      this.showMessage('Import failed due to an unexpected error.', 'error');
    } finally {
      // Reset file input
      if (this.$refs.importInput) this.$refs.importInput.value = '';
    }
  },

  async confirmClear() {
    const ok = window.confirm('This will permanently delete all videos and settings from this device. Continue?');
    if (!ok) return;

    try {
      // Clear metadata
      videoStore.clearAllData();
      await videoStore.loadVideos();

      // Also clear stored video files (IndexedDB) for a true "clear all"
      try {
        await videoFileStorage.clearAllVideos();
      } catch (e) {
        console.log('Clearing video files skipped or failed:', e && e.message);
      }

      // Optionally notify the SW that data is now empty
      this.maybeSyncServiceWorker();

      this.showMessage('All data cleared successfully.', 'success');
    } catch (e) {
      console.error('Clear data failed:', e);
      this.showMessage('Failed to clear data. Please try again.', 'error');
    }
  },

  showMessage(text, type) {
    this.message = text;
    this.messageType = type;
    const self = this;
    setTimeout(function() {
      self.message = '';
      self.messageType = '';
    }, 3000);
  },

  // Non-invasive helper: if SW is active, send latest videos snapshot
  maybeSyncServiceWorker() {
    try {
      if (!('serviceWorker' in navigator)) return;
      const active = navigator.serviceWorker.controller;
      if (!active) return;

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

      active.postMessage({
        type: 'CACHE_VIDEOS',
        videos: JSON.parse(JSON.stringify(serializable))
      });
    } catch (e) {
      console.log('SW sync skipped:', e && e.message);
    }
  }
}
};
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