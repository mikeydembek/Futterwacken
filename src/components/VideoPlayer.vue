<template>
<div v-if="isOpen" class="video-modal" @click="closeOnBackdrop">
  <!-- Modal Content -->
  <div class="modal-content" @click.stop>
    <!-- Header -->
    <div class="modal-header">
      <h3>{{ video ? video.title : 'Video Player' }}</h3>
      <button @click="close" class="close-btn">✕</button>
    </div>

    <!-- Video Container -->
    <div class="video-container">
      <!-- Loading indicator -->
      <div v-if="isLoadingVideo" class="video-loading">
        <div class="loading"></div>
        <p>Loading video...</p>
      </div>

      <!-- Video element for uploaded files -->
      <video
        v-else-if="isDirectVideo && !videoError"
        ref="videoElement"
        :src="videoSrc"
        controls
        controlsList="nodownload"
        playsinline
        class="video-player"
        @loadedmetadata="handleVideoLoaded"
        @error="handleVideoError"
      >
        Your browser does not support the video tag.
      </video>

      <!-- YouTube iframe -->
      <iframe
        v-else-if="isYouTube"
        :src="youtubeEmbedUrl"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowfullscreen
        class="video-player"
      ></iframe>

      <!-- Error state for failed or missing video -->
      <div v-else-if="videoError" class="video-error">
        <div class="error-icon">⚠️</div>
        <h3>Unable to play video</h3>
        <p>{{ errorMessage }}</p>

        <div class="error-actions">
          <button @click="retryLoad" class="btn btn-secondary">
            🔄 Retry
          </button>

          <!-- NEW: Reattach flow only for uploaded files -->
          <button
            v-if="video && (video.isFileUpload || video.localFile)"
            @click="openFilePicker"
            class="btn btn-primary"
          >
            📁 Locate File
          </button>
          <input
            ref="filePicker"
            type="file"
            accept="video/*"
            @change="reattachFile"
            class="hidden-file-input"
          />
        </div>
      </div>

      <!-- External link fallback -->
      <div v-else class="external-link-container">
        <p>This video needs to be watched on the original platform:</p>
        <a :href="video ? video.url : '#'" target="_blank" class="btn btn-primary">
          🔗 Open Video in Browser
        </a>
      </div>
    </div><!-- Close video-container -->

    <!-- Video Info -->
    <div v-if="video && !isLoadingVideo" class="video-info">
      <div v-if="video.notes" class="video-notes">
        <strong>Notes:</strong>
        <p>{{ video.notes }}</p>
      </div>
      
      <div class="video-meta">
        <span v-if="video.isFileUpload" class="meta-tag">
          📁 Uploaded File
        </span>
        <span v-else class="meta-tag">
          🔗 Online Video
        </span>
        <span v-if="video.fileName" class="meta-tag">
          {{ formatFileSize(video.fileSize) }}
        </span>
      </div>
    </div><!-- Close video-info -->

    <!-- Controls -->
    <div class="modal-footer">
      <button 
        v-if="isDirectVideo && !videoError" 
        @click="toggleFullscreen" 
        class="btn btn-secondary"
      >
        {{ isFullscreen ? '↙️ Exit Fullscreen' : '🔳 Fullscreen' }}
      </button>
      <button @click="markWatchedAndClose" class="btn btn-primary">
        ✓ Mark as Watched
      </button>
    </div><!-- Close modal-footer -->
  </div><!-- Close modal-content -->
</div><!-- Close video-modal -->
</template>

<script>
import { videoFileStorage } from '../utils/videoStorage';
import { videoStore } from '../stores/videoStore';

export default {
name: 'VideoPlayer',
props: {
  video: {
    type: Object,
    default: null
  },
  isOpen: {
    type: Boolean,
    default: false
  }
},
data() {
  return {
    isFullscreen: false,
    videoError: false,
    errorMessage: '',
    actualVideoUrl: null,
    isLoadingVideo: false,
    retryCount: 0,
    handleFullscreenChange: null
  };
},
computed: {
  isDirectVideo() {
    if (!this.video) return false;
    if (this.video.isFileUpload) return true;
    if (this.video.localFile) return true;
    
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.mkv', '.m4v', '.3gp', '.wmv', '.flv'];
    const url = (this.video.url || '').toLowerCase();
    for (var i = 0; i < videoExtensions.length; i++) {
      if (url.indexOf(videoExtensions[i]) !== -1) return true;
    }
    return false;
  },
  
  isYouTube() {
    if (!this.video) return false;
    const url = this.video.url || '';
    return url.indexOf('youtube.com') !== -1 || url.indexOf('youtu.be') !== -1;
  },
  
  youtubeEmbedUrl() {
    if (!this.isYouTube || !this.video) return '';
    
    const url = this.video.url;
    var videoId = '';
    
    if (url.indexOf('youtube.com/watch') !== -1) {
      const urlObj = new URL(url);
      const urlParams = new URLSearchParams(urlObj.search);
      videoId = urlParams.get('v');
    } else if (url.indexOf('youtu.be/') !== -1) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.indexOf('youtube.com/embed/') !== -1) {
      videoId = url.split('embed/')[1].split('?')[0];
    }
    
    return videoId ? 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0' : '';
  },
  
  videoSrc() {
    if (this.actualVideoUrl) {
      return this.actualVideoUrl;
    }
    
    if (this.video && !this.video.isFileUpload && !this.video.localFile) {
      return this.video.url || '';
    }
    
    return '';
  }
},
methods: {
  async loadVideoFile() {
    if (!this.video) {
      this.actualVideoUrl = '';
      return;
    }

    if (!this.video.isFileUpload && !this.video.localFile) {
      this.actualVideoUrl = this.video.url || '';
      return;
    }

    this.isLoadingVideo = true;
    this.videoError = false;
    this.errorMessage = '';
    
    try {
      const storedUrl = await videoFileStorage.getVideoUrl(this.video.id);
      
      if (storedUrl) {
        this.actualVideoUrl = storedUrl;
        this.videoError = false;
      } else {
        // Missing file after restore/import
        this.videoError = true;
        this.errorMessage = 'This uploaded video file is missing on this device. Please locate the original file to reattach it.';
      }
    } catch (error) {
      console.error('Error loading video file:', error);
      this.videoError = true;
      this.errorMessage = 'Failed to load video file. Please try again.';
    } finally {
      this.isLoadingVideo = false;
    }
  },
  
  async retryLoad() {
    this.retryCount++;
    this.videoError = false;
    this.errorMessage = '';
    
    if (this.retryCount > 3) {
      this.errorMessage = 'Maximum retry attempts reached. Please re-upload or reattach the video.';
      this.videoError = true;
      return;
    }
    
    await this.loadVideoFile();
  },

  // NEW: open file picker to reattach missing uploaded file
  openFilePicker() {
    if (this.$refs.filePicker) {
      this.$refs.filePicker.value = '';
      this.$refs.filePicker.click();
    }
  },

  // NEW: save selected file into IndexedDB under the same id, update metadata, then reload
  async reattachFile(e) {
    try {
      const file = e && e.target && e.target.files ? e.target.files[0] : null;
      if (!file || !this.video) return;

      // Store the file in IndexedDB using the existing video id
      await videoFileStorage.saveVideoFile(this.video.id, file);

      // Update metadata for this video in the store
      var v = videoStore.videos.find(function(x) { return x.id === (e && e.target ? (e.target.closest && e.target.closest('[data-id]') ? e.target.closest('[data-id]').dataset.id : null) : null); });
      // Safer: just use this.video.id to find
      for (var i = 0; i < videoStore.videos.length; i++) {
        if (videoStore.videos[i].id === this.video.id) {
          videoStore.videos[i].fileName = file.name;
          videoStore.videos[i].fileSize = file.size;
          videoStore.videos[i].fileType = file.type;
          videoStore.videos[i].isFileUpload = true;
          videoStore.videos[i].localFile = true;
          videoStore.videos[i].hasFile = true;
          break;
        }
      }
      // Persist metadata
      videoStore.saveToStorage && videoStore.saveToStorage();

      // Reload the freshly saved file
      this.videoError = false;
      this.errorMessage = '';
      await this.loadVideoFile();
    } catch (err) {
      console.error('Reattach failed:', err);
      this.errorMessage = 'Could not attach this file. Please try again.';
      this.videoError = true;
    } finally {
      if (this.$refs.filePicker) this.$refs.filePicker.value = '';
    }
  },
  
  close() {
    this.$emit('close');
    
    if (this.isFullscreen && (document.fullscreenElement || document.webkitFullscreenElement)) {
      try {
        this.exitFullscreen();
      } catch (error) {
        console.log('Could not exit fullscreen on close:', error);
      }
    }
    
    if (this.actualVideoUrl && this.actualVideoUrl.indexOf('blob:') === 0) {
      URL.revokeObjectURL(this.actualVideoUrl);
    }
    
    this.actualVideoUrl = null;
    this.videoError = false;
    this.errorMessage = '';
    this.retryCount = 0;
    this.isFullscreen = false;
  },
  
  closeOnBackdrop(e) {
    if (e.target.classList.contains('video-modal')) {
      this.close();
    }
  },
  
  markWatchedAndClose() {
    this.$emit('mark-watched');
    this.close();
  },
  
  async toggleFullscreen() {
    if (!this.$refs.videoElement) return;
    
    try {
      if (!this.isFullscreen) {
        const elem = this.$refs.videoElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.webkitEnterFullscreen) {
          await elem.webkitEnterFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        }
        this.isFullscreen = true;
      } else {
        this.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      if (this.$refs.videoElement && this.$refs.videoElement.webkitEnterFullscreen) {
        this.$refs.videoElement.webkitEnterFullscreen();
      }
    }
  },
  
  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.webkitCancelFullScreen) {
      document.webkitCancelFullScreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    this.isFullscreen = false;
  },
  
  handleVideoLoaded() {
    this.videoError = false;
    this.errorMessage = '';
  },
  
  handleVideoError(e) {
    console.error('Video playback error:', e);
    
    if (this.video && (this.video.isFileUpload || this.video.localFile)) {
      this.errorMessage = 'Unable to play this uploaded file. It may be missing on this device. Please locate the original file and reattach it.';
    } else {
      this.errorMessage = 'Unable to play this video. Please check the URL or try again.';
    }
    
    this.videoError = true;
  },
  
  formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
},
watch: {
  isOpen: {
    async handler(newVal) {
      if (newVal && this.video) {
        document.body.style.overflow = 'hidden';
        await this.loadVideoFile();
      } else {
        document.body.style.overflow = '';
        
        if (this.actualVideoUrl && this.actualVideoUrl.indexOf('blob:') === 0) {
          URL.revokeObjectURL(this.actualVideoUrl);
        }
        this.actualVideoUrl = null;
        this.videoError = false;
        this.errorMessage = '';
        this.retryCount = 0;
      }
    },
    immediate: true
  }
},
mounted() {
  var self = this;
  this.handleFullscreenChange = function() {
    self.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
  };
  
  document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange);
},
beforeUnmount() {
  document.body.style.overflow = '';
  
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (error) {
      console.log('Could not exit fullscreen:', error);
    }
  }
  
  if (this.actualVideoUrl && this.actualVideoUrl.indexOf('blob:') === 0) {
    URL.revokeObjectURL(this.actualVideoUrl);
  }
  
  if (this.handleFullscreenChange) {
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange);
  }
}
};
</script>

<style scoped>
.video-modal {
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0, 0, 0, 0.9);
z-index: 1000;
display: flex;
align-items: center;
justify-content: center;
padding: var(--space-md);
animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
from { opacity: 0; }
to { opacity: 1; }
}

.modal-content {
background: var(--bg-secondary);
border-radius: var(--radius-lg);
width: 100%;
max-width: 900px;
max-height: 90vh;
display: flex;
flex-direction: column;
animation: slideUp 0.3s ease;
}

@keyframes slideUp {
from {
  transform: translateY(20px);
  opacity: 0;
}
to {
  transform: translateY(0);
  opacity: 1;
}
}

.modal-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: var(--space-md);
border-bottom: 1px solid var(--bg-tertiary);
}

.modal-header h3 {
margin: 0;
font-size: 18px;
flex: 1;
margin-right: var(--space-md);
color: var(--text-primary);
}

.close-btn {
background: var(--bg-tertiary);
border: none;
color: var(--text-primary);
width: 32px;
height: 32px;
border-radius: var(--radius-md);
font-size: 20px;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
transition: all 0.2s;
}

.close-btn:hover {
background: var(--accent-danger);
}

.video-container {
flex: 1;
background: black;
display: flex;
align-items: center;
justify-content: center;
min-height: 300px;
max-height: 500px;
overflow: hidden;
}

.video-player {
width: 100%;
height: 100%;
max-height: 500px;
object-fit: contain;
}

.video-loading {
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
color: var(--text-secondary);
padding: var(--space-xl);
}

.video-loading .loading {
margin-bottom: var(--space-md);
width: 40px;
height: 40px;
border: 3px solid var(--bg-tertiary);
border-top-color: var(--accent-primary);
border-radius: 50%;
animation: spin 0.8s linear infinite;
}

@keyframes spin {
to { transform: rotate(360deg); }
}

.video-error {
text-align: center;
padding: var(--space-xl);
color: var(--text-secondary);
}

.error-icon {
font-size: 48px;
margin-bottom: var(--space-md);
}

.video-error h3 {
color: var(--text-primary);
margin-bottom: var(--space-sm);
}

.video-error p {
margin-bottom: var(--space-lg);
max-width: 400px;
margin-left: auto;
margin-right: auto;
}

.error-actions {
display: flex;
gap: var(--space-sm);
justify-content: center;
flex-wrap: wrap;
}

.external-link-container {
text-align: center;
padding: var(--space-xl);
}

.external-link-container p {
margin-bottom: var(--space-lg);
color: var(--text-secondary);
}

.video-info {
padding: var(--space-md);
border-top: 1px solid var(--bg-tertiary);
max-height: 150px;
overflow-y: auto;
}

.video-notes {
margin-bottom: var(--space-md);
}

.video-notes strong {
display: block;
margin-bottom: var(--space-xs);
color: var(--text-secondary);
font-size: 12px;
text-transform: uppercase;
}

.video-notes p {
color: var(--text-primary);
font-size: 14px;
line-height: 1.5;
}

.video-meta {
display: flex;
gap: var(--space-sm);
flex-wrap: wrap;
}

.meta-tag {
padding: 4px 8px;
background: var(--bg-tertiary);
border-radius: var(--radius-sm);
font-size: 12px;
color: var(--text-secondary);
}

/* Hidden file input for reattach flow */
.hidden-file-input {
position: absolute;
width: 1px;
height: 1px;
overflow: hidden;
clip: rect(0 0 0 0);
clip-path: inset(50%);
white-space: nowrap;
border: 0;
padding: 0;
margin: 0;
}
</style>