<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import * as offlineApi from '@/db/offlineApi';
import { lastSyncAt } from '@/db/sync';

const userStore = useUserStore();
const router = useRouter();
const items = ref<any[]>([]);
const newName = ref('');
const showForm = ref(false);
const loading = ref(true);

onMounted(async () => {
  await loadItems();
  loading.value = false;
});

// Re-load when sync pulls fresh data
watch(lastSyncAt, () => {
  loadItems();
});

async function loadItems() {
  items.value = await offlineApi.getFoodItems(userStore.currentUser!.id);
}

async function addItem() {
  if (!newName.value.trim()) return;
  await offlineApi.createFoodItem(
    userStore.currentUser!.id,
    newName.value.trim(),
  );
  newName.value = '';
  showForm.value = false;
  await loadItems();
}

async function deleteItem(id: number) {
  if (!confirm('Видалити продукт і всі його партії?')) return;
  await offlineApi.deleteFoodItem(userStore.currentUser!.id, id);
  await loadItems();
}

function openDetail(id: number) {
  router.push(`/food/${id}`);
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold dark:text-white">Продукти</h2>
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
        Новий
      </button>
    </div>

    <!-- Add form -->
    <transition name="slide-down">
      <div v-if="showForm" class="mb-6 p-4 card space-y-3">
        <div>
          <label
            class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block"
            >Назва продукту</label
          >
          <input
            v-model="newName"
            type="text"
            placeholder="напр. Рис, Сочевиця, Курка..."
            class="input"
            @keyup.enter="addItem"
          />
        </div>
        <button
          @click="addItem"
          :disabled="!newName.trim()"
          class="btn-primary w-full disabled:opacity-50"
          style="background: linear-gradient(135deg, #f97316, #ea580c)"
        >
          Додати
        </button>
      </div>
    </transition>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div class="skeleton h-16 w-full"></div>
      <div class="skeleton h-16 w-full"></div>
      <div class="skeleton h-16 w-2/3"></div>
    </div>

    <!-- Empty state -->
    <div v-else-if="items.length === 0" class="text-center py-12">
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
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
          />
        </svg>
      </div>
      <p class="text-gray-500 dark:text-gray-400 font-medium">
        Поки немає продуктів
      </p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
        Додайте продукти для відстеження коефіцієнтів варки
      </p>
    </div>

    <!-- Items list -->
    <div v-else class="space-y-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="card-hover p-4 flex items-center justify-between border-l-4 border-l-orange-400 dark:border-l-orange-600 cursor-pointer"
        @click="openDetail(item.id)"
      >
        <span class="font-semibold text-gray-900 dark:text-white">{{
          item.name
        }}</span>
        <div class="flex items-center gap-2">
          <button
            @click.stop="deleteItem(item.id)"
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
          <svg
            class="w-5 h-5 text-gray-300 dark:text-gray-600"
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
        </div>
      </div>
    </div>
  </div>
</template>
