class VideoFileStorage {
  constructor() {
    this.db = null;
    this.dbName = 'VideoLearningDB';
    this.version = 1;
    this.initPromise = null;
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    if (this.db) return Promise.resolve();
    
    this.initPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, this.version);
        
        request.onerror = () => {
          console.error('VideoFileStorage open failed:', request.error);
          this.initPromise = null;
          reject(new Error('Failed to open VideoFileStorage'));
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          console.log('VideoFileStorage initialized');
          resolve();
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('videos')) {
            db.createObjectStore('videos', { keyPath: 'id' });
          }
        };
      } catch (error) {
        console.error('Error opening VideoFileStorage:', error);
        this.initPromise = null;
        reject(error);
      }
    });
    
    return this.initPromise;
  }

  async saveVideo(id, arrayBuffer) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        const request = store.put({ id: id, data: arrayBuffer });
        
        request.onsuccess = () => {
          console.log('Video file saved');
          resolve();
        };
        
        request.onerror = () => {
          console.error('Error saving video file:', request.error);
          reject(new Error('Failed to save video file'));
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }

  async getVideo(id) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['videos'], 'readonly');
        const store = transaction.objectStore('videos');
        const request = store.get(id);
        
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.data) {
            resolve(result.data);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => {
          console.error('Error getting video file:', request.error);
          reject(new Error('Failed to get video file'));
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }

  async getVideoUrl(id) {
    try {
      const arrayBuffer = await this.getVideo(id);
      if (!arrayBuffer) return null;
      
      const blob = new Blob([arrayBuffer], { type: 'video/mp4' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating video URL:', error);
      return null;
    }
  }

  async deleteVideo(id) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        const request = store.delete(id);
        
        request.onsuccess = () => {
          console.log('Video file deleted');
          resolve();
        };
        
        request.onerror = () => {
          console.error('Error deleting video file:', request.error);
          reject(new Error('Failed to delete video file'));
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }
}

export const videoFileStorage = new VideoFileStorage();