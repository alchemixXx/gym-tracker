<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();
const newName = ref('');
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  await userStore.fetchUsers();
  loading.value = false;
});

async function createUser() {
  if (!newName.value.trim()) return;
  const user = await userStore.createUser(newName.value.trim());
  userStore.selectUser(user);
  newName.value = '';
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
        <p class="text-gray-500 dark:text-gray-400 mt-2">Оберіть профіль</p>
      </div>

      <!-- Skeleton loading -->
      <div v-if="loading" class="space-y-3">
        <div class="skeleton h-14 w-full"></div>
        <div class="skeleton h-14 w-full"></div>
        <div class="skeleton h-14 w-3/4"></div>
      </div>

      <!-- User list -->
      <transition name="fade">
        <div v-if="!loading" class="space-y-2 mb-8">
          <button
            v-for="user in userStore.users"
            :key="user.id"
            @click="userStore.selectUser(user)"
            class="w-full p-4 card-hover flex items-center gap-3 text-left group"
          >
            <div
              class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:shadow-md transition-shadow"
            >
              {{ user.name.charAt(0).toUpperCase() }}
            </div>
            <span class="font-medium text-gray-900 dark:text-gray-100">{{
              user.name
            }}</span>
            <svg
              class="w-5 h-5 ml-auto text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors"
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

          <div v-if="userStore.users.length === 0" class="text-center py-8">
            <div
              class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
            >
              <svg
                class="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <p class="text-gray-500 dark:text-gray-400">
              Створіть перший профіль
            </p>
          </div>
        </div>
      </transition>

      <!-- Create new user -->
      <div class="border-t border-gray-200 dark:border-gray-800 pt-6">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">
          Або створіть новий:
        </p>
        <form @submit.prevent="createUser" class="flex gap-2">
          <input
            v-model="newName"
            placeholder="Ваше ім'я"
            class="input flex-1"
          />
          <button
            type="submit"
            :disabled="!newName.trim()"
            class="btn-primary !px-5 disabled:opacity-50"
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
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
