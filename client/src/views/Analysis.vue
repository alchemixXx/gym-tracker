<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useUserStore } from '@/stores/user';
import { db } from '@/db';
import {
  analyzeTraining,
  type AnalysisResult,
  type Insight,
  type InsightSeverity,
  type ExerciseProgressItem,
} from '@/services/analysis';

const CACHE_KEY = 'analysis_result';

const userStore = useUserStore();
const result = ref<AnalysisResult | null>(null);
const loading = ref(true);
const expandedInsight = ref<number | null>(null);
const showAllExercises = ref(false);

onMounted(async () => {
  // Show cached result instantly while recalculating
  await loadCachedResult();
  await runAnalysis();
});

async function loadCachedResult() {
  try {
    const cached = await db.syncMeta.get(CACHE_KEY);
    if (cached) {
      result.value = JSON.parse(cached.value);
      // Show cached data immediately, but still recalculate
      loading.value = false;
    }
  } catch {
    // Cache miss — no problem, will compute fresh
  }
}

async function runAnalysis() {
  // Only show full loading if no cached result
  if (!result.value) {
    loading.value = true;
  }
  try {
    const userId = userStore.currentUser!.id;

    // Read all data from IndexedDB (offline-first, works without network)
    const programs = await db.programs
      .where('user_id')
      .equals(userId)
      .toArray();
    const measurements = await db.measurements
      .where('user_id')
      .equals(userId)
      .toArray();

    result.value = analyzeTraining(programs, measurements);

    // Cache result for instant display next time
    await db.syncMeta.put({
      key: CACHE_KEY,
      value: JSON.stringify(result.value),
    });
  } catch (err) {
    console.error('Analysis failed:', err);
  } finally {
    loading.value = false;
  }
}

function toggleInsight(index: number) {
  expandedInsight.value = expandedInsight.value === index ? null : index;
}

const severityConfig: Record<
  InsightSeverity,
  { bg: string; border: string; icon: string; iconColor: string }
> = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-l-4 border-l-red-500',
    icon: '⚠️',
    iconColor: 'text-red-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-l-4 border-l-amber-500',
    icon: '⚡',
    iconColor: 'text-amber-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-l-4 border-l-blue-500',
    icon: '💡',
    iconColor: 'text-blue-500',
  },
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-l-4 border-l-emerald-500',
    icon: '✅',
    iconColor: 'text-emerald-500',
  },
};

function trendIcon(trend: 'up' | 'flat' | 'down'): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function trendColor(trend: 'up' | 'flat' | 'down'): string {
  if (trend === 'up') return 'text-emerald-600 dark:text-emerald-400';
  if (trend === 'down') return 'text-red-600 dark:text-red-400';
  return 'text-gray-500 dark:text-gray-400';
}

function trendBg(trend: 'up' | 'flat' | 'down'): string {
  if (trend === 'up') return 'bg-emerald-100 dark:bg-emerald-900/40';
  if (trend === 'down') return 'bg-red-100 dark:bg-red-900/40';
  return 'bg-gray-100 dark:bg-gray-800';
}

const visibleExercises = computed(() => {
  if (!result.value) return [];
  if (showAllExercises.value) return result.value.exerciseProgress;
  return result.value.exerciseProgress.slice(0, 6);
});

function sparklinePath(history: { date: string; weight: number }[]): string {
  if (history.length < 2) return '';
  const weights = history.map((h) => h.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const stepX = w / (weights.length - 1);
  const points = weights.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return `M${points.join(' L')}`;
}

function sparklineColor(trend: 'up' | 'flat' | 'down'): string {
  if (trend === 'up') return 'stroke-emerald-500';
  if (trend === 'down') return 'stroke-red-500';
  return 'stroke-gray-400';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('uk', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold dark:text-white">Аналіз</h2>
      <button
        @click="runAnalysis"
        :disabled="loading"
        class="btn-secondary btn-sm !rounded-xl gap-1"
      >
        <svg
          class="w-4 h-4"
          :class="{ 'animate-spin': loading }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Оновити
      </button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4">
      <div class="skeleton h-24 w-full"></div>
      <div class="skeleton h-16 w-full"></div>
      <div class="skeleton h-16 w-3/4"></div>
      <div class="skeleton h-40 w-full"></div>
    </div>

    <template v-else-if="result">
      <!-- Summary cards -->
      <div class="grid grid-cols-2 gap-3 mb-6">
        <div class="card p-3 text-center">
          <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {{ result.summary.totalSessions }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            тренувань
          </p>
        </div>
        <div class="card p-3 text-center">
          <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {{ result.summary.avgFrequency }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            раз/тиждень
          </p>
        </div>
        <div class="card p-3 text-center">
          <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {{ result.summary.avgCompletionRate }}%
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            виконання
          </p>
        </div>
        <div class="card p-3 text-center">
          <p class="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {{ result.summary.exercisesAnalyzed }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">вправ</p>
        </div>
      </div>

      <!-- Period info -->
      <div
        v-if="result.period.from"
        class="text-xs text-gray-400 dark:text-gray-500 mb-4 px-1"
      >
        Період: {{ formatDate(result.period.from) }} —
        {{ formatDate(result.period.to) }}
        ({{ result.summary.totalWeeks }} тижнів)
      </div>

      <!-- Insights -->
      <div v-if="result.insights.length > 0" class="mb-6">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-1"
        >
          Висновки та рекомендації
        </h3>
        <div class="space-y-2">
          <div
            v-for="(insight, i) in result.insights"
            :key="i"
            class="rounded-xl overflow-hidden"
            :class="[
              severityConfig[insight.severity].bg,
              severityConfig[insight.severity].border,
            ]"
          >
            <button
              @click="toggleInsight(i)"
              class="w-full text-left p-4 flex items-start gap-3"
            >
              <span class="text-lg flex-shrink-0 mt-0.5">{{
                severityConfig[insight.severity].icon
              }}</span>
              <div class="flex-1 min-w-0">
                <p class="font-semibold text-gray-900 dark:text-white text-sm">
                  {{ insight.title }}
                </p>
                <p
                  class="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2"
                >
                  {{ insight.description }}
                </p>
              </div>
              <svg
                class="w-4 h-4 text-gray-400 flex-shrink-0 mt-1 transition-transform duration-200"
                :class="{ 'rotate-180': expandedInsight === i }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <transition name="slide-down">
              <div v-if="expandedInsight === i" class="px-4 pb-4 pt-0 ml-9">
                <div
                  class="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed"
                >
                  {{ insight.advice }}
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <!-- Exercise Progress -->
      <div v-if="result.exerciseProgress.length > 0" class="mb-6">
        <h3
          class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-1"
        >
          Прогрес по вправах
        </h3>
        <div class="space-y-2">
          <div
            v-for="ep in visibleExercises"
            :key="ep.name"
            class="card p-3 flex items-center gap-3"
          >
            <!-- Trend indicator -->
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              :class="trendBg(ep.trend)"
            >
              <span :class="trendColor(ep.trend)">{{
                trendIcon(ep.trend)
              }}</span>
            </div>

            <!-- Exercise info -->
            <div class="flex-1 min-w-0">
              <p
                class="font-medium text-sm text-gray-900 dark:text-white truncate"
              >
                {{ ep.name }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                <span :class="trendColor(ep.trend)">
                  {{ ep.weightChangePercent > 0 ? '+' : ''
                  }}{{ ep.weightChangePercent }}%
                </span>
                вага
                <span class="mx-1">·</span>
                <span
                  :class="
                    ep.volumeChangePercent > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : ep.volumeChangePercent < 0
                        ? 'text-red-600 dark:text-red-400'
                        : ''
                  "
                >
                  {{ ep.volumeChangePercent > 0 ? '+' : ''
                  }}{{ ep.volumeChangePercent }}%
                </span>
                об'єм
              </p>
            </div>

            <!-- Sparkline -->
            <svg
              v-if="ep.weightHistory.length >= 2"
              class="w-[120px] h-8 flex-shrink-0"
              viewBox="0 0 120 32"
            >
              <path
                :d="sparklinePath(ep.weightHistory)"
                class="sparkline"
                :class="sparklineColor(ep.trend)"
              />
            </svg>
          </div>
        </div>

        <button
          v-if="result.exerciseProgress.length > 6"
          @click="showAllExercises = !showAllExercises"
          class="mt-3 w-full text-center text-sm text-blue-600 dark:text-blue-400 font-medium py-2"
        >
          {{
            showAllExercises
              ? 'Згорнути'
              : `Показати всі (${result.exerciseProgress.length})`
          }}
        </button>
      </div>

      <!-- Best/Worst highlight -->
      <div
        v-if="result.summary.bestProgress || result.summary.needsAttention"
        class="grid grid-cols-1 gap-3 mb-6"
      >
        <div
          v-if="result.summary.bestProgress"
          class="card p-4 border-l-4 border-l-emerald-500"
        >
          <p
            class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider"
          >
            Найкращий прогрес
          </p>
          <p class="font-medium text-gray-900 dark:text-white mt-1">
            {{ result.summary.bestProgress }}
          </p>
        </div>
        <div
          v-if="result.summary.needsAttention"
          class="card p-4 border-l-4 border-l-amber-500"
        >
          <p
            class="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider"
          >
            Потребує уваги
          </p>
          <p class="font-medium text-gray-900 dark:text-white mt-1">
            {{ result.summary.needsAttention }}
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
