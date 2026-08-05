import { createRouter, createWebHistory } from 'vue-router';
import { onSessionExpired, isAuthenticated } from '@/api';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/programs',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { public: true },
    },
    {
      path: '/auth/verify',
      name: 'auth-verify',
      component: () => import('@/views/AuthVerify.vue'),
      meta: { public: true },
    },
    {
      path: '/auth/claim',
      name: 'auth-claim',
      component: () => import('@/views/ClaimAccount.vue'),
      meta: { public: true },
    },
    {
      path: '/programs',
      name: 'programs',
      component: () => import('@/views/Programs.vue'),
    },
    {
      path: '/programs/:id',
      name: 'program-detail',
      component: () => import('@/views/ProgramDetail.vue'),
    },
    {
      path: '/programs/:id/session/:dayId',
      name: 'gym-session',
      component: () => import('@/views/GymSession.vue'),
    },
    {
      path: '/templates',
      name: 'templates',
      component: () => import('@/views/Templates.vue'),
    },
    {
      path: '/templates/:id',
      name: 'template-detail',
      component: () => import('@/views/TemplateDetail.vue'),
    },
    {
      path: '/measurements',
      name: 'measurements',
      component: () => import('@/views/Measurements.vue'),
    },
    {
      path: '/food',
      name: 'food',
      component: () => import('@/views/Food.vue'),
    },
    {
      path: '/food/:id',
      name: 'food-detail',
      component: () => import('@/views/FoodDetail.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/Settings.vue'),
    },
  ],
});

// --- Navigation guard: redirect to login if not authenticated ---
router.beforeEach((to) => {
  if (to.meta.public) return true;
  if (!isAuthenticated()) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

// --- Global session-expired handler: force logout + redirect ---
onSessionExpired(() => {
  // Dynamically import to avoid circular dependency with pinia (store needs app context)
  import('@/stores/auth').then(({ useAuthStore }) => {
    const authStore = useAuthStore();
    authStore.logout();
    router.replace({ name: 'login' });
  });
});

export default router;
