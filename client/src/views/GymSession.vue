<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { api } from '@/api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const program = ref<any>(null)
const day = ref<any>(null)
const dayNote = ref('')
const exerciseNotes = ref<Record<number, string>>({})

const programId = Number(route.params.id)
const dayId = Number(route.params.dayId)
const userId = computed(() => userStore.currentUser!.id)

onMounted(async () => {
  program.value = await api.getProgram(userId.value, programId)
  day.value = program.value.days.find((d: any) => d.id === dayId)
  if (day.value) {
    dayNote.value = day.value.day_note || ''
    for (const ex of day.value.exercises) {
      if (ex.note) exerciseNotes.value[ex.id] = ex.note
    }
  }
})

async function toggleSet(exercise: any, set: any) {
  set.done = !set.done
  await api.updateSet(userId.value, programId, dayId, exercise.id, set.id, {
    done: set.done,
  })
}

async function saveExerciseNote(exercise: any) {
  const note = exerciseNotes.value[exercise.id] || ''
  await api.updateExercise(userId.value, programId, dayId, exercise.id, { note })
}

async function finishSession() {
  if (!dayNote.value.trim()) {
    alert('Додайте коментар до тренування')
    return
  }
  await api.updateDay(userId.value, programId, dayId, {
    day_note: dayNote.value.trim(),
    completed_at: new Date().toISOString(),
  })
  router.push(`/programs/${programId}`)
}

function formatSet(set: any) {
  const weight = set.weight ? `${set.weight} кг` : 'без ваги'
  if (set.count > 1) {
    return `${weight} ${set.count}×${set.reps}`
  }
  return `${weight} × ${set.reps}`
}
</script>

<template>
  <div v-if="day">
    <div class="flex items-center gap-2 mb-4">
      <button @click="router.push(`/programs/${programId}`)" class="text-gray-400 hover:text-gray-600">←</button>
      <h2 class="text-lg font-bold">{{ day.name }}</h2>
    </div>

    <div class="space-y-4 mb-6">
      <div
        v-for="(exercise, ei) in day.exercises"
        :key="exercise.id"
        class="bg-white rounded-lg border p-3"
      >
        <p class="font-medium mb-2">{{ ei + 1 }}. {{ exercise.name }}</p>

        <div class="space-y-1 mb-2">
          <button
            v-for="set in exercise.sets"
            :key="set.id"
            @click="toggleSet(exercise, set)"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition"
            :class="set.done ? 'bg-green-50 text-green-700 line-through' : 'bg-gray-50 hover:bg-gray-100'"
          >
            <span class="w-5 h-5 rounded border flex items-center justify-center text-xs"
              :class="set.done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'"
            >
              <span v-if="set.done">✓</span>
            </span>
            {{ formatSet(set) }}
          </button>
        </div>

        <div>
          <input
            v-model="exerciseNotes[exercise.id]"
            @blur="saveExerciseNote(exercise)"
            placeholder="Коментар до вправи..."
            class="w-full text-xs px-2 py-1 border border-dashed rounded focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>
    </div>

    <div class="sticky bottom-4 bg-white rounded-lg border p-3 space-y-2">
      <textarea
        v-model="dayNote"
        placeholder="Коментар до тренування (обов'язково)"
        rows="2"
        class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400 text-sm"
      ></textarea>
      <button
        @click="finishSession"
        class="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
      >
        Завершити тренування
      </button>
    </div>
  </div>
</template>
