<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const newName = ref('')
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  await userStore.fetchUsers()
  loading.value = false
})

async function createUser() {
  if (!newName.value.trim()) return
  const user = await userStore.createUser(newName.value.trim())
  userStore.selectUser(user)
  newName.value = ''
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <h1 class="text-2xl font-bold text-center mb-6">Тренування 💪</h1>
      <p class="text-center text-gray-500 mb-4">Оберіть профіль</p>

      <div v-if="loading" class="text-center text-gray-400">Завантаження...</div>

      <div v-else class="space-y-2 mb-6">
        <button
          v-for="user in userStore.users"
          :key="user.id"
          @click="userStore.selectUser(user)"
          class="w-full p-3 bg-white rounded-lg border hover:border-blue-400 hover:bg-blue-50 text-left transition"
        >
          {{ user.name }}
        </button>
      </div>

      <div class="border-t pt-4">
        <p class="text-sm text-gray-500 mb-2">Або створіть новий:</p>
        <form @submit.prevent="createUser" class="flex gap-2">
          <input
            v-model="newName"
            placeholder="Ваше ім'я"
            class="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            +
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
