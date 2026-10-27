<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { api, getBaseUrl } from '@/api';
import McpClientSetup from '@/components/McpClientSetup.vue';

const authStore = useAuthStore();
const router = useRouter();

// --- MCP tokens ---
interface McpToken {
  id: number;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
}

const tokens = ref<McpToken[]>([]);
const loadingTokens = ref(false);
const tokensError = ref<string | null>(null);

const newLabel = ref('');
const creating = ref(false);
// Raw token shown exactly once, right after creation
const justCreatedToken = ref<string | null>(null);
const copied = ref(false);

const userId = computed(() => authStore.user?.id ?? null);

// The /mcp endpoint lives at the server root (not under /api)
const mcpUrl = computed(() => getBaseUrl().replace(/\/api$/, '') + '/mcp');

// --- Client setup instructions (tab picker) ---

const PLACEHOLDER_TOKEN = 'gymmcp_ВАШ_ТОКЕН';

// Which client tab is selected, keyed by context: 'new' for the just-created
// token panel, or the token id (as string) for a saved token's instructions.
const selectedClient = ref<Record<string, string>>({ new: 'kiro' });

// Which saved token's instructions are expanded (null = none)
const expandedTokenId = ref<number | null>(null);

// Tracks which code snippet was last copied, for the "Copied" label
const copiedSnippet = ref<string | null>(null);

function pickClient(ctx: string, clientId: string) {
  selectedClient.value = { ...selectedClient.value, [ctx]: clientId };
}

function activeClient(ctx: string): string {
  return selectedClient.value[ctx] || 'kiro';
}

async function copySnippet(key: string, code: string) {
  try {
    await navigator.clipboard.writeText(code);
    copiedSnippet.value = key;
    setTimeout(() => {
      if (copiedSnippet.value === key) copiedSnippet.value = null;
    }, 2000);
  } catch {
    // Clipboard unavailable (insecure context) — user can select manually
  }
}

function toggleTokenInstructions(id: number) {
  expandedTokenId.value = expandedTokenId.value === id ? null : id;
  const ctx = String(id);
  if (!selectedClient.value[ctx]) pickClient(ctx, 'kiro');
}

async function loadTokens() {
  if (!userId.value) return;
  loadingTokens.value = true;
  tokensError.value = null;
  try {
    tokens.value = await api.getMcpTokens(userId.value);
  } catch (err: any) {
    tokensError.value = err.message || 'Не вдалося завантажити токени';
  } finally {
    loadingTokens.value = false;
  }
}

async function createToken() {
  if (!userId.value || creating.value) return;
  creating.value = true;
  tokensError.value = null;
  try {
    const result = await api.createMcpToken(
      userId.value,
      newLabel.value.trim() || undefined,
    );
    justCreatedToken.value = result.token;
    copied.value = false;
    newLabel.value = '';
    await loadTokens();
  } catch (err: any) {
    tokensError.value = err.message || 'Не вдалося створити токен';
  } finally {
    creating.value = false;
  }
}

async function revokeToken(id: number) {
  if (!userId.value) return;
  if (
    !confirm(
      'Відкликати цей токен? Клієнти, що його використовують, втратять доступ.',
    )
  ) {
    return;
  }
  try {
    await api.deleteMcpToken(userId.value, id);
    await loadTokens();
  } catch (err: any) {
    tokensError.value = err.message || 'Не вдалося відкликати токен';
  }
}

async function copyToken() {
  if (!justCreatedToken.value) return;
  try {
    await navigator.clipboard.writeText(justCreatedToken.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    // Clipboard may be unavailable (insecure context) — user can select manually
  }
}

function dismissNewToken() {
  justCreatedToken.value = null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uk-UA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

onMounted(loadTokens);
</script>

<template>
  <div class="py-4">
    <div class="flex items-center gap-3 mb-6">
      <button
        @click="router.back()"
        class="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <svg
          class="w-5 h-5 text-gray-600 dark:text-gray-300"
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
      <h1 class="text-xl font-bold dark:text-white">Налаштування</h1>
    </div>

    <div
      class="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 divide-y divide-gray-100 dark:divide-gray-700"
    >
      <!-- Name -->
      <div class="px-4 py-4 flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Ім'я</p>
          <p class="text-base font-medium text-gray-900 dark:text-white mt-0.5">
            {{ authStore.user?.name || '—' }}
          </p>
        </div>
        <div
          class="w-9 h-9 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center"
        >
          <svg
            class="w-5 h-5 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      </div>

      <!-- Email -->
      <div class="px-4 py-4 flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400">Email</p>
          <p class="text-base font-medium text-gray-900 dark:text-white mt-0.5">
            {{ authStore.user?.email || '—' }}
          </p>
        </div>
        <div
          class="w-9 h-9 rounded-full bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center"
        >
          <svg
            class="w-5 h-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
      </div>
    </div>

    <!-- MCP access tokens -->
    <div class="mt-6">
      <h2 class="text-lg font-semibold dark:text-white mb-1">MCP-доступ</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Токени дозволяють AI-асистентам (Kiro, Cursor, Codex, Claude)
        аналізувати прогрес і створювати програми від вашого імені. Після
        створення оберіть свій клієнт і скопіюйте готовий конфіг.
      </p>

      <div
        class="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 p-4"
      >
        <!-- Create form -->
        <form @submit.prevent="createToken" class="flex gap-2">
          <input
            v-model="newLabel"
            type="text"
            placeholder="Назва (напр. Claude на ноутбуці)"
            class="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            :disabled="creating"
            class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {{ creating ? 'Створення…' : 'Створити' }}
          </button>
        </form>

        <p v-if="tokensError" class="mt-2 text-sm text-red-500">
          {{ tokensError }}
        </p>

        <!-- Just-created token (shown once) + setup instructions -->
        <div
          v-if="justCreatedToken"
          class="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800"
        >
          <p
            class="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2"
          >
            Скопіюйте токен зараз — він показується лише один раз.
          </p>
          <div class="flex gap-2 items-center">
            <code
              class="flex-1 min-w-0 px-2 py-1.5 rounded bg-white dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 break-all font-mono"
            >
              {{ justCreatedToken }}
            </code>
            <button
              @click="copyToken"
              class="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 whitespace-nowrap"
            >
              {{ copied ? 'Скопійовано' : 'Копіювати' }}
            </button>
          </div>

          <!-- Setup instructions with client picker -->
          <div class="mt-4">
            <p
              class="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2"
            >
              Налаштування клієнта
            </p>
            <McpClientSetup
              ctx="new"
              :token="justCreatedToken"
              :active="activeClient('new')"
              :copied-key="copiedSnippet"
              @pick="(c: string) => pickClient('new', c)"
              @copy="(k: string, code: string) => copySnippet(k, code)"
            />
          </div>

          <button
            @click="dismissNewToken"
            class="mt-3 text-xs text-amber-700 dark:text-amber-400 underline"
          >
            Готово, я зберіг токен
          </button>
        </div>

        <!-- Token list -->
        <div class="mt-4">
          <p v-if="loadingTokens" class="text-sm text-gray-400">
            Завантаження…
          </p>
          <p
            v-else-if="tokens.length === 0"
            class="text-sm text-gray-400 dark:text-gray-500"
          >
            Токенів ще немає.
          </p>
          <ul v-else class="divide-y divide-gray-100 dark:divide-gray-700">
            <li
              v-for="t in tokens"
              :key="t.id"
              class="py-2.5"
              :class="{ 'opacity-50': t.revoked }"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p
                    class="text-sm font-medium text-gray-900 dark:text-white truncate"
                  >
                    {{ t.label || 'Без назви' }}
                    <span v-if="t.revoked" class="text-xs text-red-500"
                      >(відкликано)</span
                    >
                  </p>
                  <p class="text-xs text-gray-400 dark:text-gray-500">
                    Створено {{ formatDate(t.created_at) }} · востаннє
                    {{ formatDate(t.last_used_at) }}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    v-if="!t.revoked"
                    @click="toggleTokenInstructions(t.id)"
                    class="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 whitespace-nowrap"
                  >
                    {{ expandedTokenId === t.id ? 'Сховати' : 'Інструкція' }}
                  </button>
                  <button
                    v-if="!t.revoked"
                    @click="revokeToken(t.id)"
                    class="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 whitespace-nowrap"
                  >
                    Відкликати
                  </button>
                </div>
              </div>

              <!-- Per-token setup instructions (placeholder token) -->
              <div
                v-if="expandedTokenId === t.id && !t.revoked"
                class="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-100 dark:ring-gray-700"
              >
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                  Сам токен показується лише раз при створенні. Нижче — конфіг
                  із плейсхолдером; підставте збережений токен замість
                  <code class="font-mono">gymmcp_ВАШ_ТОКЕН</code>.
                </p>
                <McpClientSetup
                  :ctx="String(t.id)"
                  :token="PLACEHOLDER_TOKEN"
                  :active="activeClient(String(t.id))"
                  :copied-key="copiedSnippet"
                  @pick="(c: string) => pickClient(String(t.id), c)"
                  @copy="(k: string, code: string) => copySnippet(k, code)"
                />
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
