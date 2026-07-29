<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { api } from '@/api';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const program = ref<any>(null);
const editing = ref(false);
const saving = ref(false);
const expandedDays = ref<Record<number, boolean>>({});
const exerciseHistory = ref<Record<string, any[]>>({});
const historyLoading = ref<Record<string, boolean>>({});
const dayHistory = ref<Record<number, any[]>>({});
const dayHistoryLoading = ref<Record<number, boolean>>({});

onMounted(async () => {
  await loadProgram();
});

async function loadProgram() {
  program.value = await api.getProgram(
    userStore.currentUser!.id,
    Number(route.params.id),
  );
}

const totalProgress = computed(() => {
  if (!program.value?.days) return 0;
  const total = program.value.days.length;
  const done = program.value.days.filter((d: any) => d.completed_at).length;
  return total > 0 ? Math.round((done / total) * 100) : 0;
});

function dayProgress(day: any) {
  const totalSets = day.exercises.reduce(
    (acc: number, ex: any) =>
      acc +
      ex.sets.reduce((sum: number, s: any) => sum + (Number(s.count) || 1), 0),
    0,
  );
  const doneSets = day.exercises.reduce(
    (acc: number, ex: any) =>
      acc +
      ex.sets
        .filter((s: any) => s.done)
        .reduce((sum: number, s: any) => sum + (Number(s.count) || 1), 0),
    0,
  );
  return { totalSets, doneSets };
}

function startSession(dayId: number) {
  router.push(`/programs/${program.value.id}/session/${dayId}`);
}
function toggleDay(dayId: number) {
  expandedDays.value[dayId] = !expandedDays.value[dayId];
}
function enterEdit() {
  editing.value = true;
}
function cancelEdit() {
  editing.value = false;
  loadProgram();
}
function addDay() {
  program.value.days.push({ name: '', exercises: [] });
}
function removeDay(index: number) {
  program.value.days.splice(index, 1);
}
function addExercise(dayIndex: number) {
  program.value.days[dayIndex].exercises.push({ name: '', sets: [] });
}
function removeExercise(dayIndex: number, exIndex: number) {
  program.value.days[dayIndex].exercises.splice(exIndex, 1);
}
function addSet(dayIndex: number, exIndex: number) {
  program.value.days[dayIndex].exercises[exIndex].sets.push({
    weight: null,
    reps: 10,
    count: 1,
  });
}
function removeSet(dayIndex: number, exIndex: number, setIndex: number) {
  program.value.days[dayIndex].exercises[exIndex].sets.splice(setIndex, 1);
}

async function saveEdit() {
  saving.value = true;
  try {
    const editableDays = program.value.days.filter((d: any) => !d.completed_at);
    await api.updateProgram(userStore.currentUser!.id, program.value.id, {
      name: program.value.name,
      days: editableDays.map((d: any) => ({
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
    });
    editing.value = false;
    await loadProgram();
  } finally {
    saving.value = false;
  }
}

function historyKey(di: number, ei: number) {
  return `${di}-${ei}`;
}

async function loadExerciseHistory(di: number, ei: number) {
  const day = program.value.days[di];
  const ex = day.exercises[ei];
  if (!day.name?.trim() || !ex.name?.trim()) return;
  const key = historyKey(di, ei);
  historyLoading.value[key] = true;
  try {
    exerciseHistory.value[key] = await api.getExerciseHistory(
      userStore.currentUser!.id,
      program.value.id,
      day.name.trim(),
      ex.name.trim(),
    );
  } catch {
    exerciseHistory.value[key] = [];
  } finally {
    historyLoading.value[key] = false;
  }
}

watch(editing, async (isEditing) => {
  if (isEditing && program.value) {
    exerciseHistory.value = {};
    dayHistory.value = {};
    for (let di = 0; di < program.value.days.length; di++) {
      loadDayHistory(di);
      for (let ei = 0; ei < program.value.days[di].exercises.length; ei++) {
        loadExerciseHistory(di, ei);
      }
    }
  }
});

async function loadDayHistory(di: number) {
  const day = program.value.days[di];
  if (!day.name?.trim()) return;
  dayHistoryLoading.value[di] = true;
  try {
    dayHistory.value[di] = await api.getDayHistory(
      userStore.currentUser!.id,
      program.value.id,
      day.name.trim(),
    );
  } catch {
    dayHistory.value[di] = [];
  } finally {
    dayHistoryLoading.value[di] = false;
  }
}

function formatHistoryDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('uk', {
    day: 'numeric',
    month: 'short',
  });
}

const isCompleted = () => program.value?.status === 'completed';

async function finishProgram() {
  if (
    !confirm(
      'Завершити програму? Після цього вона стане доступною лише для перегляду.',
    )
  )
    return;
  await api.finishProgram(userStore.currentUser!.id, program.value.id);
  await loadProgram();
}
</script>

<template>
  <div v-if="program">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <button
        @click="router.push('/programs')"
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
      <div class="flex-1 min-w-0">
        <input
          v-if="editing"
          v-model="program.name"
          class="input text-xl font-bold"
        />
        <h2 v-else class="text-xl font-bold dark:text-white truncate">
          {{ program.name }}
        </h2>
      </div>
      <span v-if="!editing && isCompleted()" class="badge-green"
        >✓ Завершена</span
      >
      <span
        v-else-if="!editing && program.status === 'active'"
        class="badge-blue"
        >▶ Активна</span
      >
      <span
        v-else-if="!editing && program.status === 'pending'"
        class="badge-gray"
        >◌ Очікує</span
      >
    </div>

    <!-- Progress overview -->
    <div v-if="!editing && program.days.length > 0" class="card p-4 mb-6">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-600 dark:text-gray-400"
          >Прогрес програми</span
        >
        <span class="text-sm font-bold text-blue-600 dark:text-blue-400"
          >{{ totalProgress }}%</span
        >
      </div>
      <div class="progress-bar h-3">
        <div
          class="progress-bar-fill bg-gradient-to-r from-blue-500 to-emerald-500"
          :style="{ width: totalProgress + '%' }"
        ></div>
      </div>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
        {{ program.days.filter((d: any) => d.completed_at).length }} /
        {{ program.days.length }} днів завершено
      </p>
    </div>
    <!-- EDIT MODE -->
    <div v-if="editing">
      <div class="space-y-4 mb-6">
        <div v-for="(day, di) in program.days" :key="di" class="card p-4" :class="day.completed_at ? 'opacity-70 border-emerald-200 dark:border-emerald-900' : ''">
          <!-- COMPLETED DAY -->
          <div v-if="day.completed_at">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
              </div>
              <p class="flex-1 font-medium text-gray-600 dark:text-gray-400">{{ day.name }}</p>
              <span class="badge-green text-[10px]">Завершено</span>
            </div>
            <div class="space-y-1 ml-8">
              <div v-for="(ex, ei) in day.exercises" :key="ei" class="text-sm text-gray-500 dark:text-gray-400">
                <span class="text-gray-400">{{ ei + 1 }}.</span> {{ ex.name }}
                <span class="text-xs text-gray-400 ml-1">({{ ex.sets.length }} підх.)</span>
              </div>
            </div>
            <p v-if="day.day_note" class="text-xs text-gray-500 dark:text-gray-400 mt-2 italic ml-8">📝 {{ day.day_note }}</p>
          </div>

          <!-- NON-COMPLETED DAY — editable -->
          <div v-else>
            <div class="flex items-center gap-2 mb-3">
              <input v-model="day.name" placeholder="Назва дня (напр. Спина-біцепс)" @blur="loadDayHistory(di)" class="input flex-1 font-medium" />
              <button @click="removeDay(di)" class="btn-danger btn-sm !min-h-[36px]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Day history -->
            <div v-if="dayHistory[di]?.length" class="mb-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900">
              <p class="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1.5">📋 Коментарі до дня:</p>
              <div v-for="(h, hi) in dayHistory[di]" :key="hi" class="text-xs text-gray-600 dark:text-gray-400 mb-1 last:mb-0">
                <span class="text-blue-600 dark:text-blue-400 font-medium">{{ formatHistoryDate(h.completed_at) }}</span>
                <span class="text-gray-400 ml-1">({{ h.program_name }})</span>:
                <span class="italic">{{ h.day_note }}</span>
              </div>
            </div>
            <div v-else-if="dayHistoryLoading[di]" class="mb-3"><div class="skeleton h-4 w-40"></div></div>

            <div class="space-y-3 ml-2">
              <div v-for="(ex, ei) in day.exercises" :key="ei" class="border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm text-gray-400 font-medium">{{ ei + 1 }}.</span>
                  <input v-model="ex.name" placeholder="Вправа" @blur="loadExerciseHistory(di, ei)" class="input input-sm flex-1" />
                  <button @click="removeExercise(di, ei)" class="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1 transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div class="ml-6 space-y-1.5">
                  <div v-for="(set, si) in ex.sets" :key="si" class="flex items-center gap-1.5 text-sm">
                    <input v-model.number="set.weight" placeholder="кг" type="number" step="0.5" class="w-16 px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-center text-sm focus:outline-none focus:border-blue-500" />
                    <span class="text-gray-400 text-xs">кг</span>
                    <input v-model.number="set.count" type="number" min="1" class="w-12 px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-center text-sm focus:outline-none focus:border-blue-500" />
                    <span class="text-gray-400 text-xs">×</span>
                    <input v-model.number="set.reps" type="number" min="1" class="w-12 px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-center text-sm focus:outline-none focus:border-blue-500" />
                    <button @click="removeSet(di, ei, si)" class="text-red-300 hover:text-red-500 p-1">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <button @click="addSet(di, ei)" class="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 font-medium py-1">+ підхід</button>
                </div>

                <!-- Exercise history -->
                <div v-if="exerciseHistory[historyKey(di, ei)]?.length" class="ml-6 mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                  <p class="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">📝 З попередніх тренувань:</p>
                  <div v-for="(h, hi) in exerciseHistory[historyKey(di, ei)]" :key="hi" class="text-xs text-gray-600 dark:text-gray-400 mb-1 last:mb-0">
                    <span class="text-amber-600 dark:text-amber-400 font-medium">{{ formatHistoryDate(h.completed_at) }}</span>
                    <span class="text-gray-400 ml-1">({{ h.program_name }})</span>:
                    <span class="italic">{{ h.exercise_note }}</span>
                  </div>
                </div>
                <div v-else-if="historyLoading[historyKey(di, ei)]" class="ml-6 mt-1"><div class="skeleton h-3 w-32"></div></div>
              </div>
              <button @click="addExercise(di)" class="text-sm text-blue-500 hover:text-blue-700 dark:text-blue-400 font-medium py-1">+ вправа</button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-2 mb-4">
        <button @click="addDay" class="btn-secondary btn-sm gap-1">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
          День
        </button>
      </div>

      <div class="flex gap-2 sticky bottom-20 z-10">
        <button @click="saveEdit" :disabled="saving" class="btn-primary flex-1">{{ saving ? 'Зберігається...' : 'Зберегти' }}</button>
        <button @click="cancelEdit" class="btn-secondary">Скасувати</button>
      </div>
    </div>

    <!-- VIEW MODE -->
    <div v-else>
      <div class="space-y-3">
        <div v-for="day in program.days" :key="day.id" class="card overflow-hidden" :class="{ 'border-l-status-completed': day.completed_at, 'border-l-status-active': !day.completed_at && dayProgress(day).doneSets > 0, 'border-l-status-pending': !day.completed_at && dayProgress(day).doneSets === 0 }">
          <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" @click="toggleDay(day.id)">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <svg class="w-4 h-4 text-gray-400 transition-transform flex-shrink-0" :class="{ 'rotate-90': expandedDays[day.id] }" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-900 dark:text-white truncate">{{ day.name }}</p>
                <div class="flex items-center gap-2 mt-1">
                  <div class="progress-bar flex-1 max-w-[100px]">
                    <div class="progress-bar-fill" :class="day.completed_at ? 'bg-emerald-500' : 'bg-blue-500'" :style="{ width: (dayProgress(day).totalSets > 0 ? (dayProgress(day).doneSets / dayProgress(day).totalSets * 100) : 0) + '%' }"></div>
                  </div>
                  <span class="text-xs text-gray-400 dark:text-gray-500">{{ dayProgress(day).doneSets }}/{{ dayProgress(day).totalSets }}</span>
                  <svg v-if="day.completed_at" class="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                </div>
                <p v-if="day.day_note" class="text-xs text-gray-500 dark:text-gray-400 mt-1 italic truncate">{{ day.day_note }}</p>
              </div>
            </div>
            <button v-if="!isCompleted()" @click.stop="startSession(day.id)" class="ml-3 flex-shrink-0" :class="day.completed_at ? 'btn-secondary btn-sm' : 'btn-success btn-sm'">
              {{ day.completed_at ? '👁' : '▶ Старт' }}
            </button>
          </div>

          <!-- Expanded exercise preview -->
          <div v-if="expandedDays[day.id]" class="border-t border-gray-100 dark:border-gray-800 px-4 pb-4 pt-3 bg-gray-50/50 dark:bg-gray-800/30">
            <div v-if="day.exercises.length === 0" class="text-xs text-gray-400 py-1">Немає вправ</div>
            <div v-else class="space-y-2.5">
              <div v-for="(ex, ei) in day.exercises" :key="ei" class="text-sm">
                <div class="flex items-baseline gap-2">
                  <span class="text-gray-400 text-xs font-medium">{{ ei + 1 }}.</span>
                  <span class="font-medium text-gray-700 dark:text-gray-300">{{ ex.name }}</span>
                </div>
                <div v-if="ex.sets.length" class="ml-5 mt-1 space-y-0.5">
                  <div v-for="(set, si) in ex.sets" :key="si" class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <span v-if="set.weight">{{ set.weight }} кг</span>
                    <span v-else class="italic">без ваги</span>
                    <span class="text-gray-300 dark:text-gray-600">—</span>
                    <span v-if="set.count > 1">{{ set.count }}×</span>{{ set.reps }} повт
                    <svg v-if="set.done" class="w-3.5 h-3.5 text-emerald-500 ml-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                  </div>
                </div>
                <div v-if="ex.exercise_note" class="ml-5 mt-1 text-xs text-gray-500 dark:text-gray-400 italic">📝 {{ ex.exercise_note }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="program.days.length === 0" class="text-center py-12">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
        </div>
        <p class="text-gray-500 dark:text-gray-400 font-medium">Програма порожня</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Натисніть "Редагувати" щоб додати дні</p>
      </div>

      <div class="mt-6 space-y-2">
        <button v-if="!isCompleted()" @click="enterEdit" class="btn-primary w-full gap-2">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Редагувати програму
        </button>
        <button v-if="!isCompleted()" @click="finishProgram" class="btn-success w-full gap-2">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
          Завершити програму
        </button>
      </div>
    </div>
  </div>
</template>
