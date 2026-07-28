<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useUserStore } from '@/stores/user';
import { api } from '@/api';

const userStore = useUserStore();
const measurements = ref<any[]>([]);
const showForm = ref(false);
const uploading = ref<number | null>(null); // measurement id currently uploading to
const lightboxSrc = ref<string | null>(null);

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

onMounted(async () => {
  await loadMeasurements();
});

async function loadMeasurements() {
  measurements.value = await api.getMeasurements(userStore.currentUser!.id);
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
  await api.createMeasurement(userStore.currentUser!.id, data);
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
  await api.deleteMeasurement(userStore.currentUser!.id, id);
  await loadMeasurements();
}

// Photo handling
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

function photoUrl(filename: string) {
  return `/api/uploads/${filename}`;
}

function openLightbox(filename: string) {
  lightboxSrc.value = photoUrl(filename);
}

function closeLightbox() {
  lightboxSrc.value = null;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('uk');
}

// Measurements are sorted DESC (newest first), so "previous" is the next item in the array
function getDiff(currentIndex: number) {
  const current = measurements.value[currentIndex];
  const previous = measurements.value[currentIndex + 1]; // older measurement
  if (!previous) return null; // oldest measurement — no diff

  const diffs: { label: string; diff: number; unit: string }[] = [];

  // Weight diff
  if (current.weight != null && previous.weight != null) {
    const d = +(current.weight - previous.weight).toFixed(1);
    if (d !== 0) diffs.push({ label: 'Вага', diff: d, unit: 'кг' });
  }

  // Entry diffs — match by type
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
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">Заміри тіла</h2>
      <button
        @click="showForm = !showForm"
        class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
      >
        + Новий
      </button>
    </div>

    <div v-if="showForm" class="mb-4 p-3 bg-white rounded-lg border space-y-3">
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-xs text-gray-500">Дата</label>
          <input
            v-model="form.date"
            type="date"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
        <div class="w-28">
          <label class="text-xs text-gray-500">Вага (кг)</label>
          <input
            v-model.number="form.weight"
            type="number"
            step="0.1"
            placeholder="кг"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div
        v-for="(entry, i) in form.entries"
        :key="i"
        class="flex gap-2 items-center"
      >
        <select
          v-model="entry.type"
          class="flex-1 px-2 py-1.5 border rounded text-sm"
        >
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
          class="w-20 px-2 py-1.5 border rounded text-sm"
        />
        <button @click="removeEntry(i)" class="text-red-400 hover:text-red-600">
          ✕
        </button>
      </div>

      <button
        @click="addEntry"
        class="text-sm text-blue-500 hover:text-blue-700"
      >
        + Додати замір
      </button>

      <textarea
        v-model="form.notes"
        placeholder="Нотатки (необов'язково)"
        rows="2"
        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400 text-sm"
      ></textarea>

      <button
        @click="saveMeasurement"
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Зберегти
      </button>
    </div>

    <div
      v-if="measurements.length === 0"
      class="text-center text-gray-400 py-8"
    >
      Поки немає замірів.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(m, index) in measurements"
        :key="m.id"
        class="bg-white rounded-lg border p-3"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="font-medium">{{ formatDate(m.date) }}</span>
          <button
            @click="deleteMeasurement(m.id)"
            class="text-red-400 hover:text-red-600 text-sm"
          >
            ✕
          </button>
        </div>
        <p v-if="m.weight" class="text-sm">
          Вага: {{ m.weight }} кг
          <span
            v-if="getDiff(index)?.find((d) => d.label === 'Вага')"
            :class="
              getDiff(index)!.find((d) => d.label === 'Вага')!.diff > 0
                ? 'text-red-500'
                : 'text-green-500'
            "
            class="ml-1 text-xs font-medium"
          >
            ({{
              formatDiff(getDiff(index)!.find((d) => d.label === 'Вага')!.diff)
            }}
            кг)
          </span>
        </p>
        <p v-for="e in m.entries" :key="e.id" class="text-sm text-gray-600">
          {{ e.type }}: {{ e.value }} см
          <span
            v-if="getDiff(index)?.find((d) => d.label === e.type)"
            :class="
              getDiff(index)!.find((d) => d.label === e.type)!.diff > 0
                ? 'text-green-500'
                : 'text-red-500'
            "
            class="ml-1 text-xs font-medium"
          >
            ({{
              formatDiff(getDiff(index)!.find((d) => d.label === e.type)!.diff)
            }}
            см)
          </span>
        </p>
        <p v-if="m.notes" class="text-xs text-gray-400 mt-1 italic">
          {{ m.notes }}
        </p>

        <!-- Photos section -->
        <div class="mt-2">
          <div
            v-if="m.photos && m.photos.length > 0"
            class="flex gap-2 flex-wrap mt-1"
          >
            <div
              v-for="photo in m.photos"
              :key="photo.id"
              class="relative group"
            >
              <img
                :src="photoUrl(photo.filename)"
                :alt="photo.original_name"
                class="w-16 h-16 object-cover rounded-lg cursor-pointer border hover:border-blue-400 transition-colors"
                @click="openLightbox(photo.filename)"
              />
              <button
                @click="deletePhoto(m.id, photo.id)"
                class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          </div>
          <label
            class="inline-flex items-center gap-1 mt-1 text-xs text-blue-500 hover:text-blue-700 cursor-pointer"
          >
            <span v-if="uploading === m.id">Завантаження...</span>
            <span v-else>📷 Додати фото</span>
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
    <div
      v-if="lightboxSrc"
      class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      @click="closeLightbox"
    >
      <img
        :src="lightboxSrc"
        class="max-w-full max-h-full rounded-lg"
        @click.stop
      />
      <button
        class="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
        @click="closeLightbox"
      >
        ✕
      </button>
    </div>
  </div>
</template>
