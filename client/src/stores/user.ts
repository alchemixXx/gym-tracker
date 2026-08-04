import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useAuthStore } from './auth';

interface User {
  id: number;
  name: string;
  email?: string;
  created_at: string;
}

/**
 * Legacy compatibility store.
 * All views use `userStore.currentUser!.id` — this store now derives
 * the current user from the auth store so existing views continue to work
 * without modifications.
 */
export const useUserStore = defineStore('user', () => {
  const authStore = useAuthStore();

  const currentUser = computed<User | null>(() => authStore.user);

  function logout() {
    authStore.logout();
  }

  return { currentUser, logout };
});
