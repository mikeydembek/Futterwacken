<template>
<div class="about-section">
  <h3 class="settings-title">About Futterwacken</h3>
  
  <div class="app-info">
    <div class="app-version">Version 1.0.0</div>
  </div>

  <div class="settings-card">
    <h5>Spaced Repetition Schedule</h5>
    <ul>
      <li>Day 1: Initial learning</li>
      <li>Day 2: First review</li>
      <li>Day 5: Reinforcement</li>
      <li>Day 12: Consolidation</li>
      <li>Day 42: Final review</li>
    </ul>
  </div>

  <div class="settings-card">
    <h5>How It Works</h5>
    <p>This app uses spaced repetition to help you learn from videos effectively. Add videos you want to learn from, and the app will remind you to review them at optimal intervals.</p>
  </div>

  <div class="settings-card">
    <h5>Tips</h5>
    <ul>
      <li>Install the app for the best experience</li>
      <li>Enable notifications for daily reminders</li>
      <li>Backup your data regularly</li>
      <li>Mark videos as watched to stay on track</li>
    </ul>
  </div>
</div>
</template>

<style scoped>
.settings-title {
font-size: 16px;
font-weight: 600;
text-align: center;
margin-bottom: var(--space-lg);
color: var(--text-secondary);
}

.app-info {
text-align: center;
margin-bottom: var(--space-lg);
}

.app-version {
color: var(--text-secondary);
font-size: 14px;
}

.settings-card {
background: var(--bg-secondary);
border: 1px solid var(--bg-tertiary);
border-radius: 48px;
padding: var(--space-md);
margin-bottom: var(--space-md);
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2);
}

.settings-card h5 {
text-align: center;
margin-bottom: var(--space-sm);
color: var(--accent-primary);
font-weight: 600;
}

.settings-card ul {
list-style: none;
padding: 0;
text-align: center;
}

.settings-card li {
margin-bottom: var(--space-xs);
font-size: 14px;
color: var(--text-secondary);
}

.settings-card p {
color: var(--text-secondary);
font-size: 14px;
line-height: 1.5;
text-align: center;
}
</style>