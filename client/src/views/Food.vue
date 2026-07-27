<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { api } from '@/api';

const userStore = useUserStore();
const router = useRouter();
const items = ref<any[]>([]);
const newName = ref('');
const showForm = ref(false);

onMounted(async () => {
  await loadItems();
});

async function loadItems() {
  items.value = await api.getFoodItems(userStore.currentUser!.id);
}

async function addItem() {
  if (!newName.value.trim()) return;
  await api.createFoodItem(userStore.currentUser!.id, newName.value.trim());
  newName.value = '';
  showForm.value = false;
  await loadItems();
}

async function deleteItem(id: number) {
  if (!confirm('Видалити продукт і всі його партії?')) return;
  await api.deleteFoodItem(userStore.currentUser!.id, id);
  await loadItems();
}

function openDetail(id: number) {
  router.push(`/food/${id}`);
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">Продукти</h2>
      <button
        @click="showForm = !showForm"
        class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
      >
        + Новий
      </button>
    </div>

    <div v-if="showForm" class="mb-4 p-3 bg-white rounded-lg border space-y-3">
      <div>
        <label class="text-xs text-gray-500">Назва продукту</label>
        <input
          v-model="newName"
          type="text"
          placeholder="напр. Рис, Сочевиця, Курка..."
          class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
          @keyup.enter="addItem"
        />
      </div>
      <button
        @click="addItem"
        :disabled="!newName.trim()"
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        Додати
      </button>
    </div>

    <div v-if="items.length === 0" class="text-center text-gray-400 py-8">
      Поки немає продуктів.
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="bg-white rounded-lg border p-3 flex items-center justify-between"
      >
        <button
          @click="openDetail(item.id)"
          class="text-left flex-1 font-medium hover:text-blue-600"
        >
          {{ item.name }}
        </button>
        <button
          @click.stop="deleteItem(item.id)"
          class="text-red-400 hover:text-red-600 text-sm ml-2"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>
