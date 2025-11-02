<template>
<div class="today-view">
  <!-- Summary badges -->
  <div class="summary-badges">
    <span class="badge badge-total">Total: {{ todaysVideos.length }}</span>
    <span class="badge badge-completed">Completed: {{ completedCount }}</span>
    <span class="badge badge-pending">Pending: {{ pendingCount }}</span>
  </div>

  <div class="reminders-container">
    <!-- Empty state -->
    <div v-if="todaysVideos.length === 0" class="empty-state">
      <h2 class="empty-title">No videos for today</h2>
    </div>

    <template v-else>
      <!-- To Watch -->
      <div v-if="pendingVideos.length > 0" class="section">
        <div
          v-for="reminder in pendingVideos"
          :key="reminder.id + '-' + reminder.reminderIndex"
          class="reminder-card card-pending"
        >
          <!-- Main row: blue round play left, centered title, round toggle right -->
          <div class="card-main">
            <!-- Left: Play -->
            <button
              class="play-btn play-btn-blue"
              @click="openVideoPlayer(reminder)"
              aria-label="Play video"
            >
              <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7-11-7z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
              </svg>
            </button>

            <!-- Center: Title + Info grouped and centered together -->
            <div class="title-group">
              <h3 class="video-title center">{{ reminder.title }}</h3>
              <div class="info-row">
                <span class="day-badge small">
                  {{ getReminderDayText(reminder.currentReminder) }}
                </span>
                <span class="meta-pill small">
                  <span class="meta-dot" :class="reminder.isFileUpload ? 'dot-file' : 'dot-link'"></span>
                  {{ reminder.isFileUpload ? 'Uploaded file' : 'Video link' }}
                </span>
              </div>
            </div>

            <!-- Right: Round check toggle -->
            <button
              class="check-circle"
              :class="{'is-checked': reminder.currentReminder && reminder.currentReminder.completed}"
              @click="handleToggleWatched(reminder)"
              :aria-pressed="reminder.currentReminder && reminder.currentReminder.completed ? 'true' : 'false'"
              aria-label="Mark as watched"
            >
              <svg v-if="reminder.currentReminder && reminder.currentReminder.completed" class="icon-check" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <!-- Notes (clamped) -->
          <p v-if="reminder.notes" class="video-notes clamp-2">
            {{ reminder.notes }}
          </p>

          <!-- Day 42 decision -->
          <div
            v-if="
              reminder.currentReminder &&
              reminder.currentReminder.day === 42 &&
              reminder.currentReminder.completed &&
              showDay42Decision[reminder.id]
            "
            class="day42-decision"
          >
            <p class="decision-title">🎯 You've completed the initial learning cycle!</p>
            <p class="text-muted">Would you like to review this video monthly?</p>
            <div class="decision-buttons">
              <button class="btn btn-primary" @click="setDay42Decision(reminder.id, true)">
                📅 Review Monthly
              </button>
              <button class="btn btn-secondary" @click="setDay42Decision(reminder.id, false)">
                ✅ Complete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Watched Today -->
      <div v-if="completedVideos.length > 0" class="section">
        <div
          v-for="reminder in completedVideos"
          :key="reminder.id + '-' + reminder.reminderIndex + '-done'"
          class="reminder-card card-completed"
        >
          <div class="card-main">
            <!-- Left: Replay - CHANGED TO USE PNG IMAGE -->
            <button
              class="replay-btn"
              @click="openVideoPlayer(reminder)"
              aria-label="Replay video"
            >
              <img 
                src="/icons/img/icon-replay.png" 
                alt="Replay" 
                class="icon-replay-img"
              />
            </button>

            <!-- Center: Title + Info -->
            <div class="title-group">
              <h3 class="video-title center">{{ reminder.title }}</h3>
              <div class="info-row">
                <span class="day-badge small">
                  {{ getReminderDayText(reminder.currentReminder) }}
                </span>
                <span class="meta-pill small">
                  <span class="meta-dot" :class="reminder.isFileUpload ? 'dot-file' : 'dot-link'"></span>
                  {{ reminder.isFileUpload ? 'Uploaded file' : 'Video link' }}
                </span>
              </div>
            </div>

            <!-- Right: Round check toggle (checked) -->
            <button
              class="check-circle is-checked"
              @click="handleToggleWatched(reminder)"
              aria-pressed="true"
              aria-label="Unmark as watched"
            >
              <svg class="icon-check" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>

          <p v-if="reminder.notes" class="video-notes clamp-2">
            {{ reminder.notes }}
          </p>
        </div>
      </div>
    </template>
  </div>

  <!-- Video Player Modal -->
  <VideoPlayer
    :video="selectedVideo"
    :is-open="isPlayerOpen"
    @close="closeVideoPlayer"
    @mark-watched="markVideoWatched"
  />
</div>
</template>

<script>
import { videoStore } from '../stores/videoStore';
import VideoPlayer from '../components/VideoPlayer.vue';

export default {
name: 'TodayReminders',
components: { VideoPlayer },
data() {
  return {
    showDay42Decision: {},
    selectedVideo: null,
    isPlayerOpen: false
  };
},
computed: {
  todaysVideos() {
    if (!videoStore || !videoStore.getTodaysReminders) return [];
    return videoStore.getTodaysReminders();
  },
  pendingVideos() {
    return this.todaysVideos.filter(v => !v.currentReminder.completed);
  },
  completedVideos() {
    return this.todaysVideos.filter(v => v.currentReminder.completed);
  },
  completedCount() {
    return this.completedVideos.length;
  },
  pendingCount() {
    return this.pendingVideos.length;
  }
},
methods: {
  getReminderDayText(reminder) {
    if (!reminder) return '';
    if (reminder.day === 'Monthly') return '📅 Monthly Review';
    const dayText = {
      1: 'Day 1 - Initial',
      2: 'Day 2 - First Review',
      5: 'Day 5 - Reinforcement',
      12: 'Day 12 - Consolidation',
      42: 'Day 42 - Final Review'
    };
    return dayText[reminder.day] || `Day ${reminder.day}`;
  },
  openVideoPlayer(reminder) {
    this.selectedVideo = reminder;
    this.isPlayerOpen = true;
  },
  closeVideoPlayer() {
    this.isPlayerOpen = false;
    this.selectedVideo = null;
  },
  markVideoWatched() {
    if (this.selectedVideo && this.selectedVideo.currentReminder && !this.selectedVideo.currentReminder.completed) {
      this.handleToggleWatched(this.selectedVideo);
    }
  },
  handleToggleWatched(reminder) {
    if (!videoStore.toggleWatched) return;
    const isNowCompleted = videoStore.toggleWatched(reminder.id, reminder.reminderIndex);
    if (reminder.currentReminder) {
      this.showDay42Decision[reminder.id] = reminder.currentReminder.day === 42 && isNowCompleted;
    }
    this.$forceUpdate();
  },
  setDay42Decision(videoId, repeatMonthly) {
    if (!videoStore.setDay42Decision) return;
    videoStore.setDay42Decision(videoId, repeatMonthly);
    this.showDay42Decision[videoId] = false;
    this.$forceUpdate();
  }
}
};
</script>

<style scoped>
.today-view {
height: 100%;
overflow-y: auto;
padding-bottom: 80px;
/* New, darker gray background */
background: #1F2937;
}

.summary-badges {
display: flex;
justify-content: center;
align-items: center;
gap: var(--space-sm);
padding: var(--space-md);
padding-bottom: 0;
position: relative; /* Required for z-index to work */
z-index: 2;        /* Make sure badges are above the gradient overlay */
}

.badge {
width: 104px;
height: 28px;
border-radius: var(--radius-full);
color: #ffffff;
font-size: 12px;
font-weight: 600;
letter-spacing: 0.2px;
display: flex;
align-items: center;
justify-content: center;
/* UPDATED: Added thin light gray border */
border: 1px solid #9CA3AF;
/* UPDATED: Added shadow hovering effect */
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
}

/* Backgrounds per spec */
.badge-total { background: var(--bg-tertiary); }
/* UPDATED: Brighter color for completed badge */
.badge-completed { background: rgba(0, 0,255, 100) }
.badge-pending { background: var(--accent-primary); }

/* Sections */
.reminders-container { padding: var(--space-md); }
.section { margin-top: var(--space-lg); }

/* Hide section headlines */
.section-title { display: none; }

/* Cards: pill shape with shadow */
.reminder-card {
border-radius: 15px;
overflow: hidden;
padding: var(--space-md);
margin-bottom: var(--space-md);
border: 1px solid var(--bg-tertiary);
/* New shadow to create a "hovering" effect */
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
}
/* UNCHECKED: light tint + light grey outline */
.card-pending {
background: rgba(156, 163, 175, 0.10);
border: 1px solid #6B7280;
}
.card-completed {
background: rgba(75, 81, 90, 100);
border: 2px solid rgba(156, 163, 175, 0.35);
}

/* Minimal main row: grid to center title-group with left/right controls */
.card-main {
display: grid;
grid-template-columns: 40px 1fr 20px;
align-items: center;
min-height: 48px;
gap: var(--space-md);
}

/* Centered column holding title + info */
.title-group {
justify-self: center;
display: flex;
flex-direction: column;
align-items: center;
gap: 2px;
}

/* Blue round play button */
.play-btn {
width: 40px;
height: 40px;
border-radius: 9999px;
border: none;
background: var(--accent-primary);
display: grid;
place-items: center;
padding: 0;
transition: box-shadow 0.15s ease, transform 0.1s ease;
cursor: pointer;
}
.play-btn:active { transform: scale(0.98); }

.play-btn:hover,
.play-btn:active,
.play-btn:focus,
.play-btn:focus-visible {
box-shadow: 0 0 0 2px #ffffff;
outline: none;
}

/* Replay button */
.replay-btn {
width: 40px;
height: 40px;
border-radius: 9999px;
background: #ffffff;
border: none;
display: grid;
place-items: center;
padding: 0;
transition: box-shadow 0.15s ease, transform 0.1s ease;
color: var(--accent-primary);
cursor: pointer;
}
.replay-btn:active { transform: scale(0.98); }

.replay-btn:hover,
.replay-btn:active,
.replay-btn:focus,
.replay-btn:focus-visible {
box-shadow: 0 0 0 2px var(--accent-primary);
outline: none;
}

/* Icons */
.icon-play, .icon-replay {
width: 24px;
height: 24px;
display: block;
}
.icon-play path {
fill: #fff;
stroke: #fff;
stroke-width: 2;
stroke-linejoin: round;
stroke-linecap: round;
}
.icon-replay path { stroke: currentColor; }

/* PNG Replay icon */
.icon-replay-img {
width: 38px;
height: 38px;
display: block;
}

/* Title */
.video-title {
margin: 0;
font-size: 16px;
font-weight: 600;
color: var(--text-primary);
}
.video-title.center { text-align: center; }

/* Round check toggle */
.check-circle {
width: 20px;
height: 20px;
border-radius: 9999px;
background: #ffffff;
border: none;
display: grid;
place-items: center;
padding: 0;
cursor: pointer;
transition: transform 0.1s ease;
}
.check-circle:active { transform: scale(0.98); }
.check-circle.is-checked { background: var(--accent-primary); }
.icon-check {
width: 14px;
height: 14px;
display: block;
}

/* Centered info row (10px) inside title-group */
.info-row {
display: flex;
justify-content: center;
align-items: center;
gap: 8px;
}
.info-row .day-badge.small { font-size: 10px; }
.info-row .meta-pill.small { font-size: 10px; }

/* Day badge + meta pill base styles */
.day-badge {
color: var(--accent-primary);
font-size: 12px;
font-weight: 600;
white-space: nowrap;
}
.meta-pill {
display: inline-flex;
align-items: center;
gap: 6px;
padding: 4px 8px;
border-radius: var(--radius-full);
font-size: 12px;
color: var(--text-secondary);
background: var(--bg-tertiary);
}
.meta-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.dot-file { background: var(--text-secondary); }
.dot-link { background: var(--accent-primary); }

/* Notes */
.video-notes {
margin-top: var(--space-sm);
color: var(--text-secondary);
font-size: 14px;
line-height: 1.4;
}
.clamp-2 {
display: -webkit-box;
-webkit-line-clamp: 2;
-webkit-box-orient: vertical;
overflow: hidden;
}

/* Day 42 decision panel */
.day42-decision {
margin-top: var(--space-md);
padding: var(--space-md);
background: var(--bg-tertiary);
border-radius: var(--radius-md);
}
.decision-title { font-weight: 600; margin-bottom: var(--space-sm); }
.decision-buttons {
display: flex;
gap: var(--space-sm);
margin-top: var(--space-md);
}

/* Empty state */
.empty-state { text-align: center; padding: var(--space-xl); }
.empty-title { font-size: 16px; font-weight: 600; }

</style>
