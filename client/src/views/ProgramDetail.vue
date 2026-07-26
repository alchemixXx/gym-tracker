<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { api } from '@/api';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const program = ref<any>(null);
const editing = ref(false);
const saving = ref(false);

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
              class="flex-1 font-medium px-2 py-1 border rounded focus:outline-none focus:border-blue-400"
            />
            <button
              @click="removeDay(di)"
              class="text-red-400 hover:text-red-600 text-sm"
            >
              ✕
            </button>
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
          class="bg-white rounded-lg border p-3"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">{{ day.name }}</p>
              <p class="text-xs text-gray-400">
                {{ dayProgress(day).doneSets }} /
                {{ dayProgress(day).totalSets }} підходів
                <span v-if="day.completed_at" class="text-green-500 ml-1"
                  >✓</span
                >
              </p>
              <p v-if="day.day_note" class="text-xs text-gray-500 mt-1 italic">
                {{ day.day_note }}
              </p>
            </div>
            <button
              @click="startSession(day.id)"
              class="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            >
              {{ day.completed_at ? 'Переглянути' : 'Старт' }}
            </button>
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
