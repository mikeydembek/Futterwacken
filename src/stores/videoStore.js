// This file manages all our video data - like a smart filing cabinet
import { reactive } from 'vue';

// Create our data store
export const videoStore = reactive({
  // Array to hold all videos
  videos: JSON.parse(localStorage.getItem('videos') || '[]'),
  
  // Load videos (for compatibility with new code)
  async loadVideos() {
    this.videos = JSON.parse(localStorage.getItem('videos') || '[]');
    console.log('Loaded videos from storage:', this.videos.length);
  },
  
  // Add a new video
  addVideo(videoData) {
    const video = {
      id: videoData.id || Date.now().toString(),
      title: videoData.title,
      url: videoData.url,
      notes: videoData.notes || '',
      
      // File upload properties
      isFileUpload: videoData.isFileUpload || false,
      fileName: videoData.fileName || null,
      fileSize: videoData.fileSize || null,
      fileType: videoData.fileType || null,
      localFile: videoData.localFile || false,
      hasFile: videoData.hasFile || false,
      
      dateAdded: videoData.dateAdded || new Date().toISOString(),
      
      // Create the spaced repetition schedule
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
    
    // Add to beginning of array
    this.videos.unshift(video);
    this.saveToStorage();
    return video;
  },
  
  // Calculate date for a specific day from now
  getDateForDay(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(9, 0, 0, 0);
    return date.toISOString();
  },
  
  // Get videos that need review today
  getTodaysReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const reminders = [];
    
    this.videos.forEach(video => {
      if (!video.isActive) return;
      
      // Check regular reminders
      if (video.reminders) {
        video.reminders.forEach((reminder, index) => {
          const reminderDate = new Date(reminder.date);
          reminderDate.setHours(0, 0, 0, 0);
          
          if (reminderDate.getTime() === today.getTime()) {
            reminders.push({
              ...video,
              currentReminder: reminder,
              reminderIndex: index
            });
          }
        });
      }
      
      // Check monthly reminders
      if (video.repeatMonthly) {
        const lastDate = new Date(video.repeatMonthly.lastDate);
        const nextMonthly = new Date(lastDate);
        nextMonthly.setMonth(nextMonthly.getMonth() + 1);
        nextMonthly.setHours(0, 0, 0, 0);
        
        if (nextMonthly.getTime() === today.getTime()) {
          reminders.push({
            ...video,
            currentReminder: { 
              day: 'Monthly', 
              date: nextMonthly.toISOString(), 
              completed: false 
            },
            reminderIndex: -1
          });
        }
      }
    });
    
    // Sort by completion status
    reminders.sort((a, b) => {
      if (a.currentReminder.completed === b.currentReminder.completed) {
        return 0;
      }
      return a.currentReminder.completed ? 1 : -1;
    });
    
    return reminders;
  },
  
  // Toggle watched status
  toggleWatched(videoId, reminderIndex) {
    const video = this.videos.find(v => v.id === videoId);
    if (!video) return false;
    
    if (reminderIndex === -1) {
      // Monthly reminder
      video.repeatMonthly.lastDate = new Date().toISOString();
      this.saveToStorage();
      return true;
    } else {
      // Regular reminder
      video.reminders[reminderIndex].completed = !video.reminders[reminderIndex].completed;
      
      // If unchecking day 42, reset the decision
      if (video.reminders[reminderIndex].day === 42 && !video.reminders[reminderIndex].completed) {
        video.repeatMonthly = null;
        video.isActive = true;
      }
      
      this.saveToStorage();
      return video.reminders[reminderIndex].completed;
    }
  },
  
  // Set decision for day 42
  setDay42Decision(videoId, repeatMonthly) {
    const video = this.videos.find(v => v.id === videoId);
    if (!video) return;
    
    if (repeatMonthly) {
      video.repeatMonthly = {
        startDate: new Date().toISOString(),
        lastDate: new Date().toISOString()
      };
    } else {
      video.isActive = false;
    }
    
    this.saveToStorage();
  },
  
  // Save to localStorage
  saveToStorage() {
    localStorage.setItem('videos', JSON.stringify(this.videos));
  },
  
  // Delete a video
  async deleteVideo(videoId) {
    const index = this.videos.findIndex(v => v.id === videoId);
    if (index !== -1) {
      // Delete the video file if it exists
      const video = this.videos[index];
      if (video.isFileUpload || video.hasFile) {
        try {
          const { videoFileStorage } = await import('../utils/videoStorage');
          await videoFileStorage.deleteVideoFile(videoId);
        } catch (error) {
          console.log('No video file to delete or error:', error);
        }
      }
      
      this.videos.splice(index, 1);
      this.saveToStorage();
    }
  },
  
  // Get all videos
  getAllVideos() {
    return this.videos;
  },
  
  // Get active videos only
  getActiveVideos() {
    return this.videos.filter(v => v.isActive);
  },
  
  // Get completed videos
  getCompletedVideos() {
    return this.videos.filter(v => !v.isActive && !v.repeatMonthly);
  },
  
  // Get videos on monthly repeat
  getMonthlyVideos() {
    return this.videos.filter(v => v.repeatMonthly !== null);
  },
  
  // Clear all data
  clearAllData() {
    this.videos = [];
    this.saveToStorage();
  },
  
  // Import videos
  importVideos(videosJson) {
    try {
      const imported = JSON.parse(videosJson);
      if (Array.isArray(imported)) {
        this.videos = imported;
        this.saveToStorage();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  },
  
  // Export videos
  exportVideos() {
    return JSON.stringify(this.videos, null, 2);
  },
  
  // Compatibility methods for other components
  getUpcomingReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminders = [];
    
    this.videos.forEach(video => {
      if (!video.isActive && !video.repeatMonthly) return;
      
      if (video.reminders) {
        video.reminders.forEach((reminder, index) => {
          const reminderDate = new Date(reminder.date);
          reminderDate.setHours(0, 0, 0, 0);
          if (reminderDate > today) {
            reminders.push({
              ...video,
              currentReminder: reminder,
              reminderIndex: index
            });
          }
        });
      }
    });
    
    return reminders;
  },
  
  getPastReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminders = [];
    
    this.videos.forEach(video => {
      if (!video.isActive && !video.repeatMonthly) return;
      
      if (video.reminders) {
        video.reminders.forEach((reminder, index) => {
          const reminderDate = new Date(reminder.date);
          reminderDate.setHours(0, 0, 0, 0);
          if (reminderDate < today && !reminder.completed) {
            reminders.push({
              ...video,
              currentReminder: reminder,
              reminderIndex: index
            });
          }
        });
      }
    });
    
    return reminders;
  }
});