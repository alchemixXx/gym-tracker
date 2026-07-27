<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { api } from '@/api';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const program = ref<any>(null);
const editing = ref(false);
const saving = ref(false);

// Expanded days in view mode
const expandedDays = ref<Record<number, boolean>>({});

// Exercise history notes from past trainings
const exerciseHistory = ref<Record<string, any[]>>({});
const historyLoading = ref<Record<string, boolean>>({});

// Day history notes from past trainings
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

function dayProgress(day: any) {
  const totalSets = day.exercises.reduce(
    (acc: number, ex: any) => acc + ex.sets.length,
    0,
  );
  const doneSets = day.exercises.reduce(
    (acc: number, ex: any) => acc + ex.sets.filter((s: any) => s.done).length,
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

// --- Edit mode ---
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
    await api.updateProgram(userStore.currentUser!.id, program.value.id, {
      name: program.value.name,
      days: program.value.days.map((d: any) => ({
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

// --- Exercise history ---
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
    const history = await api.getExerciseHistory(
      userStore.currentUser!.id,
      program.value.id,
      day.name.trim(),
      ex.name.trim(),
    );
    exerciseHistory.value[key] = history;
  } catch {
    exerciseHistory.value[key] = [];
  } finally {
    historyLoading.value[key] = false;
  }
}

// Load history for all exercises when entering edit mode
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
    const history = await api.getDayHistory(
      userStore.currentUser!.id,
      program.value.id,
      day.name.trim(),
    );
    dayHistory.value[di] = history;
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
</script>

<template>
  <div v-if="program">
    <div class="flex items-center gap-2 mb-4">
      <button
        @click="router.push('/programs')"
        class="text-gray-400 hover:text-gray-600"
      >
        ←
      </button>
      <input
        v-if="editing"
        v-model="program.name"
        class="text-xl font-bold bg-transparent border-b border-blue-400 focus:outline-none flex-1"
      />
      <h2 v-else class="text-xl font-bold">{{ program.name }}</h2>
    </div>

    <p v-if="program.start_date && !editing" class="text-sm text-gray-400 mb-4">
      Початок: {{ new Date(program.start_date).toLocaleDateString('uk') }}
    </p>

    <!-- EDIT MODE -->
    <template v-if="editing">
      <div class="space-y-4 mb-6">
        <div
          v-for="(day, di) in program.days"
          :key="di"
          class="bg-white rounded-lg border p-3"
        >
          <div class="flex items-center gap-2 mb-3">
            <input
              v-model="day.name"
              placeholder="Назва дня (напр. Спина-біцепс)"
              @blur="loadDayHistory(di)"
              class="flex-1 font-medium px-2 py-1 border rounded focus:outline-none focus:border-blue-400"
            />
            <button
              @click="removeDay(di)"
              class="text-red-400 hover:text-red-600 text-sm"
            >
              ✕
            </button>
          </div>

          <!-- Day history notes from past trainings -->
          <div
            v-if="dayHistory[di]?.length"
            class="mb-3 bg-blue-50 border border-blue-200 rounded p-2"
          >
            <p class="text-xs font-medium text-blue-700 mb-1">
              📋 Коментарі до дня з попередніх тренувань:
            </p>
            <div
              v-for="(h, hi) in dayHistory[di]"
              :key="hi"
              class="text-xs text-gray-600 mb-1 last:mb-0"
            >
              <span class="text-blue-600 font-medium">{{
                formatHistoryDate(h.completed_at)
              }}</span>
              <span class="text-gray-400 ml-1">({{ h.program_name }})</span>:
              <span class="italic">{{ h.day_note }}</span>
            </div>
          </div>
          <div v-else-if="dayHistoryLoading[di]" class="mb-3">
            <span class="text-xs text-gray-400"
              >Завантаження історії дня...</span
            >
          </div>

          <div class="space-y-3 ml-2">
            <div
              v-for="(ex, ei) in day.exercises"
              :key="ei"
              class="border-l-2 border-gray-200 pl-3"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm text-gray-400">{{ ei + 1 }}.</span>
                <input
                  v-model="ex.name"
                  placeholder="Вправа"
                  @blur="loadExerciseHistory(di, ei)"
                  class="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:border-blue-400"
                />
                <button
                  @click="removeExercise(di, ei)"
                  class="text-red-400 hover:text-red-600 text-xs"
                >
                  ✕
                </button>
              </div>

              <div class="ml-5 space-y-1">
                <div
                  v-for="(set, si) in ex.sets"
                  :key="si"
                  class="flex items-center gap-1 text-sm"
                >
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
                  <button
                    @click="removeSet(di, ei, si)"
                    class="text-red-300 hover:text-red-500 ml-1"
                  >
                    ✕
                  </button>
                </div>
                <button
                  @click="addSet(di, ei)"
                  class="text-xs text-blue-500 hover:text-blue-700"
                >
                  + підхід
                </button>
              </div>

              <!-- History notes from past trainings -->
              <div
                v-if="exerciseHistory[historyKey(di, ei)]?.length"
                class="ml-5 mt-2 bg-amber-50 border border-amber-200 rounded p-2"
              >
                <p class="text-xs font-medium text-amber-700 mb-1">
                  📝 Коментарі з попередніх тренувань:
                </p>
                <div
                  v-for="(h, hi) in exerciseHistory[historyKey(di, ei)]"
                  :key="hi"
                  class="text-xs text-gray-600 mb-1 last:mb-0"
                >
                  <span class="text-amber-600 font-medium">{{
                    formatHistoryDate(h.completed_at)
                  }}</span>
                  <span class="text-gray-400 ml-1">({{ h.program_name }})</span
                  >:
                  <span class="italic">{{ h.exercise_note }}</span>
                </div>
              </div>
              <div
                v-else-if="historyLoading[historyKey(di, ei)]"
                class="ml-5 mt-1"
              >
                <span class="text-xs text-gray-400"
                  >Завантаження історії...</span
                >
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
          @click="saveEdit"
          :disabled="saving"
          class="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {{ saving ? 'Зберігається...' : 'Зберегти' }}
        </button>
        <button
          @click="cancelEdit"
          class="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
        >
          Скасувати
        </button>
      </div>
    </template>

    <!-- VIEW MODE -->
    <template v-else>
      <div class="space-y-2">
        <div
          v-for="day in program.days"
          :key="day.id"
          class="bg-white rounded-lg border overflow-hidden"
        >
          <div
            class="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            @click="toggleDay(day.id)"
          >
            <div class="flex items-center gap-2">
              <span
                class="text-gray-400 text-xs transition-transform"
                :class="{ 'rotate-90': expandedDays[day.id] }"
                >▶</span
              >
              <div>
                <p class="font-medium">{{ day.name }}</p>
                <p class="text-xs text-gray-400">
                  {{ dayProgress(day).doneSets }} /
                  {{ dayProgress(day).totalSets }} підходів
                  <span v-if="day.completed_at" class="text-green-500 ml-1"
                    >✓</span
                  >
                </p>
                <p
                  v-if="day.day_note"
                  class="text-xs text-gray-500 mt-1 italic"
                >
                  {{ day.day_note }}
                </p>
              </div>
            </div>
            <button
              @click.stop="startSession(day.id)"
              class="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            >
              {{ day.completed_at ? 'Переглянути' : 'Старт' }}
            </button>
          </div>

          <!-- Expanded exercise preview -->
          <div
            v-if="expandedDays[day.id]"
            class="border-t px-3 pb-3 pt-2 bg-gray-50"
          >
            <div
              v-if="day.exercises.length === 0"
              class="text-xs text-gray-400 py-1"
            >
              Немає вправ
            </div>
            <div v-else class="space-y-2">
              <div v-for="(ex, ei) in day.exercises" :key="ei" class="text-sm">
                <div class="flex items-baseline gap-2">
                  <span class="text-gray-400 text-xs">{{ ei + 1 }}.</span>
                  <span class="font-medium text-gray-700">{{ ex.name }}</span>
                </div>
                <div v-if="ex.sets.length" class="ml-5 mt-0.5">
                  <div
                    v-for="(set, si) in ex.sets"
                    :key="si"
                    class="text-xs text-gray-500"
                  >
                    <span v-if="set.weight">{{ set.weight }} кг</span>
                    <span v-else class="italic">без ваги</span>
                    <span class="mx-1">—</span>
                    <span v-if="set.count > 1">{{ set.count }} × </span
                    >{{ set.reps }} повт
                    <span v-if="set.done" class="text-green-500 ml-1">✓</span>
                  </div>
                </div>
                <div
                  v-if="ex.exercise_note"
                  class="ml-5 mt-0.5 text-xs text-gray-500 italic"
                >
                  📝 {{ ex.exercise_note }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="program.days.length === 0"
        class="text-center text-gray-400 py-8"
      >
        Програма порожня. Натисніть "Редагувати" щоб додати дні.
      </div>

      <div class="mt-4">
        <button
          @click="enterEdit"
          class="w-full px-4 py-2.5 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50"
        >
          Редагувати програму
        </button>
      </div>
    </template>
  </div>
</template>
