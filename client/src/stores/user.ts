import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, type AuthUser } from '@/api';

export const useUserStore = defineStore('user', () => {
  const currentUser = ref<AuthUser | null>(null);
  const loading = ref(false);
  const initialized = ref(false);

  const isAuthenticated = computed(() => !!currentUser.value);

  /**
   * Check auth state on app load by calling /auth/me.
   * If cookie is valid, user is restored. Otherwise, stays null.
   */
  async function init() {
    if (initialized.value) return;
    loading.value = true;
    try {
      const { user } = await authApi.me();
      currentUser.value = user;
    } catch {
      currentUser.value = null;
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  async function login(email: string, password: string) {
    const { user } = await authApi.login(email, password);
    currentUser.value = user;
  }

  async function register(name: string, email: string, password: string) {
    const { user } = await authApi.register(name, email, password);
    currentUser.value = user;
  }

  async function claim(userId: number, email: string, password: string) {
    const { user } = await authApi.claim(userId, email, password);
    currentUser.value = user;
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // Even if server call fails, clear local state
    }
    currentUser.value = null;
  }

  async function forgotPassword(email: string) {
    return authApi.forgotPassword(email);
  }

  async function resetPassword(token: string, password: string) {
    return authApi.resetPassword(token, password);
  }

  return {
    currentUser,
    loading,
    initialized,
    isAuthenticated,
    init,
    login,
    register,
    claim,
    logout,
    forgotPassword,
    resetPassword,
  };
});
