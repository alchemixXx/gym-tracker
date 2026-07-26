<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { api } from '@/api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const template = ref<any>(null)
const saving = ref(false)

onMounted(async () => {
  await loadTemplate()
})

async function loadTemplate() {
  template.value = await api.getTemplate(
    userStore.currentUser!.id,
    Number(route.params.id)
  )
}

function addDay() {
  template.value.days.push({ name: '', exercises: [] })
}

function removeDay(index: number) {
  template.value.days.splice(index, 1)
}

function addExercise(dayIndex: number) {
  template.value.days[dayIndex].exercises.push({ name: '', sets: [] })
}

function removeExercise(dayIndex: number, exIndex: number) {
  template.value.days[dayIndex].exercises.splice(exIndex, 1)
}

function addSet(dayIndex: number, exIndex: number) {
  template.value.days[dayIndex].exercises[exIndex].sets.push({
    weight: null,
    reps: 10,
    count: 1,
  })
}

function removeSet(dayIndex: number, exIndex: number, setIndex: number) {
  template.value.days[dayIndex].exercises[exIndex].sets.splice(setIndex, 1)
}

async function save() {
  saving.value = true
  try {
    await api.updateTemplate(userStore.currentUser!.id, template.value.id, {
      name: template.value.name,
      days: template.value.days.map((d: any) => ({
        name: d.name,
        exercises: d.exercises.map((e: any) => ({
          name: e.name,
          sets: e.sets.map((s: any) => ({
            weight: s.weight || null,
            reps: Number(s.reps) || 10,
            count: Number(s.count) || 1,
          })),
        })),
      })),
    })
    await loadTemplate()
  } finally {
    saving.value = false
  }
}

async function createProgram() {
  const program = await api.createProgram(userStore.currentUser!.id, {
    name: `${template.value.name} — ${new Date().toLocaleDateString('uk')}`,
    template_id: template.value.id,
  })
  router.push(`/programs/${program.id}`)
}
</script>

<template>
  <div v-if="template">
    <div class="flex items-center gap-2 mb-4">
      <button @click="router.push('/templates')" class="text-gray-400 hover:text-gray-600">←</button>
      <input
        v-model="template.name"
        class="text-xl font-bold bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none flex-1"
      />
    </div>

    <div class="space-y-4 mb-6">
      <div
        v-for="(day, di) in template.days"
        :key="di"
        class="bg-white rounded-lg border p-3"
      >
        <div class="flex items-center gap-2 mb-3">
          <input
            v-model="day.name"
            placeholder="Назва дня (напр. Спина-біцепс)"
            class="flex-1 font-medium px-2 py-1 border rounded focus:outline-none focus:border-blue-400"
          />
          <button @click="removeDay(di)" class="text-red-400 hover:text-red-600 text-sm">✕</button>
        </div>

        <div class="space-y-3 ml-2">
          <div v-for="(ex, ei) in day.exercises" :key="ei" class="border-l-2 border-gray-200 pl-3">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm text-gray-400">{{ ei + 1 }}.</span>
              <input
                v-model="ex.name"
                placeholder="Вправа"
                class="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:border-blue-400"
              />
              <button @click="removeExercise(di, ei)" class="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>

            <div class="ml-5 space-y-1">
              <div v-for="(set, si) in ex.sets" :key="si" class="flex items-center gap-1 text-sm">
                <input
                  v-model.number="set.weight"
                  placeholder="кг"
                  type="number"
                  step="0.5"
                  class="w-16 px-1 py-0.5 border rounded text-center"
                />
                <span class="text-gray-400">кг</span>
                <input
                  v-model.number="set.count"
                  type="number"
                  min="1"
                  class="w-12 px-1 py-0.5 border rounded text-center"
                />
                <span class="text-gray-400">×</span>
                <input
                  v-model.number="set.reps"
                  type="number"
                  min="1"
                  class="w-12 px-1 py-0.5 border rounded text-center"
                />
                <button @click="removeSet(di, ei, si)" class="text-red-300 hover:text-red-500 ml-1">✕</button>
              </div>
              <button
                @click="addSet(di, ei)"
                class="text-xs text-blue-500 hover:text-blue-700"
              >
                + підхід
              </button>
            </div>
          </div>

          <button
            @click="addExercise(di)"
            class="text-sm text-blue-500 hover:text-blue-700"
          >
            + вправа
          </button>
        </div>
      </div>
    </div>

    <div class="flex gap-2 mb-4">
      <button
        @click="addDay"
        class="px-3 py-1.5 border border-blue-600 text-blue-600 text-sm rounded-lg hover:bg-blue-50"
      >
        + День
      </button>
    </div>

    <div class="flex gap-2 sticky bottom-4">
      <button
        @click="save"
        :disabled="saving"
        class="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {{ saving ? 'Зберігається...' : 'Зберегти' }}
      </button>
      <button
        @click="createProgram"
        class="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        → Програма
      </button>
    </div>
  </div>
</template>
