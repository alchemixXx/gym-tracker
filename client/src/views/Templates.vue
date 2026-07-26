<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { api } from '@/api'

const router = useRouter()
const userStore = useUserStore()
const templates = ref<any[]>([])
const showCreate = ref(false)
const newName = ref('')

onMounted(async () => {
  await loadTemplates()
})

async function loadTemplates() {
  templates.value = await api.getTemplates(userStore.currentUser!.id)
}

async function createTemplate() {
  if (!newName.value.trim()) return
  const template = await api.createTemplate(userStore.currentUser!.id, {
    name: newName.value.trim(),
    days: [],
  })
  newName.value = ''
  showCreate.value = false
  router.push(`/templates/${template.id}`)
}

async function deleteTemplate(id: number) {
  if (!confirm('Видалити шаблон?')) return
  await api.deleteTemplate(userStore.currentUser!.id, id)
  await loadTemplates()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">Шаблони</h2>
      <button
        @click="showCreate = !showCreate"
        class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
      >
        + Новий
      </button>
    </div>

    <div v-if="showCreate" class="mb-4 p-3 bg-white rounded-lg border">
      <form @submit.prevent="createTemplate" class="flex gap-2">
        <input
          v-model="newName"
          placeholder="Назва шаблону"
          class="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
          autofocus
        />
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg">
          Створити
        </button>
      </form>
    </div>

    <div v-if="templates.length === 0" class="text-center text-gray-400 py-8">
      Поки немає шаблонів. Створіть перший!
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="t in templates"
        :key="t.id"
        class="bg-white rounded-lg border p-3 flex items-center justify-between"
      >
        <router-link :to="`/templates/${t.id}`" class="font-medium hover:text-blue-600">
          {{ t.name }}
        </router-link>
        <button @click="deleteTemplate(t.id)" class="text-red-400 hover:text-red-600 text-sm">
          ✕
        </button>
      </div>
    </div>
  </div>
</template>
