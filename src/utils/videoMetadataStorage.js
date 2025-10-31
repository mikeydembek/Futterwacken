class VideoMetadataStorage {
  constructor() {
    this.dbName = 'FutterwackenVideoData';
    this.dbVersion = 1;
    this.storeName = 'videos';
    this.db = null;
  }

  async initDB() {
    return new Promise((resolve, reject) => {
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

  async getAllVideos() {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async saveAllVideos(videos) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        videos.forEach(video => store.put(video));
      };
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = (event) => reject(event.target.error);
    });
  }
}

export const videoMetadataStorage = new VideoMetadataStorage();