<script setup lang="ts">
import { computed } from 'vue';
import { getBaseUrl } from '@/api';
import { buildMcpGuides } from '@/lib/mcpClients';

/**
 * Renders a client picker (Kiro / Cursor / Codex / Claude) and the setup
 * instructions for the selected client, with the given token already injected
 * into each code snippet. Stateless: the parent owns which client is active,
 * which snippet was copied, and handles pick/copy events.
 */
const props = defineProps<{
  /** Context key — distinguishes multiple instances (e.g. 'new' vs a token id). */
  ctx: string;
  /** Token value to embed in snippets (raw token or a placeholder). */
  token: string;
  /** Currently selected client id. */
  active: string;
  /** Key of the snippet last copied, for the "Copied" label. */
  copiedKey: string | null;
}>();

const emit = defineEmits<{
  (e: 'pick', clientId: string): void;
  (e: 'copy', key: string, code: string): void;
}>();

const mcpUrl = computed(() => getBaseUrl().replace(/\/api$/, '') + '/mcp');

const guides = computed(() =>
  buildMcpGuides({ url: mcpUrl.value, token: props.token }),
);

const activeGuide = computed(
  () => guides.value.find((g) => g.id === props.active) ?? guides.value[0],
);

function snippetKey(stepIndex: number): string {
  return `${props.ctx}:${props.active}:${stepIndex}`;
}
</script>

<template>
  <div>
    <!-- Client tabs -->
    <div class="flex flex-wrap gap-1.5 mb-3">
      <button
        v-for="g in guides"
        :key="g.id"
        type="button"
        @click="emit('pick', g.id)"
        class="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
        :class="
          g.id === active
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        "
      >
        {{ g.name }}
      </button>
    </div>

    <!-- Selected client instructions -->
    <div v-if="activeGuide">
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {{ activeGuide.summary }}
      </p>

      <div
        v-for="(step, i) in activeGuide.steps"
        :key="i"
        class="mb-3 last:mb-0"
      >
        <p
          v-if="step.text"
          class="text-xs text-gray-700 dark:text-gray-300 mb-1"
        >
          {{ step.text }}
        </p>
        <div v-if="step.code" class="relative">
          <div
            v-if="step.file"
            class="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5"
          >
            {{ step.file }}
          </div>
          <pre
            class="p-2 pr-16 rounded bg-white dark:bg-gray-900 text-[11px] leading-snug text-gray-800 dark:text-gray-200 overflow-x-auto"
          ><code>{{ step.code }}</code></pre>
          <button
            type="button"
            @click="emit('copy', snippetKey(i), step.code)"
            class="absolute top-1 right-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {{ copiedKey === snippetKey(i) ? '✓' : 'Копіювати' }}
          </button>
        </div>
      </div>

      <!-- Notes -->
      <ul
        v-if="activeGuide.notes && activeGuide.notes.length"
        class="mt-2 space-y-1"
      >
        <li
          v-for="(note, ni) in activeGuide.notes"
          :key="ni"
          class="text-[11px] text-gray-500 dark:text-gray-400 flex gap-1.5"
        >
          <span class="text-gray-400 dark:text-gray-500">•</span>
          <span>{{ note }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
