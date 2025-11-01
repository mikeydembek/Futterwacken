import { reactive } from 'vue';
import { videoMetadataStorage } from '../utils/videoMetadataStorage';

export const videoStore = reactive({
  videos: [],
  
  async loadVideos() {
    try {
      const videos = await videoMetadataStorage.getAllVideos();
      this.videos = videos || [];
      console.log('Loaded videos from storage:', this.videos.length);
    } catch (error) {
      console.error('Error loading videos:', error);
      this.videos = [];
    }
  },
  
  async saveToStorage() {
    try {
      for (const video of this.videos) {
        await videoMetadataStorage.saveVideo(video);
      }
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  },
  
  async addVideo(video) {
    this.videos.push(video);
    await this.saveToStorage();
  },
  
  async updateVideo(updatedVideo) {
    const index = this.videos.findIndex(v => v.id === updatedVideo.id);
    if (index !== -1) {
      this.videos[index] = updatedVideo;
      await this.saveToStorage();
    }
  },
  
  async deleteVideo(id) {
    const index = this.videos.findIndex(v => v.id === id);
    if (index !== -1) {
      this.videos.splice(index, 1);
      await videoMetadataStorage.deleteVideo(id);
    }
  },
  
  async toggleWatched(id, reminderDate) {
    const video = this.videos.find(v => v.id === id);
    if (video && video.reminders) {
      const reminder = video.reminders.find(r => r.date === reminderDate);
      if (reminder) {
        reminder.watched = !reminder.watched;
        await this.saveToStorage();
      }
    }
  },
  
  getTodaysReminders() {
    const today = new Date().toDateString();
    return this.videos.filter(video => {
      return video.reminders && video.reminders.some(r => r.date === today);
    });
  },
  
  getUpcomingReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.videos.filter(video => {
      if (!video.reminders) return false;
      return video.reminders.some(reminder => {
        const reminderDate = new Date(reminder.date);
        reminderDate.setHours(0, 0, 0, 0);
        return reminderDate > today;
      });
    });
  },
  
  getPastReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.videos.filter(video => {
      if (!video.reminders) return false;
      return video.reminders.some(reminder => {
        const reminderDate = new Date(reminder.date);
        reminderDate.setHours(0, 0, 0, 0);
        return reminderDate < today && !reminder.watched;
      });
    });
  }
});