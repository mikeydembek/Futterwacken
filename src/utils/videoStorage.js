// src/utils/videoStorage.js
class VideoFileStorage {
  constructor() {
    this.dbName = 'VideoLearningDB';
    this.dbVersion = 1;
    this.storeName = 'videoFiles';
    this.db = null;
    this.initDB();
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = (event) => { this.db = event.target.result; resolve(this.db); };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async ensureDB() {
    if (!this.db) await this.initDB();
    return this.db;
  }

  async saveVideoFile(videoId, file) {
    const db = await this.ensureDB();
    const arrayBuffer = await file.arrayBuffer();
    const videoData = {
      id: videoId, data: arrayBuffer,
      fileName: file.name, fileType: file.type || this.guessMediaType(file.name)
    };
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(videoData);
      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getVideoUrl(videoId) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(videoId);
      request.onsuccess = () => {
        if (request.result && request.result.data) {
          const blob = new Blob([request.result.data], { type: request.result.fileType });
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(null);
        }
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  guessMediaType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const mimeTypes = { 'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime' };
    return mimeTypes[ext] || 'video/mp4';
  }
}

// THIS LINE IS THE FIX
export const videoFileStorage = new VideoFileStorage();