import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import App from './App.vue';
import router from './router';
import './assets/main.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);

app.mount('#app');

// Handle deep links on native platforms (magic link opens app directly)
if (Capacitor.isNativePlatform()) {
  CapApp.addListener('appUrlOpen', (event) => {
    try {
      const url = new URL(event.url);
      // Custom scheme: gymtracker://auth/verify?token=...
      // HTTPS App Link: https://gym-tracker-nm7e.onrender.com/auth/verify?token=...
      const path = url.pathname + url.search;
      if (path.startsWith('/auth/') || url.host === 'auth') {
        // Custom scheme puts path as /verify?token=..., host as 'auth'
        const routePath =
          url.host === 'auth' ? `/auth${url.pathname}${url.search}` : path;
        router.push(routePath);
      }
    } catch {
      // Ignore malformed URLs
    }
  });
}
