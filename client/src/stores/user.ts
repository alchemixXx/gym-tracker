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
    // Try online first, fallback to local DB
    try {
      if (navigator.onLine) {
        users.value = await api.getUsers();
        // Cache in IndexedDB
        await db.users.clear();
        if (users.value.length) await db.users.bulkPut(users.value);
      } else {
        users.value = await db.users.toArray();
      }
    } catch {
      // Fallback to local
      users.value = await db.users.toArray();
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
