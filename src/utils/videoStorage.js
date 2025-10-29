// Video file storage using IndexedDB for persistent storage
// IndexedDB can store large files (up to ~50% of available disk space)

class VideoFileStorage {
  constructor() {
    this.dbName = 'VideoLearningDB'
    this.dbVersion = 1
    this.storeName = 'videoFiles'
    this.db = null
    this.initDB()
  }

  // Initialize IndexedDB
  async initDB() {
    return new Promise((resolve, reject) => {
      // Check if IndexedDB is supported
      if (!window.indexedDB) {
        console.error('IndexedDB is not supported in this browser')
        reject(new Error('IndexedDB not supported'))
        return
      }

      const request = indexedDB.open(this.dbName, this.dbVersion)
      
      // Handle database upgrade (create object stores)
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        
        // Create object store for video files if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('videoId', 'videoId', { unique: true })
          store.createIndex('fileName', 'fileName', { unique: false })
          console.log('Created video files object store')
        }
      }
      
      // Handle successful database opening
      request.onsuccess = (event) => {
        this.db = event.target.result
        console.log('IndexedDB initialized successfully')
        resolve(this.db)
      }
      
      // Handle errors
      request.onerror = (event) => {
        console.error('Failed to open IndexedDB:', event.target.error)
        reject(event.target.error)
      }
    })
  }

  // Ensure database is ready
  async ensureDB() {
    if (!this.db) {
      await this.initDB()
    }
    return this.db
  }

  // Save video file to IndexedDB
  async saveVideoFile(videoId, file) {
    try {
      await this.ensureDB()
      
      console.log(`Saving video file for ID ${videoId}`)
      console.log(`File details: ${file.name}, Size: ${this.formatBytes(file.size)}, Type: ${file.type}`)
      
      // Convert file to ArrayBuffer for storage
      const arrayBuffer = await this.fileToArrayBuffer(file)
      
      // Create the data object to store
      const videoData = {
        id: videoId,
        videoId: videoId,
        fileName: file.name,
        fileType: file.type || this.guessMediaType(file.name),
        fileSize: file.size,
        data: arrayBuffer,
        savedAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      }
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.put(videoData)
        
        request.onsuccess = () => {
          console.log(`Video file saved successfully for ID ${videoId}`)
          resolve(true)
        }
        
        request.onerror = (event) => {
          console.error('Failed to save video file:', event.target.error)
          reject(event.target.error)
        }
        
        transaction.oncomplete = () => {
          console.log('Transaction completed successfully')
        }
        
        transaction.onerror = (event) => {
          console.error('Transaction failed:', event.target.error)
          reject(event.target.error)
        }
      })
    } catch (error) {
      console.error('Error saving video file:', error)
      throw error
    }
  }

  // Get video file from IndexedDB and create blob URL
  async getVideoUrl(videoId) {
    try {
      await this.ensureDB()
      
      console.log(`Retrieving video file for ID ${videoId}`)
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.get(videoId)
        
        request.onsuccess = () => {
          const result = request.result
          
          if (result && result.data) {
            console.log(`Found video file: ${result.fileName}`)
            console.log(`File size: ${this.formatBytes(result.fileSize)}`)
            
            // Determine the correct MIME type
            let mimeType = result.fileType || this.guessMediaType(result.fileName)
            
            console.log(`Using MIME type: ${mimeType}`)
            
            // Create blob from ArrayBuffer
            const blob = new Blob([result.data], { type: mimeType })
            const url = URL.createObjectURL(blob)
            
            // Update last accessed time
            this.updateLastAccessed(videoId)
            
            console.log(`Created blob URL for video ID ${videoId}`)
            resolve(url)
          } else {
            console.log(`No video file found for ID ${videoId}`)
            resolve(null)
          }
        }
        
        request.onerror = (event) => {
          console.error('Failed to retrieve video file:', event.target.error)
          reject(event.target.error)
        }
      })
    } catch (error) {
      console.error('Error getting video file:', error)
      return null
    }
  }

  // Check if video exists in storage
  async hasVideo(videoId) {
    try {
      await this.ensureDB()
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.count(videoId)
        
        request.onsuccess = () => {
          resolve(request.result > 0)
        }
        
        request.onerror = () => {
          resolve(false)
        }
      })
    } catch (error) {
      console.error('Error checking video existence:', error)
      return false
    }
  }

  // Delete video file
  async deleteVideoFile(videoId) {
    try {
      await this.ensureDB()
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.delete(videoId)
        
        request.onsuccess = () => {
          console.log(`Video file deleted for ID ${videoId}`)
          resolve(true)
        }
        
        request.onerror = (event) => {
          console.error('Failed to delete video file:', event.target.error)
          reject(event.target.error)
        }
      })
    } catch (error) {
      console.error('Error deleting video file:', error)
      return false
    }
  }

  // Update last accessed time
  async updateLastAccessed(videoId) {
    try {
      await this.ensureDB()
      
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(videoId)
      
      request.onsuccess = () => {
        const data = request.result
        if (data) {
          data.lastAccessed = new Date().toISOString()
          store.put(data)
        }
      }
    } catch (error) {
      console.error('Error updating last accessed time:', error)
    }
  }

  // Get all stored videos info (without data)
  async getAllVideosInfo() {
    try {
      await this.ensureDB()
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly')
        const store = transaction.objectStore(this.storeName)
        const request = store.getAll()
        
        request.onsuccess = () => {
          const videos = request.result.map(video => ({
            id: video.id,
            fileName: video.fileName,
            fileSize: video.fileSize,
            fileType: video.fileType,
            savedAt: video.savedAt,
            lastAccessed: video.lastAccessed
          }))
          resolve(videos)
        }
        
        request.onerror = (event) => {
          console.error('Failed to get videos info:', event.target.error)
          reject(event.target.error)
        }
      })
    } catch (error) {
      console.error('Error getting all videos info:', error)
      return []
    }
  }

  // Get storage info
  async getStorageInfo() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        const used = estimate.usage || 0
        const quota = estimate.quota || 0
        const percentUsed = ((used / quota) * 100).toFixed(2)
        
        // Get our database size
        const videos = await this.getAllVideosInfo()
        const totalVideoSize = videos.reduce((total, video) => total + video.fileSize, 0)
        
        return {
          used: this.formatBytes(used),
          quota: this.formatBytes(quota),
          percentUsed: percentUsed + '%',
          videoCount: videos.length,
          totalVideoSize: this.formatBytes(totalVideoSize),
          available: this.formatBytes(quota - used)
        }
      }
      return null
    } catch (error) {
      console.error('Error getting storage info:', error)
      return null
    }
  }

  // Clear all video files (use with caution!)
  async clearAllVideos() {
    try {
      await this.ensureDB()
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.clear()
        
        request.onsuccess = () => {
          console.log('All video files cleared from storage')
          resolve(true)
        }
        
        request.onerror = (event) => {
          console.error('Failed to clear video files:', event.target.error)
          reject(event.target.error)
        }
      })
    } catch (error) {
      console.error('Error clearing all videos:', error)
      return false
    }
  }

  // Helper: Convert File to ArrayBuffer
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        resolve(event.target.result)
      }
      
      reader.onerror = (error) => {
        reject(error)
      }
      
      reader.readAsArrayBuffer(file)
    })
  }

  // Helper: Guess media type from file extension
  guessMediaType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase()
    const mimeTypes = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogg': 'video/ogg',
      'ogv': 'video/ogg',
      'mov': 'video/quicktime',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
      'm4v': 'video/mp4',
      '3gp': 'video/3gpp',
      '3g2': 'video/3gpp2',
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv',
      'f4v': 'video/mp4',
      'mpg': 'video/mpeg',
      'mpeg': 'video/mpeg',
      'mpe': 'video/mpeg',
      'm2v': 'video/mpeg'
    }
    
    return mimeTypes[ext] || 'video/mp4' // Default to mp4
  }

  // Helper: Format bytes to human readable
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }
}

// Create singleton instance
export const videoFileStorage = new VideoFileStorage()

// Also export the class if needed
export default VideoFileStorage