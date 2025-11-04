<template>
<div class="calendar-view">
  <!-- Month Navigation -->
  <div class="month-nav">
    <button class="nav-btn" @click="previousMonth" aria-label="Previous month">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <h2 class="month-title">{{ monthYearDisplay }}</h2>

    <button class="nav-btn" @click="nextMonth" aria-label="Next month">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>

  <!-- Calendar Container -->
  <div class="calendar-container">
    <!-- Weekday headers -->
    <div class="weekdays">
      <div v-for="day in weekdays" :key="day" class="weekday">
        {{ day }}
      </div>
    </div>

    <!-- Calendar grid -->
    <div class="calendar-grid">
      <button
        v-for="day in calendarDays"
        :key="day.dateString"
        @click="selectDay(day)"
        :class="['calendar-day', {
          'other-month': !day.isCurrentMonth,
          'today': day.isToday,
          'selected': day.dateString === selectedDate,
        }]"
      >
        <span class="day-number">{{ day.dayNumber }}</span>

        <!-- Reminder dots -->
        <div class="reminder-dots" v-if="day.reminders.length">
          <span
            v-for="(rem, i) in day.reminders.slice(0, 3)"
            :key="i"
            class="dot"
            :class="getDotClass(rem)"
          />
          <span v-if="day.reminders.length > 3" class="more">+{{ day.reminders.length - 3 }}</span>
        </div>
      </button>
    </div>
  </div>

  <!-- Selected Day Details -->
  <div v-if="selectedDate" class="day-details">
    <div class="details-card">
      <h3 class="details-title">{{ selectedDateDisplay }}</h3>

      <div v-if="selectedDayReminders.length === 0" class="details-empty">
        No videos for this day
      </div>

      <div v-else class="reminder-list">
        <div
          v-for="rem in selectedDayReminders"
          :key="rem.id + '-' + (rem.reminderIndex !== undefined ? rem.reminderIndex : 'm')"
          class="reminder-item"
        >
          <!-- Centered title + info group -->
          <div class="item-center">
            <div class="item-title">{{ rem.title }}</div>
            <div class="mini-info">
              <span class="mini-badge">{{ getReminderDayText(rem.currentReminder) }}</span>
              <span class="meta-pill small">
                <span class="meta-dot" :class="rem.isFileUpload ? 'dot-file' : 'dot-link'"></span>
                {{ rem.isFileUpload ? 'Uploaded' : 'Link' }}
              </span>
            </div>
          </div>

          <span class="status-badge" :class="getStatusClass(rem)">
            {{ getStatusText(rem) }}
          </span>

          <!-- NEW: Edit button (pencil icon) -->
          <button
            class="icon-btn edit-btn"
            @click="openEdit(rem)"
            aria-label="Edit video"
            title="Edit video"
          >
            <svg class="pencil-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 21h4l11.5-11.5a2.121 2.121 0 0 0 0-3l-1-1a2.121 2.121 0 0 0-3 0L3 16v5z" />
              <path d="M14 7l3 3" />
            </svg>
          </button>

          <!-- Delete button: simple trash can icon, currentColor stroke -->
          <button
            class="icon-btn delete-btn"
            @click="confirmDelete(rem)"
            aria-label="Delete video"
            title="Delete video"
          >
            <svg class="trash-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- NEW: Edit Modal -->
  <div v-if="showEditModal" class="modal-overlay" @click="closeEdit">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Edit Video</h3>
        <button class="close-btn" @click="closeEdit" aria-label="Close">✕</button>
      </div>

      <div class="modal-body">
        <div class="form-row">
          <label class="label" for="edit-title">Title</label>
          <input
            id="edit-title"
            class="input"
            type="text"
            v-model.trim="editDraftTitle"
            maxlength="100"
            placeholder="Enter title"
          />
        </div>

        <div class="form-row">
          <label class="label" for="edit-notes">Notes</label>
          <textarea
            id="edit-notes"
            class="input textarea"
            rows="4"
            v-model="editDraftNotes"
            placeholder="Add notes"
            maxlength="500"
          ></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn btn-secondary" @click="closeEdit">Cancel</button>
        <button class="btn btn-primary" :disabled="!editDraftTitle" @click="saveEdit">Save</button>
      </div>
    </div>
  </div>
</div>
</template>

<script>
import { videoStore } from '../stores/videoStore';

export default {
name: 'Calendar',
data() {
  return {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedDate: null,
    weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],

    // NEW: edit modal state
    showEditModal: false,
    editingVideoId: null,
    editDraftTitle: '',
    editDraftNotes: ''
  };
},
computed: {
  monthYearDisplay() {
    const date = new Date(this.currentYear, this.currentMonth);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  },
  calendarDays() {
    const days = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const startDate = new Date(firstDay);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // start on Sunday of the first week shown
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const dateString = this.getDateString(date);
      const reminders = this.getRemindersForDate(date);

      days.push({
        date,
        dateString,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === this.currentMonth,
        isToday: date.getTime() === today.getTime(),
        reminders
      });
    }
    return days;
  },
  selectedDayReminders() {
    if (!this.selectedDate) return [];
    const found = this.calendarDays.find(function(d) { return d.dateString === this.selectedDate; }.bind(this));
    return found ? found.reminders : [];
  },
  selectedDateDisplay() {
    if (!this.selectedDate) return '';
    const parts = this.selectedDate.split('-');
    const y = +parts[0];
    const m = +parts[1] - 1;
    const d = +parts[2];
    const date = new Date(y, m, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  },
  monthRemindersCount() {
    return this.calendarDays.reduce(function(sum, d) {
      return sum + (d.isCurrentMonth ? d.reminders.length : 0);
    }, 0);
  },
  completedCount() {
    return this.calendarDays.reduce(function(sum, d) {
      if (!d.isCurrentMonth) return sum;
      return sum + d.reminders.filter(function(r) { return r.currentReminder && r.currentReminder.completed; }).length;
    }, 0);
  },
  pendingCount() {
    return this.monthRemindersCount - this.completedCount;
  }
},
methods: {
  previousMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.selectedDate = null;
  },
  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.selectedDate = null;
  },
  selectDay(day) {
    this.selectedDate = day.dateString;
  },
  getDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  },
  getRemindersForDate(date) {
    const reminders = [];
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);

    if (!videoStore || !videoStore.videos) return reminders;

    videoStore.videos.forEach(function(video) {
      if (!video.isActive && !video.repeatMonthly) return;

      if (video.reminders) {
        video.reminders.forEach(function(rem, idx) {
          const rDate = new Date(rem.date);
          if (rDate >= start && rDate <= end) {
            reminders.push(assign({}, video, { currentReminder: rem, reminderIndex: idx }));
          }
        });
      }

      if (video.repeatMonthly) {
        const last = new Date(video.repeatMonthly.lastDate || video.dateAdded || new Date());
        for (let i = 1; i <= 6; i++) {
          const occ = new Date(last);
          occ.setMonth(occ.getMonth() + i);
          occ.setHours(0, 0, 0, 0);
          if (occ >= start && occ <= end) {
            reminders.push(assign({}, video, {
              currentReminder: { day: 'Monthly', date: occ.toISOString(), completed: false },
              reminderIndex: -1
            }));
            break;
          }
        }
      }
    });

    return reminders;

    function assign(target) {
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        for (var k in src) { target[k] = src[k]; }
      }
      return target;
    }
  },
  getDotClass(reminder) {
    if (reminder.currentReminder && reminder.currentReminder.completed) return 'dot-done';
    const date = new Date(reminder.currentReminder && reminder.currentReminder.date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (date < today) return 'dot-overdue';
    return 'dot-pending';
  },
  getStatusClass(rem) {
    if (rem.currentReminder && rem.currentReminder.completed) return 'status-done';
    const d = new Date(rem.currentReminder && rem.currentReminder.date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d < today ? 'status-overdue' : 'status-pending';
  },
  getStatusText(rem) {
    if (rem.currentReminder && rem.currentReminder.completed) return 'Done';
    const d = new Date(rem.currentReminder && rem.currentReminder.date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d < today ? 'Overdue' : 'Pending';
  },
  getReminderDayText(reminder) {
    if (!reminder) return '';
    if (reminder.day === 'Monthly') return 'Monthly';
    const map = { 1: 'Day 1', 2: 'Day 2', 5: 'Day 5', 12: 'Day 12', 42: 'Day 42' };
    return map[reminder.day] || ('Day ' + reminder.day);
  },

  // NEW: open edit modal
  openEdit(rem) {
    this.editingVideoId = rem.id;
    this.editDraftTitle = rem.title || '';
    this.editDraftNotes = rem.notes || '';
    this.showEditModal = true;
    try { document.body.style.overflow = 'hidden'; } catch (_) {}
  },

  // NEW: close edit modal
  closeEdit() {
    this.showEditModal = false;
    this.editingVideoId = null;
    this.editDraftTitle = '';
    this.editDraftNotes = '';
    try { document.body.style.overflow = ''; } catch (_) {}
  },

  // NEW: save edits (title/notes only)
  async saveEdit() {
    if (!this.editDraftTitle) return;
    try {
      const ok = videoStore.updateVideoFields
        ? videoStore.updateVideoFields(this.editingVideoId, {
            title: this.editDraftTitle,
            notes: this.editDraftNotes
          })
        : false;
      if (!ok) {
        alert('Could not update this video. Please try again.');
      }
    } catch (e) {
      console.error('Edit save failed:', e);
      alert('Could not update this video.');
    } finally {
      this.closeEdit();
    }
  },

  // confirm and delete the entire video (metadata + any stored file)
  async confirmDelete(rem) {
    const ok = window.confirm('Are you sure you want to delete this video?');
    if (!ok) return;
    try {
      await videoStore.deleteVideo(rem.id);
    } catch (e) {
      console.error('Delete failed:', e);
      alert('Failed to delete this video. Please try again.');
    }
  }
},
mounted() {
  // Auto-select today if it has reminders
  const todayString = this.getDateString(new Date());
  const todays = this.getRemindersForDate(new Date());
  if (todays.length > 0) {
    this.selectedDate = todayString;
  }
}
};
</script>

<style scoped>
.calendar-view {
height: 100%;
overflow-y: auto;
padding-bottom: 80px;
background: #1F2937;
}

/* Hide summary badges as per last instruction */
.summary-badges {
display: none;
}

/* Month Navigation with shadow */
.month-nav {
display: grid;
grid-template-columns: 44px 1fr 44px;
align-items: center;
gap: var(--space-sm);
padding: 8px 16px;
background: var(--accent-primary);
border-top: 1px solid #1F2937;
border-bottom: 1px solid #1F2937;
border-radius: 20px;
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
margin: var(--space-md);
}
.month-title {
text-align: center;
font-size: 18px;
font-weight: 600;
color: white;
}
.nav-btn {
height: 20px;
width: 44px;
border-radius: var(--radius-md);
background: rgba(59, 130, 246, 0.15);
color: var(--text-primary);
border: none;
display: grid;
place-items: center;
transition: transform .1s ease;
cursor: pointer;
}
.nav-btn:active { transform: scale(0.97); }

/* Calendar Container */
.calendar-container {
padding: var(--space-md);
}

/* Weekday headers */
.weekdays {
display: grid;
grid-template-columns: repeat(7, 1fr);
gap: 6px;
margin-bottom: 6px;
}
.weekday {
text-align: center;
font-size: 12px;
font-weight: 600;
color: var(--text-secondary);
}

/* Grid */
.calendar-grid {
display: grid;
grid-template-columns: repeat(7, 1fr);
gap: 6px;
}

/* Day cell */
.calendar-day {
position: relative;
aspect-ratio: 1;
border-radius: 24px;
background: var(--bg-primary);
border: 1px solid var(--bg-tertiary);
color: var(--text-primary);
display: grid;
place-items: center;
padding: 0;
outline: none;
transition: border-color .15s ease, background .15s ease, transform .1s ease;
cursor: pointer;
}
.calendar-day:active { transform: scale(0.98); }

.calendar-day.other-month { opacity: 0.35; }
.calendar-day.today { border-color: var(--accent-primary); }
.calendar-day.selected {
background: rgba(156, 163, 175, 0.10);
border: 2px solid var(--accent-primary);
}

.day-number {
font-size: 14px;
font-weight: 600;
}

/* Reminder dots */
.reminder-dots {
position: absolute;
bottom: 6px;
display: flex;
gap: 3px;
align-items: center;
}
.dot {
width: 5px;
height: 5px;
border-radius: 50%;
background: var(--accent-primary);
}
.dot.dot-done { background: var(--accent-success); }
.dot.dot-overdue { background: var(--accent-danger); }
.dot.dot-pending { background: var(--accent-primary); }
.more {
font-size: 10px;
color: var(--text-secondary);
}

/* Day Details with shadow */
.day-details {
padding: var(--space-md);
}
.details-card {
border-radius: 48px;
border: 1px solid var(--bg-tertiary);
background: var(--bg-secondary);
padding: var(--space-md);
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
}
.details-title {
text-align: center;
font-size: 16px;
font-weight: 600;
margin-bottom: var(--space-sm);
color: var(--text-primary);
}
.details-empty {
text-align: center;
font-size: 14px;
color: var(--text-secondary);
padding: var(--space-md);
}

/* Reminder list (selected day) */
.reminder-list {
display: flex;
flex-direction: column;
gap: 8px;
}

.reminder-item {
display: grid;
grid-template-columns: 1fr auto auto auto; /* title group + status + edit + delete */
align-items: center;
padding: 10px;
background: var(--bg-tertiary);
border-radius: 16px;
}

.item-center {
display: flex;
flex-direction: column;
align-items: center;
gap: 2px;
}
.item-title {
font-size: 14px;
font-weight: 600;
text-align: center;
color: var(--text-primary);
}
.mini-info {
display: flex;
align-items: center;
gap: 8px;
}
.mini-badge {
font-size: 10px;
color: var(--accent-primary);
font-weight: 600;
white-space: nowrap;
}

.meta-pill {
display: inline-flex;
align-items: center;
gap: 6px;
padding: 4px 8px;
border-radius: var(--radius-full);
font-size: 10px;
color: var(--text-secondary);
background: var(--bg-primary);
}
.meta-dot {
width: 6px; height: 6px; border-radius: 50%;
display: inline-block;
}
.dot-file { background: var(--text-secondary); }
.dot-link { background: var(--accent-primary); }

/* Status badge */
.status-badge {
padding: 4px 10px;
border-radius: var(--radius-full);
font-size: 11px;
font-weight: 600;
white-space: nowrap;
}
.status-done {
color: var(--accent-success);
background: rgba(16, 185, 129, 0.15);
}
.status-overdue {
color: var(--accent-danger);
background: rgba(244, 67, 54, 0.15);
}
.status-pending {
color: var(--accent-primary);
background: rgba(59, 130, 246, 0.15);
}

/* Icon buttons */
.icon-btn {
width: 32px;
height: 32px;
display: grid;
place-items: center;
background: transparent;
border: none;
color: var(--text-secondary);
border-radius: var(--radius-md);
cursor: pointer;
transition: color .15s ease, transform .1s ease;
}
.icon-btn:active { transform: scale(0.96); }

.delete-btn:hover,
.delete-btn:focus-visible {
color: var(--accent-danger);
}
.edit-btn:hover,
.edit-btn:focus-visible {
color: var(--accent-primary);
}

/* Trash icon (stroke uses currentColor) */
.trash-icon, .pencil-icon {
width: 20px;
height: 20px;
display: block;
}
.trash-icon path,
.pencil-icon path {
fill: none;
stroke: currentColor;
stroke-width: 2;
stroke-linecap: round;
stroke-linejoin: round;
}

/* Edit Modal styles */
.modal-overlay {
position: fixed; inset: 0;
background: rgba(0,0,0,0.75);
display: grid; place-items: center;
z-index: 1000;
padding: var(--space-md);
}
.modal-content {
width: 100%; max-width: 520px;
border-radius: 32px;
border: 1px solid var(--bg-tertiary);
background: var(--bg-secondary);
padding: 0; /* header/body/actions manage their own padding */
}
.modal-header {
display: grid;
grid-template-columns: 1fr auto;
align-items: center;
padding: var(--space-md);
border-bottom: 1px solid var(--bg-tertiary);
}
.modal-header h3 {
margin: 0;
font-size: 16px;
color: var(--text-primary);
text-align: center;
}
.close-btn {
width: 36px; height: 36px;
border-radius: 9999px;
background: var(--bg-tertiary);
border: none; color: var(--text-primary);
display: grid; place-items: center;
cursor: pointer;
}
.modal-body {
padding: var(--space-md);
display: flex; flex-direction: column;
gap: var(--space-md);
}
.form-row { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 12px; color: var(--text-secondary); }
.input {
width: 100%;
min-height: 44px;
border-radius: var(--radius-full);
background: var(--bg-tertiary);
border: 1px solid transparent;
color: var(--text-primary);
padding: 0 var(--space-md);
font-size: 14px;
}
.textarea {
min-height: 110px;
padding-top: var(--space-sm);
padding-bottom: var(--space-sm);
border-radius: 16px;
resize: vertical;
}
.input:focus { border-color: var(--accent-primary); outline: none; }

.modal-actions {
display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);
padding: var(--space-md);
border-top: 1px solid var(--bg-tertiary);
}
.btn { width: 100%; }
</style>