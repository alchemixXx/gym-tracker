<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { api } from '@/api';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const template = ref<any>(null);
const saving = ref(false);

onMounted(async () => {
  await loadTemplate();
});

async function loadTemplate() {
  template.value = await api.getTemplate(
    userStore.currentUser!.id,
    Number(route.params.id),
  );
}

function addDay() {
  template.value.days.push({ name: '', exercises: [] });
}
function removeDay(index: number) {
  template.value.days.splice(index, 1);
}
function addExercise(dayIndex: number) {
  template.value.days[dayIndex].exercises.push({ name: '', sets: [] });
}
function removeExercise(dayIndex: number, exIndex: number) {
  template.value.days[dayIndex].exercises.splice(exIndex, 1);
}
function addSet(dayIndex: number, exIndex: number) {
  template.value.days[dayIndex].exercises[exIndex].sets.push({
    weight: null,
    reps: 10,
    count: 1,
  });
}
function removeSet(dayIndex: number, exIndex: number, setIndex: number) {
  template.value.days[dayIndex].exercises[exIndex].sets.splice(setIndex, 1);
}

async function save() {
  saving.value = true;
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
    });
    await loadTemplate();
  } finally {
    saving.value = false;
  }
}

async function createProgram() {
  const program = await api.createProgram(userStore.currentUser!.id, {
    name: `${template.value.name} — ${new Date().toLocaleDateString('uk')}`,
    template_id: template.value.id,
  });
  router.push(`/programs/${program.id}`);
}
</script>

<template>
  <div v-if="template">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button
        @click="router.push('/templates')"
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
      <input
        v-model="template.name"
        class="input text-xl font-bold flex-1"
        placeholder="Назва шаблону"
      />
    </div>

    <!-- Days -->
    <div class="space-y-4 mb-6">
      <div
        v-for="(day, di) in template.days"
        :key="di"
        class="card p-4 border-l-4 border-l-purple-400 dark:border-l-purple-600"
      >
        <div class="flex items-center gap-2 mb-3">
          <input
            v-model="day.name"
            placeholder="Назва дня (напр. Спина-біцепс)"
            class="input flex-1 font-medium"
          />
          <button
            @click="removeDay(di)"
            class="btn-danger btn-sm !min-h-[36px]"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="space-y-3 ml-2">
          <div
            v-for="(ex, ei) in day.exercises"
            :key="ei"
            class="border-l-2 border-gray-200 dark:border-gray-700 pl-3"
          >
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-sm text-gray-400 font-medium"
                >{{ ei + 1 }}.</span
              >
              <input
                v-model="ex.name"
                placeholder="Вправа"
                class="input input-sm flex-1"
              />
              <button
                @click="removeExercise(di, ei)"
                class="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1 transition-colors"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div class="ml-6 space-y-1.5">
              <div
                v-for="(set, si) in ex.sets"
                :key="si"
                class="flex items-center gap-1.5 text-sm"
              >
                <input
                  v-model.number="set.weight"
                  placeholder="кг"
                  type="number"
                  step="0.5"
                  class="w-16 px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-center text-sm focus:outline-none focus:border-purple-500"
                />
                <span class="text-gray-400 text-xs">кг</span>
                <input
                  v-model.number="set.count"
                  type="number"
                  min="1"
                  class="w-12 px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-center text-sm focus:outline-none focus:border-purple-500"
                />
                <span class="text-gray-400 text-xs">×</span>
                <input
                  v-model.number="set.reps"
                  type="number"
                  min="1"
                  class="w-12 px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg text-center text-sm focus:outline-none focus:border-purple-500"
                />
                <button
                  @click="removeSet(di, ei, si)"
                  class="text-red-300 hover:text-red-500 p-1"
                >
                  <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <button
                @click="addSet(di, ei)"
                class="text-xs text-purple-500 hover:text-purple-700 dark:text-purple-400 font-medium py-1"
              >
                + підхід
              </button>
            </div>
          </div>

          <button
            @click="addExercise(di)"
            class="text-sm text-purple-500 hover:text-purple-700 dark:text-purple-400 font-medium py-1"
          >
            + вправа
          </button>
        </div>
      </div>
    </div>

    <div class="flex gap-2 mb-6">
      <button @click="addDay" class="btn-secondary btn-sm gap-1">
        <svg
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 4v16m8-8H4"
          />
        </svg>
        День
      </button>
    </div>

    <div class="flex gap-2 sticky bottom-20 z-10">
      <button
        @click="save"
        :disabled="saving"
        class="btn-primary flex-1"
        style="background: linear-gradient(135deg, #a855f7, #9333ea)"
      >
        {{ saving ? 'Зберігається...' : 'Зберегти' }}
      </button>
      <button @click="createProgram" class="btn-success gap-1">
        <svg
          class="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M13 7l5 5m0 0l-5 5m5-5H6"
          />
        </svg>
        Програма
      </button>
    </div>
  </div>
</template>
