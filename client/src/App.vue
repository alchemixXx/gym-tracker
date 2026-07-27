<script setup lang="ts">
import { useUserStore } from '@/stores/user';
import UserSelect from '@/views/UserSelect.vue';

const userStore = useUserStore();
</script>

<template>
  <div class="min-h-screen">
    <UserSelect v-if="!userStore.currentUser" />
    <template v-else>
      <header class="bg-white shadow-sm border-b sticky top-0 z-50">
        <div
          class="max-w-lg mx-auto px-4 py-3 flex items-center justify-between"
        >
          <h1 class="text-lg font-bold">Тренування</h1>
          <button
            @click="userStore.logout()"
            class="text-sm text-gray-500 hover:text-gray-700"
          >
            {{ userStore.currentUser.name }} ↗
          </button>
        </div>
      </header>
      <nav class="bg-white border-b">
        <div class="max-w-lg mx-auto px-4 flex gap-1 overflow-x-auto">
          <router-link
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="px-3 py-2 text-sm whitespace-nowrap border-b-2 border-transparent hover:border-blue-300"
            active-class="!border-blue-600 text-blue-600 font-medium"
          >
            {{ link.label }}
          </router-link>
        </div>
      </nav>
      <main class="max-w-lg mx-auto px-4 py-4">
        <router-view />
      </main>
    </template>
  </div>
</template>

<script lang="ts">
export default {
  computed: {
    navLinks() {
      return [
        { to: '/programs', label: 'Програми' },
        { to: '/templates', label: 'Шаблони' },
        { to: '/measurements', label: 'Заміри' },
        { to: '/food', label: 'Їжа' },
      ];
    },
  },
};
</script>
