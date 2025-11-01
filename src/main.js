import { createApp } from 'vue';
import './styles/global.css';
import App from './App.vue';

const app = createApp(App);

// Global error handler
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue Error:', err);
  console.error('Error Info:', info);
};

app.mount('#app');