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

const calcMode = ref<'latest' | 'average'>('latest');
const cookedPortion = ref<number | null>(null);

const selectedRatio = computed(() => {
  if (calcMode.value === 'average' && ratioData.value?.avg_ratio)
    return ratioData.value.avg_ratio;
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
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button
        @click="router.push('/food')"
        class="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
      >
        <svg
          class="w-5 h-5 text-gray-600 dark:text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <h2 class="text-xl font-bold dark:text-white flex-1 truncate">
        {{ ratioData?.food_item?.name || '...' }}
      </h2>
      <button
        @click="showForm = !showForm"
        class="btn-primary btn-sm !rounded-xl gap-1"
        style="background: linear-gradient(135deg, #f97316, #ea580c)"
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
        Партія
      </button>
    </div>

    <!-- Calculator -->
    <div
      class="card p-4 mb-6 border-l-4 border-l-orange-400 dark:border-l-orange-600"
    >
      <h3
        class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"
      >
        <svg
          class="w-5 h-5 text-orange-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        Калькулятор порції
      </h3>

      <div
        v-if="batches.length === 0"
        class="text-sm text-gray-500 dark:text-gray-400"
      >
        Додайте хоча б одну партію для розрахунку.
      </div>

      <template v-else>
        <div class="flex gap-2 mb-3">
          <button
            @click="calcMode = 'latest'"
            :class="[
              'px-3 py-2 text-xs rounded-lg font-medium transition-all',
              calcMode === 'latest'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
            ]"
          >
            Остання партія
          </button>
          <button
            @click="calcMode = 'average'"
            :class="[
              'px-3 py-2 text-xs rounded-lg font-medium transition-all',
              calcMode === 'average'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
            ]"
          >
            Середній коеф.
          </button>
        </div>

        <div class="flex gap-3 items-end">
          <div class="flex-1">
            <label
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block"
              >Порція готового (г)</label
            >
            <input
              v-model.number="cookedPortion"
              type="number"
              step="1"
              placeholder="г"
              class="input"
            />
          </div>
          <div class="flex-1">
            <label
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block"
              >= Сирого (г)</label
            >
            <div
              class="px-4 py-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl font-bold text-orange-700 dark:text-orange-300 text-lg min-h-[44px] flex items-center"
            >
              {{ rawEquivalent !== null ? rawEquivalent : '—' }}
            </div>
          </div>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Коефіцієнт: {{ selectedRatio?.toFixed(4) }} (×{{
            selectedRatio ? (1 / selectedRatio).toFixed(2) : '—'
          }}
          при варці)
        </p>
      </template>
    </div>

    <!-- Add batch form -->
    <transition name="slide-down">
      <div v-if="showForm" class="mb-6 p-4 card space-y-3">
        <div class="flex gap-3">
          <div class="flex-1">
            <label
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block"
              >Сире (г)</label
            >
            <input
              v-model.number="form.raw_weight"
              type="number"
              step="0.1"
              placeholder="г"
              class="input"
            />
          </div>
          <div class="flex-1">
            <label
              class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block"
              >Готове (г)</label
            >
            <input
              v-model.number="form.cooked_weight"
              type="number"
              step="0.1"
              placeholder="г"
              class="input"
            />
          </div>
        </div>
        <input
          v-model="form.notes"
          type="text"
          placeholder="Нотатки (необов'язково)"
          class="input text-sm"
        />
        <button
          @click="addBatch"
          :disabled="!form.raw_weight || !form.cooked_weight"
          class="btn-primary w-full disabled:opacity-50"
          style="background: linear-gradient(135deg, #f97316, #ea580c)"
        >
          Зберегти партію
        </button>
      </div>
    </transition>

    <!-- Batches list -->
    <div v-if="batches.length === 0" class="text-center py-12">
      <div
        class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"
      >
        <svg
          class="w-8 h-8 text-orange-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <p class="text-gray-500 dark:text-gray-400 font-medium">
        Поки немає партій
      </p>
    </div>

    <div v-else class="space-y-2">
      <div v-for="batch in batches" :key="batch.id" class="card p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-gray-500 dark:text-gray-400">{{
            formatDate(batch.cooked_at)
          }}</span>
          <button
            @click="deleteBatch(batch.id)"
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
        <div class="flex gap-4 text-sm">
          <span class="text-gray-700 dark:text-gray-300"
            >Сире: <strong>{{ batch.raw_weight }} г</strong></span
          >
          <span class="text-gray-700 dark:text-gray-300"
            >Готове: <strong>{{ batch.cooked_weight }} г</strong></span
          >
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex gap-3">
          <span class="badge-amber">Коеф: {{ batchRatio(batch) }}</span>
          <span class="badge-gray"
            >×{{ batchMultiplier(batch) }} при варці</span
          >
        </div>
        <p
          v-if="batch.notes"
          class="text-xs text-gray-400 dark:text-gray-500 mt-2 italic"
        >
          {{ batch.notes }}
        </p>
      </div>
    </div>
  </div>
</template>
