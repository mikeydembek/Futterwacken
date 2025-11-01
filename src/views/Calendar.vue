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
        </div>
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
    weekdays: ['S', 'M', 'T', 'W', 'T', 'F', 'S']
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
    const found = this.calendarDays.find(d => d.dateString === this.selectedDate);
    return found ? found.reminders : [];
  },
  selectedDateDisplay() {
    if (!this.selectedDate) return '';
    const [y, m, d] = this.selectedDate.split('-');
    const date = new Date(+y, +m - 1, +d);
    return date.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  },
  monthRemindersCount() {
    return this.calendarDays.reduce((sum, d) => {
      return sum + (d.isCurrentMonth ? d.reminders.length : 0);
    }, 0);
  },
  completedCount() {
    return this.calendarDays.reduce((sum, d) => {
      if (!d.isCurrentMonth) return sum;
      return sum + d.reminders.filter(r => r.currentReminder && r.currentReminder.completed).length;
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
    return `${y}-${m}-${d}`;
  },
  getRemindersForDate(date) {
    const reminders = [];
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);

    if (!videoStore || !videoStore.videos) return reminders;

    videoStore.videos.forEach(video => {
      if (!video.isActive && !video.repeatMonthly) return;

      // regular reminders
      if (video.reminders) {
        video.reminders.forEach((rem, idx) => {
          const rDate = new Date(rem.date);
          if (rDate >= start && rDate <= end) {
            reminders.push({ ...video, currentReminder: rem, reminderIndex: idx });
          }
        });
      }

      // monthly repeats (simple projection)
      if (video.repeatMonthly) {
        const last = new Date(video.repeatMonthly.lastDate || video.dateAdded || new Date());
        // Check some future occurrences
        for (let i = 1; i <= 6; i++) {
          const occ = new Date(last);
          occ.setMonth(occ.getMonth() + i);
          occ.setHours(0, 0, 0, 0);
          if (occ >= start && occ <= end) {
            reminders.push({
              ...video,
              currentReminder: { day: 'Monthly', date: occ.toISOString(), completed: false },
              reminderIndex: -1
            });
            break;
          }
        }
      }
    });
    return reminders;
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
    return map[reminder.day] || `Day ${reminder.day}`;
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
/* New, darker gray background */
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
border-top: 1px solid #1F2937;    /* match tab background */
border-bottom: 1px solid #1F2937; /* match tab background */
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
/* New shadow to create a "hovering" effect */
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
grid-template-columns: 1fr auto;
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
</style>