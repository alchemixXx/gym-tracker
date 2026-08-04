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
      const path = url.pathname + url.search;
      if (path.startsWith('/auth/')) {
        router.push(path);
      }
    } catch {
      // Ignore malformed URLs
    }
  });
}
