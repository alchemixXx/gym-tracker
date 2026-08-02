<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import * as offlineApi from '@/db/offlineApi';
import { lastSyncAt, syncState } from '@/db/sync';

const router = useRouter();
const userStore = useUserStore();
const templates = ref<any[]>([]);
const showCreate = ref(false);
const newName = ref('');
const loading = ref(true);

onMounted(async () => {
  await loadTemplates();
  if (templates.value.length > 0 || syncState.value !== 'syncing') {
    loading.value = false;
  }
});

// Re-load when sync pulls fresh data
watch(lastSyncAt, () => {
  loadTemplates();
  loading.value = false;
});

// Stop loading if sync fails
watch(syncState, (state) => {
  if (state === 'error' || state === 'idle') {
    loading.value = false;
  }
});

async function loadTemplates() {
  templates.value = await offlineApi.getTemplates(userStore.currentUser!.id);
}

async function createTemplate() {
  if (!newName.value.trim()) return;
  const template = await offlineApi.createTemplate(userStore.currentUser!.id, {
    name: newName.value.trim(),
    days: [],
  });
  newName.value = '';
  showCreate.value = false;
  router.push(`/templates/${template.id}`);
}

async function deleteTemplate(id: number) {
  if (!confirm('Видалити шаблон?')) return;
  await offlineApi.deleteTemplate(userStore.currentUser!.id, id);
  await loadTemplates();
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold dark:text-white">Шаблони</h2>
      <button
        @click="showCreate = !showCreate"
        class="btn-primary btn-sm !rounded-xl gap-1"
        style="background: linear-gradient(135deg, #a855f7, #9333ea)"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Новий
      </button>
    </div>

    <!-- Create form -->
    <transition name="slide-down">
      <div v-if="showCreate" class="mb-6 p-4 card">
        <form @submit.prevent="createTemplate" class="flex gap-2">
          <input
            v-model="newName"
            placeholder="Назва шаблону"
            class="input flex-1"
            autofocus
          />
          <button
            type="submit"
            :disabled="!newName.trim()"
            class="btn-primary disabled:opacity-50"
            style="background: linear-gradient(135deg, #a855f7, #9333ea)"
          >
            Створити
          </button>
        </form>
      </div>
    </transition>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-3">
      <div class="skeleton h-16 w-full"></div>
      <div class="skeleton h-16 w-full"></div>
      <div class="skeleton h-16 w-2/3"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="templates.length === 0" class="text-center py-12">
      <div
        class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center"
      >
        <svg
          class="w-8 h-8 text-purple-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
          />
        </svg>
      </div>
      <p class="text-gray-500 dark:text-gray-400 font-medium">
        Поки немає шаблонів
      </p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
        Створіть шаблон для швидкого запуску програм
      </p>
    </div>

    <!-- Templates list -->
    <div v-else class="space-y-2">
      <div
        v-for="t in templates"
        :key="t.id"
        class="card-hover p-4 flex items-center justify-between border-l-4 border-l-purple-400 dark:border-l-purple-600"
      >
        <router-link
          :to="`/templates/${t.id}`"
          class="font-semibold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex-1"
        >
          {{ t.name }}
        </router-link>
        <button
          @click="deleteTemplate(t.id)"
          class="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors ml-2"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
