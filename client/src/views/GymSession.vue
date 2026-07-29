<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { api } from '@/api';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const program = ref<any>(null);
const day = ref<any>(null);
const dayNote = ref('');
const exerciseNotes = ref<Record<number, string>>({});

const programId = Number(route.params.id);
const dayId = Number(route.params.dayId);
const userId = computed(() => userStore.currentUser!.id);

// Rest timer
const restTimer = ref(0);
const restInterval = ref<number | null>(null);
const restPresets = [60, 90, 120, 180];
const showRestTimer = ref(false);

// Progress
const totalSets = computed(() => {
  if (!day.value) return 0;
  return day.value.exercises.reduce(
    (acc: number, ex: any) =>
      acc +
      ex.sets.reduce((sum: number, s: any) => sum + (Number(s.count) || 1), 0),
    0,
  );
});
const doneSets = computed(() => {
  if (!day.value) return 0;
  return day.value.exercises.reduce(
    (acc: number, ex: any) =>
      acc +
      ex.sets
        .filter((s: any) => s.done)
        .reduce((sum: number, s: any) => sum + (Number(s.count) || 1), 0),
    0,
  );
});
const progressPercent = computed(() =>
  totalSets.value > 0
    ? Math.round((doneSets.value / totalSets.value) * 100)
    : 0,
);

// SVG progress ring calculations
const ringRadius = 40;
const ringCircumference = 2 * Math.PI * ringRadius;
const ringOffset = computed(
  () => ringCircumference - (progressPercent.value / 100) * ringCircumference,
);

onMounted(async () => {
  program.value = await api.getProgram(userId.value, programId);
  day.value = program.value.days.find((d: any) => d.id === dayId);
  if (day.value) {
    dayNote.value = day.value.day_note || '';
    for (const ex of day.value.exercises) {
      if (ex.note) exerciseNotes.value[ex.id] = ex.note;
    }
  }
});

onUnmounted(() => {
  if (restInterval.value) clearInterval(restInterval.value);
});

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10);
}

async function toggleSet(exercise: any, set: any) {
  set.done = !set.done;
  haptic();
  if (set.done) {
    showRestTimer.value = true;
    startRest(90);
  }
  await api.updateSet(userId.value, programId, dayId, exercise.id, set.id, {
    done: set.done,
  });
}

async function saveExerciseNote(exercise: any) {
  const note = exerciseNotes.value[exercise.id] || '';
  await api.updateExercise(userId.value, programId, dayId, exercise.id, {
    note,
  });
}

async function finishSession() {
  if (!dayNote.value.trim()) {
    alert('Додайте коментар до тренування');
    return;
  }
  await api.updateDay(userId.value, programId, dayId, {
    day_note: dayNote.value.trim(),
    completed_at: new Date().toISOString(),
  });
  haptic();
  router.push(`/programs/${programId}`);
}

function formatSet(set: any) {
  const weight = set.weight ? `${set.weight} кг` : 'без ваги';
  if (set.count > 1) return `${weight} ${set.count}×${set.reps}`;
  return `${weight} × ${set.reps}`;
}

// Rest timer functions
function startRest(seconds: number) {
  if (restInterval.value) clearInterval(restInterval.value);
  restTimer.value = seconds;
  restInterval.value = window.setInterval(() => {
    restTimer.value--;
    if (restTimer.value <= 0) {
      clearInterval(restInterval.value!);
      restInterval.value = null;
      haptic();
    }
  }, 1000);
}

function stopRest() {
  if (restInterval.value) clearInterval(restInterval.value);
  restInterval.value = null;
  restTimer.value = 0;
  showRestTimer.value = false;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<template>
  <div v-if="day">
    <!-- Header with back -->
    <div class="flex items-center gap-3 mb-4">
      <button
        @click="router.push(`/programs/${programId}`)"
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
      <h2 class="text-lg font-bold dark:text-white flex-1 truncate">
        {{ day.name }}
      </h2>
    </div>

    <!-- Progress Ring -->
    <div class="card p-4 mb-6 flex items-center gap-4">
      <div class="relative w-24 h-24 flex-shrink-0">
        <svg class="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            :r="ringRadius"
            fill="none"
            stroke="currentColor"
            class="text-gray-200 dark:text-gray-800"
            stroke-width="8"
          />
          <circle
            cx="50"
            cy="50"
            :r="ringRadius"
            fill="none"
            class="text-blue-500 dark:text-blue-400 progress-ring-circle"
            stroke="currentColor"
            stroke-width="8"
            stroke-linecap="round"
            :stroke-dasharray="ringCircumference"
            :stroke-dashoffset="ringOffset"
            :style="{
              '--ring-circumference': ringCircumference,
              '--ring-offset': ringOffset,
            }"
          />
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-xl font-bold text-gray-900 dark:text-white"
            >{{ progressPercent }}%</span
          >
        </div>
      </div>
      <div>
        <p class="font-semibold text-gray-900 dark:text-white">
          {{ doneSets }} / {{ totalSets }}
        </p>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          підходів виконано
        </p>
        <p
          v-if="progressPercent === 100"
          class="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1"
        >
          🎉 Всі вправи завершені!
        </p>
      </div>
    </div>

<!-- Rest Timer (floating) -->
<transition name="slide-up">
      <div v-if="showRestTimer && restTimer > 0" class="card p-4 mb-4 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <span class="text-lg">⏱</span>
            </div>
            <div>
              <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Відпочинок</p>
              <p class="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{{ formatTime(restTimer) }}</p>
            </div>
          </div>
          <button @click="stopRest" class="w-9 h-9 rounded-xl bg-blue-200 dark:bg-blue-800 hover:bg-blue-300 dark:hover:bg-blue-700 flex items-center justify-center transition-colors">
            <svg class="w-4 h-4 text-blue-700 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </transition>

<!-- Rest Timer presets (when not running) -->
<transition name="slide-up">
      <div v-if="showRestTimer && restTimer <= 0" class="card p-4 mb-4">
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Таймер відпочинку:</p>
        <div class="flex gap-2">
          <button
            v-for="preset in restPresets"
            :key="preset"
            @click="startRest(preset)"
            class="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            {{ formatTime(preset) }}
          </button>
        </div>
        <button @click="showRestTimer = false" class="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1">
          Сховати
        </button>
      </div>
    </transition>

    <!-- Exercises -->
    <div class="space-y-4 mb-6">
      <div
        v-for="(exercise, ei) in day.exercises"
        :key="exercise.id"
        class="card p-4"
      >
        <p class="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
            {{ ei + 1 }}
          </span>
          {{ exercise.name }}
        </p>

        <div class="space-y-2 mb-3">
          <button
            v-for="(set, si) in exercise.sets"
            :key="set.id"
            @click="toggleSet(exercise, set)"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 min-h-[48px] active:scale-[0.97]"
            :class="set.done
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700'"
          >
            <span
              class="w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all"
              :class="set.done
                ? 'bg-emerald-500 border-emerald-500 bounce-check'
                : 'border-gray-300 dark:border-gray-600'"
            >
              <svg v-if="set.done" class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </span>
            <span class="flex-1 text-left" :class="{ 'line-through opacity-60': set.done }">
              {{ formatSet(set) }}
            </span>
            <span class="text-xs text-gray-400 dark:text-gray-500">S{{ si + 1 }}</span>
          </button>
        </div>

        <div>
          <input
            v-model="exerciseNotes[exercise.id]"
            @blur="saveExerciseNote(exercise)"
            placeholder="Коментар до вправи..."
            class="w-full text-xs px-3 py-2 border border-dashed border-gray-300 dark:border-gray-700 bg-transparent rounded-xl focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 dark:text-gray-300 placeholder:text-gray-400"
          />
        </div>
      </div>
    </div>

    <!-- Finish session (sticky) -->
    <div class="sticky bottom-20 z-10 card p-4 space-y-3 shadow-lg">
      <textarea
        v-model="dayNote"
        placeholder="Коментар до тренування (обов'язково)"
        rows="2"
        class="input text-sm !min-h-[60px] resize-none"
      ></textarea>
      <button
        @click="finishSession"
        class="btn-success w-full gap-2 text-base"
      >
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        Завершити тренування
      </button>
    </div>
  </div>
</template>
