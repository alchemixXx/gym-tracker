<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const password = ref('')
const passwordConfirm = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)
const token = ref('')

onMounted(() => {
  token.value = (route.query.token as string) || ''
  if (!token.value) {
    error.value = 'Недійсне посилання для скидання пароля'
  }
})

async function handleReset() {
  error.value = ''
  success.value = ''

  if (!password.value) {
    error.value = 'Введіть новий пароль'
    return
  }
  if (password.value.length < 6) {
    error.value = 'Пароль має бути не менше 6 символів'
    return
  }
  if (password.value !== passwordConfirm.value) {
    error.value = 'Паролі не співпадають'
    return
  }

  loading.value = true
  try {
    await userStore.resetPassword(token.value, password.value)
    success.value = 'Пароль успішно змінено! Перенаправлення...'
    setTimeout(() => {
      router.push('/')
    }, 1500)
  } catch (err: any) {
    error.value = err.message || 'Не вдалося скинути пароль'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <h1 class="text-2xl font-bold text-center mb-6">Скидання пароля</h1>

      <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {{ error }}
      </div>
      <div v-if="success" class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
        {{ success }}
      </div>

      <form v-if="token && !success" @submit.prevent="handleReset" class="space-y-4">
        <div>
          <label class="block text-sm text-gray-600 mb-1">Новий пароль</label>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-400"
            placeholder="Мінімум 6 символів"
          />
        </div>
        <div>
          <label class="block text-sm text-gray-600 mb-1">Підтвердити пароль</label>
          <input
            v-model="passwordConfirm"
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
          {{ loading ? 'Збереження...' : 'Зберегти новий пароль' }}
        </button>
      </form>

      <div class="text-center pt-4">
        <router-link to="/login" class="text-sm text-blue-600 hover:underline">
          ← Назад до входу
        </router-link>
      </div>
    </div>
  </div>
</template>
