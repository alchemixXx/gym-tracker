<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { api } from '@/api';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const foodItemId = Number(route.params.id);
const batches = ref<any[]>([]);
const ratioData = ref<any>(null);
const showForm = ref(false);

const form = ref({
  raw_weight: null as number | null,
  cooked_weight: null as number | null,
  notes: '',
});

// Calculator
const calcMode = ref<'latest' | 'average'>('latest');
const cookedPortion = ref<number | null>(null);

const selectedRatio = computed(() => {
  if (calcMode.value === 'average' && ratioData.value?.avg_ratio) {
    return ratioData.value.avg_ratio;
  }
  if (batches.value.length > 0) {
    const latest = batches.value[0];
    return Number(latest.raw_weight) / Number(latest.cooked_weight);
  }
  return null;
});

const rawEquivalent = computed(() => {
  if (!cookedPortion.value || !selectedRatio.value) return null;
  return Math.round(cookedPortion.value * selectedRatio.value * 10) / 10;
});

onMounted(async () => {
  await loadData();
});

async function loadData() {
  const userId = userStore.currentUser!.id;
  [batches.value, ratioData.value] = await Promise.all([
    api.getBatches(userId, foodItemId),
    api.getFoodRatio(userId, foodItemId),
  ]);
}

async function addBatch() {
  if (!form.value.raw_weight || !form.value.cooked_weight) return;
  await api.createBatch(userStore.currentUser!.id, foodItemId, {
    raw_weight: form.value.raw_weight,
    cooked_weight: form.value.cooked_weight,
    notes: form.value.notes || undefined,
  });
  form.value = { raw_weight: null, cooked_weight: null, notes: '' };
  showForm.value = false;
  await loadData();
}

async function deleteBatch(batchId: number) {
  if (!confirm('Видалити партію?')) return;
  await api.deleteBatch(userStore.currentUser!.id, foodItemId, batchId);
  await loadData();
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('uk', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function batchRatio(batch: any) {
  return (Number(batch.raw_weight) / Number(batch.cooked_weight)).toFixed(4);
}

function batchMultiplier(batch: any) {
  return (Number(batch.cooked_weight) / Number(batch.raw_weight)).toFixed(2);
}
</script>

<template>
  <div>
    <button
      @click="router.push('/food')"
      class="text-sm text-blue-600 hover:text-blue-800 mb-3"
    >
      ← Назад
    </button>

    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">{{ ratioData?.food_item?.name || '...' }}</h2>
      <button
        @click="showForm = !showForm"
        class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
      >
        + Партія
      </button>
    </div>

    <!-- Calculator -->
    <div class="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
      <h3 class="font-medium text-sm text-blue-800">Калькулятор порції</h3>

      <div v-if="batches.length === 0" class="text-sm text-gray-500">
        Додайте хоча б одну партію для розрахунку.
      </div>

      <template v-else>
        <div class="flex gap-2">
          <button
            @click="calcMode = 'latest'"
            :class="[
              'px-2 py-1 text-xs rounded',
              calcMode === 'latest'
                ? 'bg-blue-600 text-white'
                : 'bg-white border text-gray-600',
            ]"
          >
            Остання партія
          </button>
          <button
            @click="calcMode = 'average'"
            :class="[
              'px-2 py-1 text-xs rounded',
              calcMode === 'average'
                ? 'bg-blue-600 text-white'
                : 'bg-white border text-gray-600',
            ]"
          >
            Середній коеф.
          </button>
        </div>

        <div class="flex gap-2 items-end">
          <div class="flex-1">
            <label class="text-xs text-gray-500">Порція готового (г)</label>
            <input
              v-model.number="cookedPortion"
              type="number"
              step="1"
              placeholder="г"
              class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
            />
          </div>
          <div class="flex-1">
            <label class="text-xs text-gray-500">= Сирого (г)</label>
            <div class="px-3 py-2 bg-white border rounded-lg font-bold text-blue-700">
              {{ rawEquivalent !== null ? rawEquivalent : '—' }}
            </div>
          </div>
        </div>

        <p class="text-xs text-gray-500">
          Коефіцієнт: {{ selectedRatio?.toFixed(4) }}
          (×{{ selectedRatio ? (1 / selectedRatio).toFixed(2) : '—' }} при варці)
        </p>
      </template>
    </div>

    <!-- Add batch form -->
    <div v-if="showForm" class="mb-4 p-3 bg-white rounded-lg border space-y-3">
      <div class="flex gap-2">
        <div class="flex-1">
          <label class="text-xs text-gray-500">Сире (г)</label>
          <input
            v-model.number="form.raw_weight"
            type="number"
            step="0.1"
            placeholder="г"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
        <div class="flex-1">
          <label class="text-xs text-gray-500">Готове (г)</label>
          <input
            v-model.number="form.cooked_weight"
            type="number"
            step="0.1"
            placeholder="г"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>
      <input
        v-model="form.notes"
        type="text"
        placeholder="Нотатки (необов'язково)"
        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400 text-sm"
      />
      <button
        @click="addBatch"
        :disabled="!form.raw_weight || !form.cooked_weight"
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        Зберегти партію
      </button>
    </div>

    <!-- Batches list -->
    <div v-if="batches.length === 0" class="text-center text-gray-400 py-8">
      Поки немає партій.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="batch in batches"
        :key="batch.id"
        class="bg-white rounded-lg border p-3"
      >
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm text-gray-500">{{ formatDate(batch.cooked_at) }}</span>
          <button
            @click="deleteBatch(batch.id)"
            class="text-red-400 hover:text-red-600 text-sm"
          >
            ✕
          </button>
        </div>
        <div class="flex gap-4 text-sm">
          <span>Сире: <strong>{{ batch.raw_weight }} г</strong></span>
          <span>Готове: <strong>{{ batch.cooked_weight }} г</strong></span>
        </div>
        <div class="text-xs text-gray-500 mt-1">
          Коеф: {{ batchRatio(batch) }} | Множник варки: ×{{ batchMultiplier(batch) }}
        </div>
        <p v-if="batch.notes" class="text-xs text-gray-400 mt-1 italic">
          {{ batch.notes }}
        </p>
      </div>
    </div>
  </div>
</template>
