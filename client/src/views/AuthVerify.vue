<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const status = ref<'verifying' | 'success' | 'error'>('verifying');

onMounted(async () => {
  const token = route.query.token as string;

  if (!token) {
    status.value = 'error';
    authStore.error = 'Посилання недійсне — відсутній токен.';
    return;
  }

  const result = await authStore.verifyMagicLink(token);

  if (result === 'success') {
    status.value = 'success';
    setTimeout(() => {
      router.replace('/');
    }, 1000);
  } else if (result === 'claim') {
    // Redirect to claim account screen
    router.replace('/auth/claim');
  } else {
    status.value = 'error';
  }
});
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950"
  >
    <div class="w-full max-w-sm text-center">
      <!-- Logo -->
      <div class="inline-flex mb-6">
        <div
          class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25"
        >
          <span class="text-3xl">💪</span>
        </div>
      </div>

      <!-- Verifying -->
      <div v-if="status === 'verifying'">
        <div class="flex justify-center mb-4">
          <svg
            class="w-8 h-8 animate-spin text-blue-500"
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
        <p class="text-gray-600 dark:text-gray-400">Перевіряємо посилання...</p>
      </div>

      <!-- Success -->
      <div v-else-if="status === 'success'">
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
        >
          <svg
            class="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p class="text-gray-700 dark:text-gray-300 font-medium">
          Вхід виконано!
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Переходимо до додатку...
        </p>
      </div>

      <!-- Error -->
      <div v-else>
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center"
        >
          <svg
            class="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <p class="text-gray-700 dark:text-gray-300 font-medium mb-2">
          Не вдалося увійти
        </p>
        <p class="text-sm text-red-500 dark:text-red-400 mb-6">
          {{ authStore.error || 'Посилання недійсне або прострочене.' }}
        </p>
        <button @click="router.replace('/')" class="btn-primary">
          Спробувати ще раз
        </button>
      </div>
    </div>
  </div>
</template>
