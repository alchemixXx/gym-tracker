<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();
</script>

<template>
  <div class="py-4">
    <div class="flex items-center gap-3 mb-6">
      <button
        @click="router.back()"
        class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-xl font-bold dark:text-white">Налаштування</h1>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
      <!-- Name -->
      <div class="px-4 py-4 flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Ім'я</p>
          <p class="text-base font-medium text-gray-900 dark:text-white mt-0.5">
            {{ authStore.user?.name || '—' }}
          </p>
        </div>
        <div class="w-9 h-9 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </div>

      <!-- Email -->
      <div class="px-4 py-4 flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Email</p>
          <p class="text-base font-medium text-gray-900 dark:text-white mt-0.5">
            {{ authStore.user?.email || '—' }}
          </p>
        </div>
        <div class="w-9 h-9 rounded-full bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>
