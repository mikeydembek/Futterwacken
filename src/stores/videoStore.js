// src/stores/videoStore.js
import { reactive } from 'vue';
import { videoMetadataStorage } from '../utils/videoMetadataStorage';

export const videoStore = reactive({
  videos: [],

  async loadVideos() {
    try {
      this.videos = await videoMetadataStorage.getAllVideos();
    } catch (e) {
      console.error("Failed to load videos from DB.", e);
      this.videos = JSON.parse(localStorage.getItem('videos') || '[]');
    }
  },

  async saveToStorage() {
    try {
      await videoMetadataStorage.saveAllVideos(this.videos);
      localStorage.setItem('videos', JSON.stringify(this.videos));
    } catch (e) {
      console.error("Failed to save videos to DB.", e);
    }
  },

  async addVideo(videoData) {
    const video = {
      id: videoData.id || Date.now().toString(),
      title: videoData.title,
      url: videoData.url,
      notes: videoData.notes || '',
      isFileUpload: videoData.isFileUpload || false,
      fileName: videoData.fileName || null,
      fileSize: videoData.fileSize || null,
      fileType: videoData.fileType || null,
      localFile: videoData.localFile || false,
      dateAdded: new Date().toISOString(),
      reminders: [
        { day: 1, date: this.getDateForDay(0), completed: true },
        { day: 2, date: this.getDateForDay(1), completed: false },
        { day: 5, date: this.getDateForDay(4), completed: false },
        { day: 12, date: this.getDateForDay(11), completed: false },
        { day: 42, date: this.getDateForDay(41), completed: false }
      ],
      repeatMonthly: null,
      isActive: true
    };
    this.videos.unshift(video);
    await this.saveToStorage();
    return video;
  },

  async toggleWatched(videoId, reminderIndex) {
    const video = this.videos.find(v => v.id === videoId);
    if (!video || !video.reminders || !video.reminders[reminderIndex]) return false;
    
    video.reminders[reminderIndex].completed = !video.reminders[reminderIndex].completed;
    await this.saveToStorage();
    return video.reminders[reminderIndex].completed;
  },
  
  async setDay42Decision(videoId, repeatMonthly) {
    const video = this.videos.find(v => v.id === videoId);
    if (!video) return;
    video.repeatMonthly = repeatMonthly ? { startDate: new Date().toISOString(), lastDate: new Date().toISOString() } : null;
    if (!repeatMonthly) video.isActive = false;
    await this.saveToStorage();
  },

  getDateForDay(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(9, 0, 0, 0);
    return date.toISOString();
  },

  getTodaysReminders() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const reminders = [];
    this.videos.forEach(video => {
      if (!video.isActive) return;
      video.reminders?.forEach((reminder) => {
        const rDate = new Date(reminder.date); rDate.setHours(0, 0, 0, 0);
        if (rDate.getTime() === today.getTime()) {
          reminders.push({ ...video, currentReminder: reminder });
        }
      });
    });
    reminders.sort((a, b) => (a.currentReminder.completed ? 1 : 0) - (b.currentReminder.completed ? 1 : 0));
    return reminders;
  }
});