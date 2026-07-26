<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { api } from '@/api'

const router = useRouter()
const userStore = useUserStore()
const programs = ref<any[]>([])
const templates = ref<any[]>([])
const showCreate = ref(false)
const newName = ref('')
const selectedTemplate = ref<number | null>(null)

onMounted(async () => {
  await loadPrograms()
  templates.value = await api.getTemplates(userStore.currentUser!.id)
})

async function loadPrograms() {
  programs.value = await api.getPrograms(userStore.currentUser!.id)
}

async function createProgram() {
  if (!newName.value.trim()) return
  const data: any = {
    name: newName.value.trim(),
    start_date: new Date().toISOString().split('T')[0],
  }
  if (selectedTemplate.value) {
    data.template_id = selectedTemplate.value
  }
  const program = await api.createProgram(userStore.currentUser!.id, data)
  newName.value = ''
  showCreate.value = false
  selectedTemplate.value = null
  router.push(`/programs/${program.id}`)
}

async function deleteProgram(id: number) {
  if (!confirm('Видалити програму?')) return
  await api.deleteProgram(userStore.currentUser!.id, id)
  await loadPrograms()
}

function formatDate(date: string | null) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('uk')
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">Програми</h2>
      <button
        @click="showCreate = !showCreate"
        class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
      >
        + Нова
      </button>
    </div>

    <div v-if="showCreate" class="mb-4 p-3 bg-white rounded-lg border space-y-2">
      <input
        v-model="newName"
        placeholder="Назва програми"
        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
        autofocus
      />
      <select
        v-model="selectedTemplate"
        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
      >
        <option :value="null">Без шаблону (порожня)</option>
        <option v-for="t in templates" :key="t.id" :value="t.id">
          {{ t.name }}
        </option>
      </select>
      <button @click="createProgram" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg">
        Створити
      </button>
    </div>

    <div v-if="programs.length === 0" class="text-center text-gray-400 py-8">
      Поки немає програм. Створіть першу!
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="p in programs"
        :key="p.id"
        class="bg-white rounded-lg border p-3 flex items-center justify-between"
      >
        <div>
          <router-link :to="`/programs/${p.id}`" class="font-medium hover:text-blue-600">
            {{ p.name }}
          </router-link>
          <p class="text-xs text-gray-400">{{ formatDate(p.start_date) }}</p>
        </div>
        <button @click="deleteProgram(p.id)" class="text-red-400 hover:text-red-600 text-sm">
          ✕
        </button>
      </div>
    </div>
  </div>
</template>
