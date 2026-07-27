<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useUserStore } from '@/stores/user';
import { api } from '@/api';

const userStore = useUserStore();
const measurements = ref<any[]>([]);
const showForm = ref(false);

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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('uk');
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
        v-for="m in measurements"
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
        <p v-if="m.weight" class="text-sm">Вага: {{ m.weight }} кг</p>
        <p v-for="e in m.entries" :key="e.id" class="text-sm text-gray-600">
          {{ e.type }}: {{ e.value }} см
        </p>
        <p v-if="m.notes" class="text-xs text-gray-400 mt-1 italic">
          {{ m.notes }}
        </p>
      </div>
    </div>
  </div>
</template>
