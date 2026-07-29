<script setup lang="ts">
import { useUserStore } from '@/stores/user';
import { serverWaking } from '@/api';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();

const navLinks = [
  { to: '/programs', label: 'Програми' },
  { to: '/templates', label: 'Шаблони' },
  { to: '/measurements', label: 'Заміри' },
  { to: '/food', label: 'Їжа' },
];

async function handleLogout() {
  await userStore.logout();
  router.push('/login');
}
</script>

<template>
  <!-- Server waking overlay — covers the entire app -->
  <div
    v-if="serverWaking"
    class="min-h-screen flex items-center justify-center p-4"
  >
    <div class="w-full max-w-sm text-center">
      <div class="mb-6">
        <div
          class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"
        ></div>
      </div>
      <h1 class="text-2xl font-bold mb-3">Тренування 💪</h1>
      <p class="text-gray-600 mb-2">Сервер запускається...</p>
      <p class="text-sm text-gray-400">
        Безкоштовний хостинг вимикає сервер після неактивності.
        <br />Зазвичай це займає 30–60 секунд.
      </p>
      <div class="mt-6 flex justify-center gap-1">
        <span
          class="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]"
        ></span>
        <span
          class="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]"
        ></span>
        <span
          class="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]"
        ></span>
      </div>
    </div>
  </div>

  <div v-else class="min-h-screen">
    <!-- Auth is handled by router guard — if user is here, they're authenticated -->
    <template v-if="userStore.isAuthenticated">
      <header class="bg-white shadow-sm border-b sticky top-0 z-50">
        <div
          class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between"
        >
          <h1 class="text-lg font-bold">Тренування</h1>
          <button
            @click="handleLogout"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            {{ userStore.currentUser?.name }} ↗
          </button>
        </div>
      </header>
      <nav class="bg-white border-b">
        <div class="max-w-lg mx-auto px-4 flex gap-1 overflow-x-auto">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="px-3 py-2 text-sm whitespace-nowrap border-b-2 border-transparent hover:border-blue-300"
            active-class="!border-blue-600 text-blue-600 font-medium"
          >
            {{ link.label }}
          </router-link>
        </div>
      </nav>
      <main class="max-w-lg mx-auto px-4 py-4">
        <router-view />
      </main>
    </template>

    <!-- Public pages (login, reset-password) render without header/nav -->
    <router-view v-else />
  </div>
</template>
