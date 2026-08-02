<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import * as offlineApi from '@/db/offlineApi';
import { lastSyncAt, syncState } from '@/db/sync';

const router = useRouter();
const userStore = useUserStore();
const programs = ref<any[]>([]);
const templates = ref<any[]>([]);
const showCreate = ref(false);
const newName = ref('');
const selectedTemplate = ref<number | null>(null);
const loading = ref(true);

onMounted(async () => {
  await loadPrograms();
  templates.value = await offlineApi.getTemplates(userStore.currentUser!.id);
  // Only hide loading if we have data or sync is not in progress
  if (programs.value.length > 0 || syncState.value !== 'syncing') {
    loading.value = false;
  }
});

// Re-load when sync pulls fresh data
watch(lastSyncAt, async () => {
  await loadPrograms();
  templates.value = await offlineApi.getTemplates(userStore.currentUser!.id);
  loading.value = false;
});

// Stop loading if sync fails
watch(syncState, (state) => {
  if (state === 'error' || state === 'idle') {
    loading.value = false;
  }
});

async function loadPrograms() {
  programs.value = await offlineApi.getPrograms(userStore.currentUser!.id);
}

async function createProgram() {
  if (!newName.value.trim()) return;
  const data: any = {
    name: newName.value.trim(),
    start_date: new Date().toISOString().split('T')[0],
  };
  if (selectedTemplate.value) {
    data.template_id = selectedTemplate.value;
  }
  const program = await offlineApi.createProgram(
    userStore.currentUser!.id,
    data,
  );
  newName.value = '';
  showCreate.value = false;
  selectedTemplate.value = null;
  router.push(`/programs/${program.id}`);
}

async function duplicateProgram(id: number, currentName: string) {
  const name = prompt(
    'Назва нової програми:',
    `${currentName} (наст. тиждень)`,
  );
  if (!name) return;
  const program = await offlineApi.duplicateProgram(
    userStore.currentUser!.id,
    id,
    name,
  );
  router.push(`/programs/${program.id}`);
}

async function deleteProgram(id: number) {
  if (!confirm('Видалити програму?')) return;
  await offlineApi.deleteProgram(userStore.currentUser!.id, id);
  await loadPrograms();
}

function formatDate(date: string | null) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('uk');
}

function programProgress(p: any) {
  if (!p.days_total || p.days_total === 0) return 0;
  return Math.round((p.days_completed / p.days_total) * 100);
}

const activePrograms = computed(() =>
  programs.value.filter((p) => p.status === 'active'),
);
const completedPrograms = computed(() =>
  programs.value.filter((p) => p.status === 'completed'),
);
const pendingPrograms = computed(() =>
  programs.value.filter(
    (p) => p.status !== 'active' && p.status !== 'completed',
  ),
);

const importInput = ref<HTMLInputElement | null>(null);

function triggerImport() {
  importInput.value?.click();
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const program = await offlineApi.importProgram(
      userStore.currentUser!.id,
      data,
    );
    if (program) {
      router.push(`/programs/${program.id}`);
    }
  } catch (e) {
    alert('Не вдалося імпортувати програму. Перевірте формат файлу.');
  } finally {
    input.value = '';
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold dark:text-white">Програми</h2>
      <div class="flex items-center gap-2">
        <button
          @click="triggerImport"
          class="btn-secondary btn-sm !rounded-xl gap-1"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Імпорт
        </button>
        <button
          @click="showCreate = !showCreate"
          class="btn-primary btn-sm !rounded-xl gap-1"
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
          Нова
        </button>
      </div>
    </div>

    <input
      ref="importInput"
      type="file"
      accept=".json"
      class="hidden"
      @change="handleImportFile"
    />

    <!-- Create form -->
    <transition name="slide-down">
      <div v-if="showCreate" class="mb-6 p-4 card space-y-3">
        <input
          v-model="newName"
          placeholder="Назва програми"
          class="input"
          autofocus
        />
        <select v-model="selectedTemplate" class="input">
          <option :value="null">Без шаблону (порожня)</option>
          <option v-for="t in templates" :key="t.id" :value="t.id">
            {{ t.name }}
          </option>
        </select>
        <button
          @click="createProgram"
          :disabled="!newName.trim()"
          class="btn-primary w-full disabled:opacity-50"
        >
          Створити
        </button>
      </div>
    </transition>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-3">
      <div class="skeleton h-20 w-full"></div>
      <div class="skeleton h-20 w-full"></div>
      <div class="skeleton h-20 w-3/4"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="programs.length === 0" class="text-center py-12">
      <div
        class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center"
      >
        <svg
          class="w-8 h-8 text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </div>
      <p class="text-gray-500 dark:text-gray-400 font-medium">
        Поки немає програм
      </p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
        Створіть першу програму тренувань
      </p>
    </div>

    <!-- Programs list -->
    <template v-else>
      <!-- Active programs -->
      <div v-if="activePrograms.length > 0" class="mb-6">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 px-1"
        >
          Активні
        </h3>
        <div class="space-y-2">
          <router-link
            v-for="p in activePrograms"
            :key="p.id"
            :to="`/programs/${p.id}`"
            class="block card-hover border-l-status-active p-4 active:scale-[0.98] transition-all"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-900 dark:text-white truncate">
                  {{ p.name }}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {{ formatDate(p.start_date) }}
                </p>
              </div>
              <div class="flex items-center gap-1.5 ml-3">
                <button
                  @click.prevent="duplicateProgram(p.id, p.name)"
                  class="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
                  title="Копіювати"
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <button
                  @click.prevent="deleteProgram(p.id)"
                  class="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
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
            <!-- Progress bar -->
            <div class="progress-bar">
              <div
                class="progress-bar-fill bg-gradient-to-r from-blue-500 to-blue-400"
                :style="{ width: programProgress(p) + '%' }"
              ></div>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              {{ p.days_completed || 0 }} / {{ p.days_total || 0 }} днів
            </p>
          </router-link>
        </div>
      </div>

      <!-- Pending programs -->
      <div v-if="pendingPrograms.length > 0" class="mb-6">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-1"
        >
          Очікують
        </h3>
        <div class="space-y-2">
          <router-link
            v-for="p in pendingPrograms"
            :key="p.id"
            :to="`/programs/${p.id}`"
            class="block card-hover border-l-status-pending p-4 active:scale-[0.98] transition-all"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-900 dark:text-white truncate">
                  {{ p.name }}
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {{ formatDate(p.start_date) }}
                </p>
              </div>
              <div class="flex items-center gap-1.5 ml-3">
                <button
                  @click.prevent="duplicateProgram(p.id, p.name)"
                  class="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
                  title="Копіювати"
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <button
                  @click.prevent="deleteProgram(p.id)"
                  class="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
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
          </router-link>
        </div>
      </div>

      <!-- Completed programs -->
      <div v-if="completedPrograms.length > 0">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3 px-1"
        >
          Завершені
        </h3>
        <div class="space-y-2">
          <router-link
            v-for="p in completedPrograms"
            :key="p.id"
            :to="`/programs/${p.id}`"
            class="block card-hover border-l-status-completed p-4 active:scale-[0.98] transition-all opacity-80"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p
                  class="font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2"
                >
                  {{ p.name }}
                  <svg
                    class="w-4 h-4 text-emerald-500 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </p>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {{ formatDate(p.start_date) }}
                </p>
              </div>
              <div class="flex items-center gap-1.5 ml-3">
                <button
                  @click.prevent="duplicateProgram(p.id, p.name)"
                  class="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
                  title="Копіювати"
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
                <button
                  @click.prevent="deleteProgram(p.id)"
                  class="w-8 h-8 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
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
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>
