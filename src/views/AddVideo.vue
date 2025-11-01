<template>
<div class="add-view">
  <!-- This wrapper is now centered vertically -->
  <div class="content-wrapper">
    <!-- Actions -->
    <div class="actions">
      <!-- Add Video URL (blue) -->
      <button class="action-card url" @click="openUrlModal" aria-label="Add video from URL">
        <div class="label-group">
          <div class="action-title">Add Video URL</div>
        </div>
      </button>

      <!-- Pick from Device (dark) -->
      <button class="action-card device" @click="openFileModal" aria-label="Upload video from device">
        <div class="label-group">
          <div class="action-title">Pick from Device</div>
        </div>
      </button>
    </div>

    <!-- Recent videos -->
    <div v-if="recentVideos.length" class="recent-section">
      <!-- Separator line -->
      <div class="separator"></div>

      <!-- Title, now white and on the left -->
      <div class="recent-title">Recently Added</div>

      <div v-for="v in recentVideos" :key="v.id" class="recent-card">
        <div class="item-center">
          <div class="item-title">{{ v.title }}</div>
          <div class="mini-info">
            <span class="meta-pill small">
              <span class="meta-dot" :class="v.isFileUpload ? 'dot-file' : 'dot-link'"></span>
              {{ v.isFileUpload ? 'Uploaded' : 'Link' }}
            </span>
            <span class="mini-badge">{{ timeAgo(v.dateAdded) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal -->
  <div v-if="showModal" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2 class="modal-title">{{ modalMode === 'url' ? 'Add from URL' : 'Upload from Device' }}</h2>
        <button class="modal-close" @click="closeModal" aria-label="Close">✕</button>
      </div>

      <div class="modal-body">
        <!-- Title -->
        <div class="form-row">
          <label class="label">Title</label>
          <input
            class="input"
            type="text"
            v-model="videoTitle"
            placeholder="Video title"
            maxlength="100"
          />
        </div>

        <!-- URL -->
        <div v-if="modalMode === 'url'" class="form-row">
          <label class="label">Video URL</label>
          <input
            class="input"
            type="url"
            v-model="videoUrl"
            placeholder="https://youtube.com/watch?v=..."
          />
        </div>

        <!-- File picker -->
        <div v-if="modalMode === 'file'" class="form-row">
          <label class="label">Select a file</label>
          <div class="file-row">
            <button class="btn btn-secondary" @click="triggerFileInput">Choose Video</button>
            <span class="file-name" v-if="selectedFile">{{ selectedFile.name }}</span>
          </div>
          <input
            ref="fileInput"
            class="hidden-file-input"
            type="file"
            accept="video/*"
            @change="handleFileSelect"
          />
        </div>

        <!-- Notes -->
        <div class="form-row">
          <label class="label">Notes (optional)</label>
          <textarea
            class="input textarea"
            rows="3"
            v-model="videoNotes"
            placeholder="Add short notes..."
            maxlength="500"
          />
        </div>

        <!-- Error -->
        <div v-if="errorMessage" class="error">{{ errorMessage }}</div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary w-full" @click="closeModal">Cancel</button>
        <button class="btn btn-primary w-full" :disabled="!canSave" @click="saveVideo">Save</button>
      </div>
    </div>
  </div>

  <!-- Success Toast -->
  <div v-if="successMessage" class="success-toast">Saved!</div>
</div>
</template>

<script>
import { videoStore } from '../stores/videoStore';
import { videoFileStorage } from '../utils/videoStorage';

export default {
name: 'AddVideo',
data() {
  return {
    // modal
    showModal: false,
    modalMode: 'url', // 'url' | 'file'

    // form
    videoTitle: '',
    videoUrl: '',
    videoNotes: '',
    selectedFile: null,

    // ui
    errorMessage: '',
    successMessage: '',

    // recent
    recentVideos: []
  };
},
computed: {
  canSave() {
    if (!this.videoTitle.trim()) return false;
    if (this.modalMode === 'url') return !!this.videoUrl.trim();
    return !!this.selectedFile;
  }
},
methods: {
  openUrlModal() {
    this.resetForm();
    this.modalMode = 'url';
    this.showModal = true;
  },
  openFileModal() {
    this.resetForm();
    this.modalMode = 'file';
    this.showModal = true;
  },
  closeModal() {
    this.showModal = false;
    this.errorMessage = '';
  },
  triggerFileInput() {
    this.$refs.fileInput && this.$refs.fileInput.click();
  },
  handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    // basic checks
    const max = 500 * 1024 * 1024;
    if (file.size > max) {
      this.errorMessage = 'File too large (max 500MB)';
      return;
    }
    if (!file.type.startsWith('video/')) {
      this.errorMessage = 'Please select a video file';
      return;
    }
    this.selectedFile = file;
    this.errorMessage = '';
    if (!this.videoTitle.trim()) {
      // iOS FIX - Replacing the regex with simple string manipulation
      const lastDot = file.name.lastIndexOf('.');
      const nameWithoutExt = (lastDot === -1) ? file.name : file.name.substring(0, lastDot);
      this.videoTitle = nameWithoutExt;
    }
  },
  async saveVideo() {
    try {
      this.errorMessage = '';
      const id = Date.now().toString();

      const videoData = {
        id,
        title: this.videoTitle.trim(),
        url: this.modalMode === 'url' ? this.videoUrl.trim() : '',
        notes: this.videoNotes.trim(),
        isFileUpload: this.modalMode === 'file',
        fileName: this.selectedFile ? this.selectedFile.name : null,
        fileSize: this.selectedFile ? this.selectedFile.size : null,
        fileType: this.selectedFile ? this.selectedFile.type : null,
        dateAdded: new Date().toISOString()
      };

      if (this.selectedFile) {
        await videoFileStorage.saveVideoFile(id, this.selectedFile);
        videoData.url = URL.createObjectURL(this.selectedFile);
        videoData.localFile = true;
      }

      videoStore.addVideo(videoData);

      this.successMessage = 'Saved!';
      this.loadRecent();
      this.resetForm();
      this.showModal = false;
      setTimeout(() => (this.successMessage = ''), 1200);
    } catch (e) {
      console.error(e);
      this.errorMessage = 'Failed to save video';
    }
  },
  resetForm() {
    this.videoTitle = '';
    this.videoUrl = '';
    this.videoNotes = '';
    this.selectedFile = null;
    if (this.$refs.fileInput) this.$refs.fileInput.value = '';
  },
  loadRecent() {
    this.recentVideos = (videoStore.videos || []).slice(0, 3);
  },
  timeAgo(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return d.toLocaleDateString();
  }
},
mounted() {
  this.loadRecent();
}
};
</script>

<style scoped>
.add-view {
height: 100%;
overflow-y: auto;
padding-bottom: 80px;
padding-inline: var(--space-md);
padding-top: var(--space-md);
/* New, darker gray background */
background: #1F2937;

display: grid;
place-items: center;
}

.content-wrapper {
width: 100%;
max-width: 500px;
}

/* Actions cards (pill-like) */
.actions {
display: flex;
flex-direction: column;
gap: var(--space-md);
margin-bottom: var(--space-lg);
}
.action-card {
width: 100%;
border-radius: 48px;
border: 1px solid var(--bg-tertiary);
display: grid;
grid-template-columns: 1fr;
justify-items: center;
align-items: center;
gap: var(--space-md);
padding: 16px;
text-align: left;
transition: transform .1s ease, border-color .15s ease, background .15s ease, box-shadow .15s ease;
cursor: pointer;
/* New shadow to create a "hovering" effect */
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
}
.action-card:active { transform: scale(0.98); }
.action-card.url {
background: var(--accent-primary);
border: 1px solid var(--accent-primary);
color: #fff;
}
.action-card.device {
background: var(--bg-secondary);
color: var(--text-primary);
}

/* Labels (no icon, centered) */
.label-group {
display: flex;
flex-direction: column;
align-items: center;
gap: 2px;
}
.action-title {
font-size: 16px;
font-weight: 600;
text-align: center;
}

/* Recent */
.recent-section {
margin-top: var(--space-lg);
}
.separator {
width: 100%;
height: 1px;
background: #6B7280;
margin-block: var(--space-lg);
}
.recent-title {
font-size: 14px;
font-weight: 600;
color: #ffffff;
text-align: left;
margin-bottom: var(--space-sm);
}
.recent-card {
border-radius: 16px;
border: 1px solid #6B7280;
background: var(--bg-secondary);
padding: var(--space-md);
margin-bottom: var(--space-sm);
}
.item-center {
display: flex;
flex-direction: column;
align-items: center;
gap: 2px;
}
.item-title {
font-size: 14px;
font-weight: 600;
text-align: center;
color: var(--text-primary);
}
.mini-info {
display: flex;
align-items: center;
gap: 8px;
}
.mini-badge {
font-size: 10px;
color: var(--accent-primary);
font-weight: 600;
}
.meta-pill.small {
font-size: 10px;
background: var(--bg-primary);
}
.meta-pill {
display: inline-flex;
align-items: center;
gap: 6px;
padding: 4px 8px;
border-radius: var(--radius-full);
font-size: 12px;
color: var(--text-secondary);
background: var(--bg-tertiary);
}
.meta-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.dot-file { background: var(--text-secondary); }
.dot-link { background: var(--accent-primary); }

/* Modal */
.modal-overlay {
position: fixed; inset: 0;
background: rgba(0,0,0,0.75);
display: grid; place-items: center;
z-index: 1000;
padding: var(--space-md);
}
.modal-content {
width: 100%; max-width: 520px;
border-radius: 32px;
border: 1px solid var(--bg-tertiary);
background: var(--bg-secondary);
padding: var(--space-md);
}
.modal-header {
display: grid;
grid-template-columns: 1fr auto;
align-items: center;
}
.modal-title {
text-align: center;
font-size: 16px;
font-weight: 600;
color: var(--text-primary);
}
.modal-close {
width: 36px; height: 36px;
border-radius: 9999px;
background: var(--bg-tertiary);
border: none; color: var(--text-primary);
display: grid; place-items: center;
cursor: pointer;
}
.modal-body {
margin-top: var(--space-md);
display: flex; flex-direction: column;
gap: var(--space-md);
}
.form-row { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 12px; color: var(--text-secondary); }
.input {
width: 100%;
height: 44px;
border-radius: var(--radius-full);
background: var(--bg-tertiary);
border: 1px solid transparent;
color: var(--text-primary);
padding: 0 var(--space-md);
font-size: 14px;
}
.input:focus { border-color: var(--accent-primary); outline: none; }
.textarea {
height: auto;
padding-top: var(--space-sm);
padding-bottom: var(--space-sm);
border-radius: 16px;
resize: vertical;
}
.file-row { display: flex; align-items: center; gap: var(--space-sm); }
.file-name { font-size: 12px; color: var(--text-secondary); }

.modal-actions {
margin-top: var(--space-md);
display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);
}
.w-full { width: 100%; }

.error {
background: rgba(244,67,54,0.12);
border: 1px solid var(--accent-danger);
color: var(--accent-danger);
padding: 8px 10px;
border-radius: 12px;
font-size: 12px;
}

/* Toast */
.success-toast {
position: fixed;
bottom: 100px; left: 50%;
transform: translateX(-50%);
padding: var(--space-sm) var(--space-md);
background: var(--bg-secondary);
border: 1px solid var(--accent-success);
color: var(--accent-success);
border-radius: 16px;
z-index: 1001;
}
.hidden-file-input { position: absolute; left: -9999px; opacity: 0; }
</style>