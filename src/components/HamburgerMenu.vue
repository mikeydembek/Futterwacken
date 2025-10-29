<template>
<div class="hamburger-menu">
  <!-- Hamburger Icon Button -->
  <button
    @click="toggleMenu"
    class="hamburger-button"
    :class="{ 'active': isOpen }"
    aria-label="Menu"
  >
    <span class="hamburger-line"></span>
    <span class="hamburger-line"></span>
    <span class="hamburger-line"></span>
  </button>

  <!-- Backdrop -->
  <div
    v-if="isOpen"
    class="menu-backdrop"
    @click="closeMenu"
  ></div>

  <!-- Slide-in Drawer -->
  <div
    class="menu-drawer"
    :class="{ 'open': isOpen }"
  >
    <!-- Drawer Header -->
    <div class="drawer-header">
      <h2>Settings</h2>
      <button @click="closeMenu" class="close-button">
        ✕
      </button>
    </div>

  <!-- Menu Items (text only) -->
<div v-if="!activeSection" class="menu-items">
<button @click="openSettings('notifications')" class="menu-item">
  <span class="menu-label">Notifications</span>
  <span class="menu-arrow">›</span>
</button>

<button @click="openSettings('data')" class="menu-item">
  <span class="menu-label">Data Management</span>
  <span class="menu-arrow">›</span>
</button>

<button @click="openSettings('about')" class="menu-item">
  <span class="menu-label">About</span>
  <span class="menu-arrow">›</span>
</button>
</div>

    <!-- Settings Content Area -->
    <div v-if="activeSection" class="settings-content">
      <!-- Back Button -->
      <button @click="backToMenu" class="back-button">
        ‹ Back
      </button>

      <!-- Notification Settings -->
      <div v-if="activeSection === 'notifications'" class="settings-section">
        <NotificationSettings />
      </div>

      <!-- Data Management -->
      <div v-else-if="activeSection === 'data'" class="settings-section">
        <DataManagement />
      </div>

      <!-- About Section -->
      <div v-else-if="activeSection === 'about'" class="settings-section">
        <AboutSection />
      </div>
    </div>
  </div>
</div>
</template>

<script>
import NotificationSettings from './NotificationSettings.vue'
import DataManagement from './DataManagement.vue'
import AboutSection from './AboutSection.vue'

export default {
name: 'HamburgerMenu',
components: {
  NotificationSettings,
  DataManagement,
  AboutSection
},
data() {
  return {
    isOpen: false,
    activeSection: null
  }
},
methods: {
  toggleMenu() {
    this.isOpen = !this.isOpen
    if (!this.isOpen) {
      this.activeSection = null
    }
  },
  closeMenu() {
    this.isOpen = false
    this.activeSection = null
  },
  openSettings(section) {
    this.activeSection = section
  },
  backToMenu() {
    this.activeSection = null
  }
},
watch: {
  isOpen(newVal) {
    if (newVal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }
},
beforeUnmount() {
  document.body.style.overflow = ''
}
}
</script>

<style scoped>
/* Hamburger Button */
.hamburger-button {
position: relative;
width: 40px;
height: 40px;
background: var(--bg-tertiary);
border: none;
border-radius: var(--radius-md);
cursor: pointer;
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
gap: 4px;
transition: all 0.3s ease;
z-index: 1002;
}
.hamburger-button:active { transform: scale(0.95); }
.hamburger-button.active { background: var(--accent-primary); }

/* Hamburger Lines */
.hamburger-line {
width: 20px;
height: 2px;
background: var(--text-primary);
border-radius: 2px;
transition: all 0.3s ease;
}
.hamburger-button.active .hamburger-line:nth-child(1) { transform: translateY(6px) rotate(45deg); }
.hamburger-button.active .hamburger-line:nth-child(2) { opacity: 0; }
.hamburger-button.active .hamburger-line:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

/* Backdrop */
.menu-backdrop {
position: fixed; inset: 0;
background: rgba(0, 0, 0, 0.5);
z-index: 1000;
animation: fadeIn 0.3s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Drawer */
.menu-drawer {
position: fixed;
top: 0;
right: -100%;
width: 85%;
max-width: 400px;
height: 100%;
background: #1F2937; /* Darker gray background */
z-index: 1001;
transition: right 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
display: flex;
flex-direction: column;
overflow: hidden;
}
.menu-drawer.open {
right: 0;
box-shadow: -5px 0 25px rgba(0, 0, 0, 0.5);
}

/* Drawer Header */
.drawer-header {
display: flex;
justify-content: space-between;
align-items: center;
padding: var(--space-md);
background: var(--bg-secondary);
border-bottom: 1px solid var(--bg-tertiary);
}
.drawer-header h2 { font-size: 20px; margin: 0; }
.close-button {
width: 36px; height: 36px;
background: var(--bg-tertiary);
border: none; border-radius: 9999px;
color: var(--text-primary);
font-size: 20px;
cursor: pointer;
display: grid; place-items: center;
}

/* Menu Items */
.menu-items {
padding: var(--space-md);
overflow-y: auto;
flex: 1;
}
.menu-item {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 24px; /* label + arrow */
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border: 1px solid var(--bg-tertiary);
  border-radius: 48px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: var(--space-sm);
  text-align: left;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
}
.menu-item:hover, .menu-item:focus-visible {
border-color: var(--accent-primary);
}
.menu-item:active { transform: scale(0.98); }

.menu-icon { font-size: 20px; width: 24px; text-align: center; }
.menu-label { flex: 1; font-size: 16px; font-weight: 500; }
.menu-arrow { font-size: 20px; color: var(--text-secondary); }

/* Settings Content */
.settings-content {
position: absolute;
top: 0; left: 0; right: 0; bottom: 0;
background: #1F2937; /* Darker gray background */
z-index: 1;
display: flex; flex-direction: column;
animation: slideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

.back-button {
padding: var(--space-md);
background: var(--bg-secondary);
border: none;
border-bottom: 1px solid var(--bg-tertiary);
color: var(--accent-primary);
font-size: 14px;
font-weight: 600;
text-align: left;
cursor: pointer;
}
.settings-section {
flex: 1;
overflow-y: auto;
padding: var(--space-md);
}
</style>