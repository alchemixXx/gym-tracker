import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api';
import { db } from '@/db/index';

interface User {
  id: number;
  name: string;
  created_at: string;
}

export const useUserStore = defineStore('user', () => {
  const currentUser = ref<User | null>(null);
  const users = ref<User[]>([]);

  // Restore from localStorage
  const saved = localStorage.getItem('gym-tracker-user');
  if (saved) {
    try {
      currentUser.value = JSON.parse(saved);
    } catch {}
  }

  async function fetchUsers() {
    // Always load local data first (instant, never empty on returning visits)
    const localUsers = await db.users.toArray();
    if (localUsers.length) {
      users.value = localUsers;
    }

    // Then try to refresh from server if online
    if (navigator.onLine) {
      try {
        const serverUsers = await api.getUsers();
        if (serverUsers && serverUsers.length) {
          users.value = serverUsers;
          // Update IndexedDB cache (merge, don't clear-then-write)
          await db.users.bulkPut(serverUsers);
          // Remove locally cached users that no longer exist on server
          const serverIds = new Set(serverUsers.map((u: User) => u.id));
          const staleLocal = localUsers.filter((u) => !serverIds.has(u.id));
          if (staleLocal.length) {
            await db.users.bulkDelete(staleLocal.map((u) => u.id));
          }
        }
      } catch {
        // Server unavailable — local data already loaded above, nothing to do
      }
    }
  }

  async function createUser(name: string) {
    // Creating users requires online (needs server-generated ID)
    const user = await api.createUser(name);
    users.value.push(user);
    // Cache locally
    await db.users.put(user);
    return user;
  }

  function selectUser(user: User) {
    currentUser.value = user;
    localStorage.setItem('gym-tracker-user', JSON.stringify(user));
  }

  function logout() {
    currentUser.value = null;
    localStorage.removeItem('gym-tracker-user');
  }

  return { currentUser, users, fetchUsers, createUser, selectUser, logout };
});
