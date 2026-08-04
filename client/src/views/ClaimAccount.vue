<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { ref } from 'vue';

const authStore = useAuthStore();
const router = useRouter();
const claiming = ref(false);
const error = ref('');

async function claimUser(userId: number) {
  if (claiming.value) return;
  claiming.value = true;
  error.value = '';

  const success = await authStore.claimAccount(userId);
  if (success) {
    router.replace('/');
  } else {
    error.value = authStore.error || 'Не вдалося прив\'язати профіль';
    claiming.value = false;
  }
}

async function createNew() {
  if (claiming.value) return;
  claiming.value = true;
  error.value = '';

  const success = await authStore.claimAccount(null);
  if (success) {
    router.replace('/');
  } else {
    error.value = authStore.error || 'Не вдалося створити профіль';
    claiming.value = false;
  }
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950"
  >
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-6">
        <div class="inline-flex mb-4">
          <div
            class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25"
          >
            <span class="text-3xl">💪</span>
          </div>
        </div>
        <h1
          class="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent"
        >
          Тренування
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">
          Це ваш профіль?
        </p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Оберіть існуючий профіль, щоб зберегти свої дані,<br />
          або створіть новий.
        </p>
      </div>

      <!-- User list -->
      <div class="space-y-2 mb-6">
        <button
          v-for="user in authStore.claimUsers"
          :key="user.id"
          @click="claimUser(user.id)"
          :disabled="claiming"
          class="w-full p-4 card-hover flex items-center gap-3 text-left group disabled:opacity-50"
        >
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:shadow-md transition-shadow"
          >
            {{ user.name.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1">
            <span class="font-medium text-gray-900 dark:text-gray-100">{{
              user.name
            }}</span>
          </div>
          <svg
            class="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <!-- Create new option -->
      <div class="border-t border-gray-200 dark:border-gray-800 pt-4">
        <button
          @click="createNew"
          :disabled="claiming"
          class="w-full p-4 card-hover flex items-center gap-3 text-left group disabled:opacity-50"
        >
          <div
            class="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/30 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
          <span class="font-medium text-gray-700 dark:text-gray-300">
            Створити новий профіль
          </span>
        </button>
      </div>

      <!-- Error -->
      <p
        v-if="error"
        class="mt-4 text-sm text-red-500 dark:text-red-400 text-center"
      >
        {{ error }}
      </p>

      <!-- Loading spinner -->
      <div v-if="claiming" class="mt-4 flex justify-center">
        <svg
          class="w-6 h-6 animate-spin text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          ></path>
        </svg>
      </div>
    </div>
  </div>
</template>
