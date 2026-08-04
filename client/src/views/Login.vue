<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const email = ref('');

async function submit() {
  if (!email.value.trim()) return;
  await authStore.requestMagicLink(email.value.trim());
}

function reset() {
  authStore.resetError();
  email.value = '';
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950"
  >
    <div class="w-full max-w-sm">
      <!-- Logo / Identity -->
      <div class="text-center mb-8">
        <div class="inline-flex mb-4">
          <div
            class="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/25"
          >
            <span class="text-4xl">💪</span>
          </div>
        </div>
        <h1
          class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent"
        >
          Тренування
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">
          {{ authStore.magicLinkSent ? 'Перевірте пошту' : 'Увійти через email' }}
        </p>
      </div>

      <!-- Magic link sent confirmation -->
      <div v-if="authStore.magicLinkSent" class="text-center">
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
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p class="text-gray-700 dark:text-gray-300 mb-2">
          Ми надіслали посилання для входу на
        </p>
        <p class="font-semibold text-gray-900 dark:text-gray-100 mb-6">
          {{ email }}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Натисніть на посилання в листі, щоб увійти.<br />
          Посилання дійсне 15 хвилин.
        </p>
        <button
          @click="reset"
          class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Використати іншу адресу
        </button>
      </div>

      <!-- Email form -->
      <div v-else>
        <form @submit.prevent="submit" class="space-y-4">
          <div>
            <label
              for="email"
              class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="your@email.com"
              class="input w-full"
              :disabled="authStore.loading"
              autocomplete="email"
              autofocus
            />
          </div>

          <button
            type="submit"
            :disabled="!email.trim() || authStore.loading"
            class="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <svg
              v-if="authStore.loading"
              class="w-5 h-5 animate-spin"
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
            <span>{{ authStore.loading ? 'Надсилаємо...' : 'Надіслати посилання' }}</span>
          </button>
        </form>

        <p
          v-if="authStore.error"
          class="mt-3 text-sm text-red-500 dark:text-red-400 text-center"
        >
          {{ authStore.error }}
        </p>

        <p class="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Ми надішлемо вам посилання для входу.<br />
          Пароль не потрібен.
        </p>
      </div>
    </div>
  </div>
</template>
