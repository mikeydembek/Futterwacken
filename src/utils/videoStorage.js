// Video file storage using IndexedDB
class VideoFileStorage {
  constructor() {
    this.dbName = 'VideoLearningDB';
    this.dbVersion = 2; // Increment version to force upgrade
    this.storeName = 'videoFiles';
    this.db = null;
    this.initPromise = null;
  }

  async initDB() {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.error('IndexedDB is not supported in this browser');
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Delete old object stores if they exist with different names
        const oldStoreNames = ['videos', 'videoFiles'];
        oldStoreNames.forEach(storeName => {
          if (db.objectStoreNames.contains(storeName) && storeName !== this.storeName) {
            db.deleteObjectStore(storeName);
            console.log(`Deleted old object store: ${storeName}`);
          }
        });
        
        // Create the object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('videoId', 'videoId', { unique: true });
          store.createIndex('fileName', 'fileName', { unique: false });
          console.log('Created video files object store');
        }
      };
      
      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('VideoFileStorage initialized successfully');
        console.log('Available object stores:', Array.from(this.db.objectStoreNames));
        resolve(this.db);
      };
      
      request.onerror = (event) => {
        console.error('Failed to open IndexedDB:', event.target.error);
        this.initPromise = null;
        reject(event.target.error);
      };

      request.onblocked = () => {
        console.warn('Database upgrade blocked - please close other tabs');
        this.initPromise = null;
      };
    });
    
    return this.initPromise;
  }

  async ensureDB() {
    if (!this.db || this.db.version !== this.dbVersion) {
      await this.initDB();
    }
    return this.db;
  }

  async saveVideoFile(videoId, file) {
    try {
      await this.ensureDB();
      
      console.log(`Saving video file for ID ${videoId}`);
      console.log(`File details: ${file.name}, Size: ${this.formatBytes(file.size)}, Type: ${file.type}`);
      
      const arrayBuffer = await this.fileToArrayBuffer(file);
      
      const videoData = {
        id: videoId,
        videoId: videoId,
        fileName: file.name,
        fileType: file.type || this.guessMediaType(file.name),
        fileSize: file.size,
        data: arrayBuffer,
        savedAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          const request = store.put(videoData);
          
          request.onsuccess = () => {
            console.log(`Video file saved successfully for ID ${videoId}`);
            resolve(true);
          };
          
          request.onerror = (event) => {
            console.error('Failed to save video file:', event.target.error);
            reject(event.target.error);
          };
          
          transaction.oncomplete = () => {
            console.log('Transaction completed successfully');
          };
          
          transaction.onerror = (event) => {
            console.error('Transaction failed:', event.target.error);
            reject(event.target.error);
          };
        } catch (error) {
          console.error('Error creating transaction:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error saving video file:', error);
      throw error;
    }
  }

  async getVideoUrl(videoId) {
    try {
      await this.ensureDB();
      
      console.log(`Retrieving video file for ID ${videoId}`);
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db.transaction([this.storeName], 'readonly');
          const store = transaction.objectStore(this.storeName);
          const request = store.get(videoId);
          
          request.onsuccess = () => {
            const result = request.result;
            
            if (result && result.data) {
              console.log(`Found video file: ${result.fileName}`);
              
              let mimeType = result.fileType || this.guessMediaType(result.fileName);
              console.log(`Using MIME type: ${mimeType}`);
              
              const blob = new Blob([result.data], { type: mimeType });
              const url = URL.createObjectURL(blob);
              
              this.updateLastAccessed(videoId);
              
              console.log(`Created blob URL for video ID ${videoId}`);
              resolve(url);
            } else {
              console.log(`No video file found for ID ${videoId}`);
              resolve(null);
            }
          };
          
          request.onerror = (event) => {
            console.error('Failed to retrieve video file:', event.target.error);
            resolve(null); // Return null instead of rejecting
          };
        } catch (error) {
          console.error('Error creating transaction:', error);
          resolve(null);
        }
      });
    } catch (error) {
      console.error('Error getting video file:', error);
      return null;
    }
  }

  async deleteVideoFile(videoId) {
    try {
      await this.ensureDB();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          const request = store.delete(videoId);
          
          request.onsuccess = () => {
            console.log(`Video file deleted for ID ${videoId}`);
            resolve(true);
          };
          
          request.onerror = (event) => {
            console.error('Failed to delete video file:', event.target.error);
            resolve(false); // Return false instead of rejecting
          };
        } catch (error) {
          console.error('Error creating transaction:', error);
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Error deleting video file:', error);
      return false;
    }
  }

  async updateLastAccessed(videoId) {
    try {
      await this.ensureDB();
      
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(videoId);
      
      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          data.lastAccessed = new Date().toISOString();
          store.put(data);
        }
      };
    } catch (error) {
      console.error('Error updating last accessed time:', error);
    }
  }

  async getAllVideosInfo() {
    try {
      await this.ensureDB();
      
      return new Promise((resolve) => {
        try {
          const transaction = this.db.transaction([this.storeName], 'readonly');
          const store = transaction.objectStore(this.storeName);
          const request = store.getAll();
          
          request.onsuccess = () => {
            const videos = request.result.map(video => ({
              id: video.id,
              fileName: video.fileName,
              fileSize: video.fileSize,
              fileType: video.fileType,
              savedAt: video.savedAt,
              lastAccessed: video.lastAccessed
            }));
            resolve(videos);
          };
          
          request.onerror = () => {
            console.error('Failed to get videos info');
            resolve([]);
          };
        } catch (error) {
          console.error('Error creating transaction:', error);
          resolve([]);
        }
      });
    } catch (error) {
      console.error('Error getting all videos info:', error);
      return [];
    }
  }

  async clearAllVideos() {
    try {
      await this.ensureDB();
      
      return new Promise((resolve) => {
        try {
          const transaction = this.db.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          const request = store.clear();
          
          request.onsuccess = () => {
            console.log('All video files cleared from storage');
            resolve(true);
          };
          
          request.onerror = () => {
            console.error('Failed to clear video files');
            resolve(false);
          };
        } catch (error) {
          console.error('Error creating transaction:', error);
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Error clearing all videos:', error);
      return false;
    }
  }

  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target.result);
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  guessMediaType(fileName) {
    if (!fileName) return 'video/mp4';
    
    const ext = fileName.split('.').pop().toLowerCase();
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
      'wmv': 'video/x-ms-wmv',
      'flv': 'video/x-flv'
    };
    
    return mimeTypes[ext] || 'video/mp4';
  }

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Compatibility methods
  async hasVideo(videoId) {
    try {
      await this.ensureDB();
      
      return new Promise((resolve) => {
        try {
          const transaction = this.db.transaction([this.storeName], 'readonly');
          const store = transaction.objectStore(this.storeName);
          const request = store.count(videoId);
          
          request.onsuccess = () => {
            resolve(request.result > 0);
          };
          
          request.onerror = () => {
            resolve(false);
          };
        } catch (error) {
          console.error('Error checking video existence:', error);
          resolve(false);
        }
      });
    } catch (error) {
      console.error('Error checking video existence:', error);
      return false;
    }
  }

  async getStorageInfo() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentUsed = quota > 0 ? ((used / quota) * 100).toFixed(2) : '0';
        
        const videos = await this.getAllVideosInfo();
        const totalVideoSize = videos.reduce((total, video) => total + (video.fileSize || 0), 0);
        
        return {
          used: this.formatBytes(used),
          quota: this.formatBytes(quota),
          percentUsed: percentUsed + '%',
          videoCount: videos.length,
          totalVideoSize: this.formatBytes(totalVideoSize),
          available: this.formatBytes(Math.max(0, quota - used))
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  }
}

// Create singleton instance
export const videoFileStorage = new VideoFileStorage();

// Also export the class if needed
export default VideoFileStorage;