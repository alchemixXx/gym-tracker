<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { authApi, type UnclaimedUser } from '@/api'

const router = useRouter()
const userStore = useUserStore()

type Mode = 'login' | 'register' | 'claim' | 'forgot'

const mode = ref<Mode>('login')
const error = ref('')
const success = ref('')
const loading = ref(false)

// Login fields
const loginEmail = ref('')
const loginPassword = ref('')

// Register fields
const regName = ref('')
const regEmail = ref('')
const regPassword = ref('')
const regPasswordConfirm = ref('')

// Claim fields
const unclaimedUsers = ref<UnclaimedUser[]>([])
const selectedUserId = ref<number | null>(null)
const claimEmail = ref('')
const claimPassword = ref('')
const claimPasswordConfirm = ref('')
const loadingUnclaimed = ref(false)

// Forgot password fields
const forgotEmail = ref('')

function clearMessages() {
  error.value = ''
  success.value = ''
}

function setMode(newMode: Mode) {
  clearMessages()
  mode.value = newMode
  if (newMode === 'claim' && unclaimedUsers.value.length === 0) {
    loadUnclaimedUsers()
  }
}

async function loadUnclaimedUsers() {
  loadingUnclaimed.value = true
  try {
    unclaimedUsers.value = await authApi.getUnclaimedUsers()
  } catch (err: any) {
    error.value = err.message || 'Не вдалося завантажити список користувачів'
  } finally {
    loadingUnclaimed.value = false
  }
}

async function handleLogin() {
  clearMessages()
  if (!loginEmail.value.trim() || !loginPassword.value) {
    error.value = 'Введіть email та пароль'
    return
  }
  loading.value = true
  try {
    await userStore.login(loginEmail.value.trim(), loginPassword.value)
    router.push('/')
  } catch (err: any) {
    error.value = err.message || 'Помилка входу'
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  clearMessages()
  if (!regName.value.trim() || !regEmail.value.trim() || !regPassword.value) {
    error.value = "Заповніть всі поля"
    return
  }
  if (regPassword.value.length < 6) {
    error.value = 'Пароль має бути не менше 6 символів'
    return
  }
  if (regPassword.value !== regPasswordConfirm.value) {
    error.value = 'Паролі не співпадають'
    return
  }
  loading.value = true
  try {
    await userStore.register(regName.value.trim(), regEmail.value.trim(), regPassword.value)
    router.push('/')
  } catch (err: any) {
    error.value = err.message || 'Помилка реєстрації'
  } finally {
    loading.value = false
  }
}

async function handleClaim() {
  clearMessages()
  if (!selectedUserId.value || !claimEmail.value.trim() || !claimPassword.value) {
    error.value = 'Оберіть профіль та заповніть email і пароль'
    return
  }
  if (claimPassword.value.length < 6) {
    error.value = 'Пароль має бути не менше 6 символів'
    return
  }
  if (claimPassword.value !== claimPasswordConfirm.value) {
    error.value = 'Паролі не співпадають'
    return
  }
  loading.value = true
  try {
    await userStore.claim(selectedUserId.value, claimEmail.value.trim(), claimPassword.value)
    router.push('/')
  } catch (err: any) {
    error.value = err.message || 'Помилка прив\'язки акаунту'
  } finally {
    loading.value = false
  }
}

async function handleForgotPassword() {
  clearMessages()
  if (!forgotEmail.value.trim()) {
    error.value = 'Введіть email'
    return
  }
  loading.value = true
  try {
    await userStore.forgotPassword(forgotEmail.value.trim())
    success.value = 'Якщо email існує, лист з посиланням для скидання надіслано'
  } catch (err: any) {
    error.value = err.message || 'Помилка'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <h1 class="text-2xl font-bold text-center mb-6">Тренування 💪</h1>

      <!-- Error / Success messages -->
      <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {{ error }}
      </div>
      <div v-if="success" class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
        {{ success }}
      </div>

      <!-- LOGIN -->
      <form v-if="mode === 'login'" @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm text-gray-600 mb-1">Email</label>
          <input
            v-model="loginEmail"
            type="email"
            autocomplete="email"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
            placeholder="your@email.com"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">Пароль</label>
          <input
            v-model="loginPassword"
            type="password"
            autocomplete="current-password"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Вхід...' : 'Увійти' }}
        </button>

        <div class="text-center space-y-2 pt-2">
          <button type="button" @click="setMode('forgot')" class="text-sm text-blue-600 hover:underline">
            Забули пароль?
          </button>
          <div class="text-sm text-gray-500">
            Немає акаунту?
            <button type="button" @click="setMode('register')" class="text-blue-600 hover:underline">
              Зареєструватися
            </button>
          </div>
          <div class="text-sm text-gray-500">
            Є існуючий профіль?
            <button type="button" @click="setMode('claim')" class="text-blue-600 hover:underline">
              Прив'язати
            </button>
          </div>
        </div>
      </form>

      <!-- REGISTER -->
      <form v-if="mode === 'register'" @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-sm text-gray-600 mb-1">Ім'я</label>
          <input
            v-model="regName"
            type="text"
            autocomplete="name"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
            placeholder="Ваше ім'я"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">Email</label>
          <input
            v-model="regEmail"
            type="email"
            autocomplete="email"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
            placeholder="your@email.com"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">Пароль</label>
          <input
            v-model="regPassword"
            type="password"
            autocomplete="new-password"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
            placeholder="Мінімум 6 символів"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">Підтвердити пароль</label>
          <input
            v-model="regPasswordConfirm"
            type="password"
            autocomplete="new-password"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Реєстрація...' : 'Зареєструватися' }}
        </button>

        <div class="text-center pt-2">
          <button type="button" @click="setMode('login')" class="text-sm text-blue-600 hover:underline">
            ← Назад до входу
          </button>
        </div>
      </form>

      <!-- CLAIM -->
      <div v-if="mode === 'claim'" class="space-y-4">
        <p class="text-sm text-gray-600 text-center">
          Оберіть ваш існуючий профіль та встановіть email і пароль:
        </p>

        <div v-if="loadingUnclaimed" class="text-center text-gray-400">Завантаження...</div>

        <div v-else-if="unclaimedUsers.length === 0" class="text-center text-gray-500 text-sm">
          Всі профілі вже прив'язані. Створіть новий акаунт.
        </div>

        <template v-else>
          <div class="space-y-2 max-h-40 overflow-y-auto">
            <button
              v-for="user in unclaimedUsers"
              :key="user.id"
              @click="selectedUserId = user.id"
              :class="[
                'w-full p-3 rounded-lg border text-left transition',
                selectedUserId === user.id
                  ? 'border-blue-400 bg-blue-50'
                  : 'hover:border-gray-300 bg-white'
              ]"
            >
              {{ user.name }}
            </button>
          </div>

          <form v-if="selectedUserId" @submit.prevent="handleClaim" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">Email</label>
              <input
                v-model="claimEmail"
                type="email"
                autocomplete="email"
                class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">Пароль</label>
              <input
                v-model="claimPassword"
                type="password"
                autocomplete="new-password"
                class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
                placeholder="Мінімум 6 символів"
              />
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">Підтвердити пароль</label>
              <input
                v-model="claimPasswordConfirm"
                type="password"
                autocomplete="new-password"
                class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
              />
            </div>
            <button
              type="submit"
              :disabled="loading"
              class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {{ loading ? 'Прив\'язка...' : 'Прив\'язати акаунт' }}
            </button>
          </form>
        </template>

        <div class="text-center pt-2">
          <button type="button" @click="setMode('login')" class="text-sm text-blue-600 hover:underline">
            ← Назад до входу
          </button>
        </div>
      </div>

      <!-- FORGOT PASSWORD -->
      <form v-if="mode === 'forgot'" @submit.prevent="handleForgotPassword" class="space-y-4">
        <p class="text-sm text-gray-600 text-center">
          Введіть email, і ми надішлемо посилання для скидання пароля.
        </p>
        <div>
          <label class="block text-sm text-gray-600 mb-1">Email</label>
          <input
            v-model="forgotEmail"
            type="email"
            autocomplete="email"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
            placeholder="your@email.com"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Відправка...' : 'Надіслати' }}
        </button>

        <div class="text-center pt-2">
          <button type="button" @click="setMode('login')" class="text-sm text-blue-600 hover:underline">
            ← Назад до входу
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
