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

      <!-- Error state for failed video -->
      <div v-else-if="videoError" class="video-error">
        <div class="error-icon">⚠️</div>
        <h3>Unable to play video</h3>
        <p>{{ errorMessage }}</p>
        <button @click="retryLoad" class="btn btn-secondary">
          🔄 Retry
        </button>
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
import { videoFileStorage } from '../utils/videoStorage'

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
  }
},
computed: {
  isDirectVideo() {
    if (!this.video) return false
    if (this.video.isFileUpload) return true
    if (this.video.localFile) return true
    
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.avi', '.mkv', '.m4v', '.3gp', '.wmv', '.flv']
    const url = (this.video.url || '').toLowerCase()
    return videoExtensions.some(ext => url.includes(ext))
  },
  
  isYouTube() {
    if (!this.video) return false
    const url = this.video.url || ''
    return url.includes('youtube.com') || url.includes('youtu.be')
  },
  
  youtubeEmbedUrl() {
    if (!this.isYouTube || !this.video) return ''
    
    const url = this.video.url
    let videoId = ''
    
    if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(new URL(url).search)
      videoId = urlParams.get('v')
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0]
    } else if (url.includes('youtube.com/embed/')) {
      videoId = url.split('embed/')[1].split('?')[0]
    }
    
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : ''
  },
  
  videoSrc() {
    if (this.actualVideoUrl) {
      return this.actualVideoUrl
    }
    
    if (this.video && !this.video.isFileUpload && !this.video.localFile) {
      return this.video.url || ''
    }
    
    return ''
  }
},
methods: {
  async loadVideoFile() {
    if (!this.video) {
      this.actualVideoUrl = ''
      return
    }

    if (!this.video.isFileUpload) {
      this.actualVideoUrl = this.video.url || ''
      return
    }

    this.isLoadingVideo = true
    this.videoError = false
    this.errorMessage = ''
    
    console.log('Loading video file for ID:', this.video.id)
    
    try {
      const storedUrl = await videoFileStorage.getVideoUrl(this.video.id)
      
      if (storedUrl) {
        console.log('Successfully loaded video from IndexedDB')
        this.actualVideoUrl = storedUrl
        this.videoError = false
      } else {
        console.log('Video not found in IndexedDB, trying original URL')
        
        if (this.video.url && this.video.url.startsWith('blob:')) {
          this.videoError = true
          this.errorMessage = 'Video file not found. It may have been deleted or the session has expired.'
        } else {
          this.actualVideoUrl = this.video.url
        }
      }
    } catch (error) {
      console.error('Error loading video file:', error)
      this.videoError = true
      this.errorMessage = 'Failed to load video file. Please try again.'
      
      if (this.video.url && !this.video.url.startsWith('blob:')) {
        this.actualVideoUrl = this.video.url
        this.videoError = false
      }
    } finally {
      this.isLoadingVideo = false
    }
  },
  
  async retryLoad() {
    this.retryCount++
    this.videoError = false
    this.errorMessage = ''
    
    if (this.retryCount > 3) {
      this.errorMessage = 'Maximum retry attempts reached. Please re-upload the video.'
      this.videoError = true
      return
    }
    
    await this.loadVideoFile()
  },
  
  close() {
    this.$emit('close')
    
    if (this.isFullscreen && (document.fullscreenElement || document.webkitFullscreenElement)) {
      try {
        this.exitFullscreen()
      } catch (error) {
        console.log('Could not exit fullscreen on close:', error)
      }
    }
    
    if (this.actualVideoUrl && this.actualVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.actualVideoUrl)
    }
    
    this.actualVideoUrl = null
    this.videoError = false
    this.errorMessage = ''
    this.retryCount = 0
    this.isFullscreen = false
  },
  
  closeOnBackdrop(e) {
    if (e.target.classList.contains('video-modal')) {
      this.close()
    }
  },
  
  markWatchedAndClose() {
    this.$emit('mark-watched')
    this.close()
  },
  
  async toggleFullscreen() {
    if (!this.$refs.videoElement) return
    
    try {
      if (!this.isFullscreen) {
        const elem = this.$refs.videoElement
        if (elem.requestFullscreen) {
          await elem.requestFullscreen()
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen()
        } else if (elem.webkitEnterFullscreen) {
          await elem.webkitEnterFullscreen()
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen()
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen()
        }
        this.isFullscreen = true
      } else {
        this.exitFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
      if (this.$refs.videoElement && this.$refs.videoElement.webkitEnterFullscreen) {
        this.$refs.videoElement.webkitEnterFullscreen()
      }
    }
  },
  
  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    } else if (document.webkitCancelFullScreen) {
      document.webkitCancelFullScreen()
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen()
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen()
    }
    this.isFullscreen = false
  },
  
  handleVideoLoaded() {
    console.log('Video loaded successfully')
    this.videoError = false
    this.errorMessage = ''
  },
  
  handleVideoError(e) {
    console.error('Video playback error:', e)
    
    if (this.video && this.video.isFileUpload) {
      console.error('Uploaded file playback error:', {
        fileName: this.video.fileName,
        fileType: this.video.fileType,
        fileSize: this.video.fileSize,
        url: this.videoSrc
      })
      
      this.errorMessage = `Unable to play ${this.video.fileName}. The file may be corrupted or in an unsupported format.`
    } else {
      this.errorMessage = 'Unable to play this video. Please check the URL or try again.'
    }
    
    this.videoError = true
  },
  
  formatFileSize(bytes) {
    if (!bytes) return ''
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }
},
watch: {
  isOpen: {
    async handler(newVal) {
      if (newVal && this.video) {
        document.body.style.overflow = 'hidden'
        await this.loadVideoFile()
      } else {
        document.body.style.overflow = ''
        
        if (this.actualVideoUrl && this.actualVideoUrl.startsWith('blob:')) {
          URL.revokeObjectURL(this.actualVideoUrl)
        }
        this.actualVideoUrl = null
        this.videoError = false
        this.errorMessage = ''
        this.retryCount = 0
      }
    },
    immediate: true
  }
},
mounted() {
  this.handleFullscreenChange = () => {
    this.isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement)
  }
  
  document.addEventListener('fullscreenchange', this.handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange)
},
beforeUnmount() {
  document.body.style.overflow = ''
  
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      }
    } catch (error) {
      console.log('Could not exit fullscreen:', error)
    }
  }
  
  if (this.actualVideoUrl && this.actualVideoUrl.startsWith('blob:')) {
    URL.revokeObjectURL(this.actualVideoUrl)
  }
  
  if (this.handleFullscreenChange) {
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange)
  }
}
}
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

.modal-footer {
padding: var(--space-md);
border-top: 1px solid var(--bg-tertiary);
display: flex;
gap: var(--space-sm);
}

.modal-footer .btn {
flex: 1;
}

@media (max-width: 768px) {
.modal-content {
  max-width: 100%;
  max-height: 95vh;
  margin: 0;
}

.video-container {
  max-height: 40vh;
}

.modal-header h3 {
  font-size: 16px;
}
}

@media (orientation: landscape) and (max-height: 500px) {
.modal-content {
  max-height: 100vh;
}

.video-container {
  max-height: 60vh;
}

.video-info {
  display: none;
}
}
</style>