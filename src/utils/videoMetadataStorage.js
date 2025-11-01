class VideoMetadataStorage {
  constructor() {
    this.db = null;
    this.dbName = 'FutterwackenVideoData';
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
          console.error('IndexedDB open failed:', request.error);
          this.initPromise = null;
          reject(new Error('Failed to open IndexedDB'));
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          console.log('IndexedDB initialized successfully');
          resolve();
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('videos')) {
            db.createObjectStore('videos', { keyPath: 'id' });
            console.log('Created videos object store');
          }
        };
      } catch (error) {
        console.error('Error opening IndexedDB:', error);
        this.initPromise = null;
        reject(error);
      }
    });
    
    return this.initPromise;
  }

  async getAllVideos() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['videos'], 'readonly');
        const store = transaction.objectStore('videos');
        const request = store.getAll();
        
        request.onsuccess = () => {
          resolve(request.result || []);
        };
        
        request.onerror = () => {
          console.error('Error getting all videos:', request.error);
          reject(new Error('Failed to get videos'));
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }

  async saveVideo(video) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        const request = store.put(video);
        
        request.onsuccess = () => {
          resolve();
        };
        
        request.onerror = () => {
          console.error('Error saving video:', request.error);
          reject(new Error('Failed to save video'));
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }

  async deleteVideo(id) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        const request = store.delete(id);
        
        request.onsuccess = () => {
          resolve();
        };
        
        request.onerror = () => {
          console.error('Error deleting video:', request.error);
          reject(new Error('Failed to delete video'));
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }

  async clearAll() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        const request = store.clear();
        
        request.onsuccess = () => {
          resolve();
        };
        
        request.onerror = () => {
          console.error('Error clearing videos:', request.error);
          reject(new Error('Failed to clear videos'));
        };
      } catch (error) {
        console.error('Transaction error:', error);
        reject(error);
      }
    });
  }
}

export const videoMetadataStorage = new VideoMetadataStorage();