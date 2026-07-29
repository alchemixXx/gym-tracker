<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUserStore } from '@/stores/user';
import { serverWaking } from '@/api';
import { useRoute } from 'vue-router';
import UserSelect from '@/views/UserSelect.vue';

const userStore = useUserStore();
const route = useRoute();
const darkMode = ref(false);

onMounted(() => {
  // Check system preference or stored preference
  const stored = localStorage.getItem('darkMode');
  if (stored !== null) {
    darkMode.value = stored === 'true';
  } else {
    darkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  applyDarkMode();
});

function toggleDarkMode() {
  darkMode.value = !darkMode.value;
  localStorage.setItem('darkMode', String(darkMode.value));
  applyDarkMode();
}

function applyDarkMode() {
  document.documentElement.classList.toggle('dark', darkMode.value);
}

const navLinks = [
  { to: '/programs', label: 'Програми', icon: 'programs' },
  { to: '/templates', label: 'Шаблони', icon: 'templates' },
  { to: '/measurements', label: 'Заміри', icon: 'measures' },
  { to: '/food', label: 'Їжа', icon: 'food' },
];

function isActive(path: string) {
  return route.path.startsWith(path);
}
</script>

<template>
  <!-- Server waking overlay -->
  <div
    v-if="serverWaking"
    class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-950 dark:to-blue-950"
  >
    <div class="w-full max-w-sm text-center">
      <div class="mb-8">
        <div class="relative inline-flex">
          <div
            class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30"
          >
            <span class="text-3xl">💪</span>
          </div>
          <div
            class="absolute inset-0 rounded-2xl animate-ping bg-blue-400/20"
          ></div>
        </div>
      </div>
      <h1 class="text-2xl font-bold mb-3 dark:text-white">Тренування</h1>
      <p class="text-gray-600 dark:text-gray-400 mb-2">
        Сервер запускається...
      </p>
      <p class="text-sm text-gray-400 dark:text-gray-500">
        Безкоштовний хостинг вимикає сервер після неактивності.
        <br />Зазвичай це займає 30–60 секунд.
      </p>
      <div class="mt-8 flex justify-center gap-1.5">
        <span
          class="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]"
        ></span>
        <span
          class="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]"
        ></span>
        <span
          class="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:300ms]"
        ></span>
      </div>
    </div>
  </div>

  <div v-else class="min-h-screen">
    <UserSelect v-if="!userStore.currentUser" />
    <template v-else>
      <!-- Header -->
      <header
        class="bg-gradient-to-r from-slate-900 to-blue-900 dark:from-gray-950 dark:to-gray-900 sticky top-0 z-50"
      >
        <div
          class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"
            >
              <span class="text-lg">💪</span>
            </div>
            <h1 class="text-lg font-bold text-white">Тренування</h1>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="toggleDarkMode"
              class="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              :title="darkMode ? 'Світла тема' : 'Темна тема'"
            >
              <span v-if="darkMode" class="text-sm">☀️</span>
              <span v-else class="text-sm">🌙</span>
            </button>
            <button
              @click="userStore.logout()"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-white/90 transition-colors"
            >
              <span
                class="w-6 h-6 rounded-full bg-blue-500/50 flex items-center justify-center text-xs font-bold"
              >
                {{ userStore.currentUser.name.charAt(0).toUpperCase() }}
              </span>
              <span class="hidden sm:inline">{{
                userStore.currentUser.name
              }}</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Main content -->
      <main class="max-w-lg mx-auto px-4 py-4 pb-safe">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- Bottom Navigation -->
      <nav class="bottom-nav">
        <div class="max-w-lg mx-auto flex justify-around">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="bottom-nav-item flex-1"
            :class="{ active: isActive(link.to) }"
          >
            <span class="nav-icon">
              <!-- Programs icon -->
              <svg
                v-if="link.icon === 'programs'"
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <!-- Templates icon -->
              <svg
                v-if="link.icon === 'templates'"
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                />
              </svg>
              <!-- Measurements icon -->
              <svg
                v-if="link.icon === 'measures'"
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <!-- Food icon -->
              <svg
                v-if="link.icon === 'food'"
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
            </span>
            <span class="text-[10px] font-medium">{{ link.label }}</span>
          </router-link>
        </div>
      </nav>
    </template>
  </div>
</template>
