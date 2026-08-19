<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue';
import { useUserStore } from '@/stores/user';
import * as offlineApi from '@/db/offlineApi';
import { api } from '@/api';
import { useOnline } from '@/composables/useOnline';
import { lastSyncAt } from '@/db/sync';

const userStore = useUserStore();
const { isOnline } = useOnline();
const measurements = ref<any[]>([]);
const showForm = ref(false);
const uploading = ref<number | null>(null);
const lightboxSrc = ref<string | null>(null);
const loading = ref(true);

const form = ref({
  date: new Date().toISOString().split('T')[0],
  weight: null as number | null,
  notes: '',
  entries: [] as { type: string; value: number | null }[],
});

const measurementTypes = [
  'Гомілка',
  'Стегно',
  'Сідниці',
  'Талія',
  'Груди',
  'Плече/біцепс',
];

// Sparkline data for weight
const weightHistory = computed(() => {
  return measurements.value
    .filter((m) => m.weight != null)
    .slice(0, 10)
    .reverse()
    .map((m) => Number(m.weight));
});

const sparklinePath = computed(() => {
  const data = weightHistory.value;
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const stepX = w / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return `M${points.join(' L')}`;
});

// Latest metrics summary
const latestWeight = computed(() => {
  const m = measurements.value.find((m) => m.weight != null);
  return m ? m.weight : null;
});

const weightTrend = computed(() => {
  const withWeight = measurements.value.filter((m) => m.weight != null);
  if (withWeight.length < 2) return null;
  return +(withWeight[0].weight - withWeight[1].weight).toFixed(1);
});

onMounted(async () => {
  await loadMeasurements();
  loading.value = false;
});

// Re-load when sync pulls fresh data
watch(lastSyncAt, () => {
  loadMeasurements();
});

async function loadMeasurements() {
  measurements.value = await offlineApi.getMeasurements(
    userStore.currentUser!.id,
  );
}

function addEntry() {
  form.value.entries.push({ type: '', value: null });
}
function removeEntry(index: number) {
  form.value.entries.splice(index, 1);
}

async function saveMeasurement() {
  const data = {
    date: form.value.date,
    weight: form.value.weight,
    notes: form.value.notes || null,
    entries: form.value.entries
      .filter((e) => e.type && e.value)
      .map((e) => ({ type: e.type, value: e.value })),
  };
  await offlineApi.createMeasurement(userStore.currentUser!.id, data);
  form.value = {
    date: new Date().toISOString().split('T')[0],
    weight: null,
    notes: '',
    entries: [],
  };
  showForm.value = false;
  await loadMeasurements();
}

async function deleteMeasurement(id: number) {
  if (!confirm('Видалити запис?')) return;
  await offlineApi.deleteMeasurement(userStore.currentUser!.id, id);
  await loadMeasurements();
}

async function handlePhotoUpload(measurementId: number, event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  uploading.value = measurementId;
  try {
    const files = Array.from(input.files);
    await api.uploadMeasurementPhotos(
      userStore.currentUser!.id,
      measurementId,
      files,
    );
    await loadMeasurements();
  } catch (e) {
    alert('Помилка при завантаженні фото');
  } finally {
    uploading.value = null;
    input.value = '';
  }
}

async function deletePhoto(measurementId: number, photoId: number) {
  if (!confirm('Видалити фото?')) return;
  await api.deleteMeasurementPhoto(
    userStore.currentUser!.id,
    measurementId,
    photoId,
  );
  await loadMeasurements();
}

function openLightbox(url: string) {
  lightboxSrc.value = url;
}
function closeLightbox() {
  lightboxSrc.value = null;
}
function formatDate(date: string) {
  return new Date(date).toLocaleDateString('uk');
}

function getDiff(currentIndex: number) {
  const current = measurements.value[currentIndex];
  const previous = measurements.value[currentIndex + 1];
  if (!previous) return null;
  const diffs: { label: string; diff: number; unit: string }[] = [];
  if (current.weight != null && previous.weight != null) {
    const d = +(current.weight - previous.weight).toFixed(1);
    if (d !== 0) diffs.push({ label: 'Вага', diff: d, unit: 'кг' });
  }
  if (current.entries && previous.entries) {
    for (const entry of current.entries) {
      const prev = previous.entries.find((e: any) => e.type === entry.type);
      if (prev && entry.value != null && prev.value != null) {
        const d = +(entry.value - prev.value).toFixed(1);
        if (d !== 0) diffs.push({ label: entry.type, diff: d, unit: 'см' });
      }
    }
  }
  return diffs.length > 0 ? diffs : null;
}

function formatDiff(diff: number): string {
  return diff > 0 ? `+${diff}` : `${diff}`;
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold dark:text-white">Заміри тіла</h2>
      <button
        @click="showForm = !showForm"
        class="btn-primary btn-sm !rounded-xl gap-1"
        style="background: linear-gradient(135deg, #14b8a6, #0d9488)"
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

    <!-- Weight summary card with sparkline -->
    <div v-if="!loading && measurements.length > 0" class="card p-4 mb-6">
      <div class="flex items-center justify-between mb-2">
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Поточна вага</p>
          <p class="text-2xl font-bold dark:text-white">
            {{ latestWeight ?? '—' }}
            <span class="text-sm font-normal text-gray-400">кг</span>
          </p>
          <p
            v-if="weightTrend !== null"
            class="text-xs font-medium mt-0.5"
            :class="
              weightTrend > 0
                ? 'text-red-500'
                : weightTrend < 0
                  ? 'text-emerald-500'
                  : 'text-gray-400'
            "
          >
            {{ formatDiff(weightTrend) }} кг з минулого разу
          </p>
        </div>
        <!-- Sparkline -->
        <div v-if="weightHistory.length >= 2" class="w-32 h-12">
          <svg viewBox="0 0 200 40" class="w-full h-full">
            <path
              :d="sparklinePath"
              class="sparkline stroke-teal-500 dark:stroke-teal-400"
              fill="none"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- Add form -->
    <transition name="slide-down">
      <div v-if="showForm" class="mb-6 p-4 card space-y-3">
        <div class="flex gap-3">
          <div class="flex-1">
            <label
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block"
              >Дата</label
            >
            <input v-model="form.date" type="date" class="input" />
          </div>
          <div class="w-28">
            <label
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block"
              >Вага (кг)</label
            >
            <input
              v-model.number="form.weight"
              type="number"
              step="0.1"
              placeholder="кг"
              class="input"
            />
          </div>
        </div>

        <div
          v-for="(entry, i) in form.entries"
          :key="i"
          class="flex gap-2 items-center"
        >
          <select v-model="entry.type" class="input input-sm flex-1">
            <option value="">Оберіть...</option>
            <option v-for="t in measurementTypes" :key="t" :value="t">
              {{ t }}
            </option>
          </select>
          <input
            v-model.number="entry.value"
            type="number"
            step="0.1"
            placeholder="см"
            class="input input-sm w-20"
          />
          <button
            @click="removeEntry(i)"
            class="text-red-400 hover:text-red-600 p-1"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <button
          @click="addEntry"
          class="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 font-medium"
        >
          + Додати замір
        </button>

        <textarea
          v-model="form.notes"
          placeholder="Нотатки (необов'язково)"
          rows="2"
          class="input text-sm !min-h-[60px] resize-none"
        ></textarea>

        <button
          @click="saveMeasurement"
          class="btn-primary w-full"
          style="background: linear-gradient(135deg, #14b8a6, #0d9488)"
        >
          Зберегти
        </button>
      </div>
    </transition>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div class="skeleton h-24 w-full"></div>
      <div class="skeleton h-24 w-full"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="measurements.length === 0" class="text-center py-12">
      <div
        class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center"
      >
        <svg
          class="w-8 h-8 text-teal-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p class="text-gray-500 dark:text-gray-400 font-medium">
        Поки немає замірів
      </p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
        Відстежуйте прогрес тіла
      </p>
    </div>

    <!-- Measurements list -->
    <div v-else class="space-y-3">
      <div
        v-for="(m, index) in measurements"
        :key="m.id"
        class="card p-4 border-l-4 border-l-teal-400 dark:border-l-teal-600"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="font-semibold text-gray-900 dark:text-white">{{
            formatDate(m.date)
          }}</span>
          <button
            @click="deleteMeasurement(m.id)"
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

        <!-- Weight -->
        <p v-if="m.weight" class="text-sm text-gray-700 dark:text-gray-300">
          <span class="font-medium">Вага:</span> {{ m.weight }} кг
          <span
            v-if="getDiff(index)?.find((d) => d.label === 'Вага')"
            :class="
              getDiff(index)!.find((d) => d.label === 'Вага')!.diff > 0
                ? 'text-red-500'
                : 'text-emerald-500'
            "
            class="ml-1 text-xs font-bold"
          >
            {{
              formatDiff(getDiff(index)!.find((d) => d.label === 'Вага')!.diff)
            }}
            кг
          </span>
        </p>

        <!-- Entries -->
        <div v-if="m.entries?.length" class="mt-1.5 space-y-0.5">
          <p
            v-for="e in m.entries"
            :key="e.id"
            class="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1"
          >
            <span>{{ e.type }}: {{ e.value }} см</span>
            <span
              v-if="getDiff(index)?.find((d) => d.label === e.type)"
              :class="
                getDiff(index)!.find((d) => d.label === e.type)!.diff > 0
                  ? 'text-emerald-500'
                  : 'text-red-500'
              "
              class="text-xs font-bold"
            >
              {{
                formatDiff(
                  getDiff(index)!.find((d) => d.label === e.type)!.diff,
                )
              }}
              см
            </span>
          </p>
        </div>

        <!-- Notes -->
        <p
          v-if="m.notes"
          class="text-xs text-gray-400 dark:text-gray-500 mt-2 italic"
        >
          {{ m.notes }}
        </p>

        <!-- Photos -->
        <div class="mt-3" v-if="isOnline">
          <div
            v-if="m.photos && m.photos.length > 0"
            class="flex gap-2 flex-wrap"
          >
            <div
              v-for="photo in m.photos"
              :key="photo.id"
              class="relative group"
            >
              <img
                v-if="photo.url"
                :src="photo.url"
                :alt="photo.original_name"
                class="w-20 h-20 object-cover rounded-xl cursor-pointer border-2 border-transparent hover:border-teal-400 transition-all shadow-sm"
                @click="openLightbox(photo.url)"
              />
              <div
                v-else
                class="w-20 h-20 rounded-xl bg-gray-700 animate-pulse"
              ></div>
              <button
                @click="deletePhoto(m.id, photo.id)"
                class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                ✕
              </button>
            </div>
          </div>
          <label
            class="inline-flex items-center gap-1.5 mt-2 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 cursor-pointer font-medium"
          >
            <span v-if="uploading === m.id">Завантаження...</span>
            <template v-else>
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
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Додати фото</span>
            </template>
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              :disabled="uploading === m.id"
              @change="handlePhotoUpload(m.id, $event)"
            />
          </label>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <teleport to="body">
      <transition name="fade">
        <div
          v-if="lightboxSrc"
          class="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
          @click="closeLightbox"
        >
          <img
            :src="lightboxSrc"
            class="max-w-full max-h-full rounded-xl shadow-2xl"
            @click.stop
          />
          <button
            class="absolute top-6 right-6 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            @click="closeLightbox"
          >
            <svg
              class="w-6 h-6"
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
          </button>
        </div>
      </transition>
    </teleport>
  </div>
</template>
