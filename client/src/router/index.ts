import { createRouter, createWebHistory } from 'vue-router';
import { useUserStore } from '@/stores/user';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { public: true },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/ResetPassword.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      redirect: '/programs',
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
  ],
});

router.beforeEach(async (to) => {
  const userStore = useUserStore();

  // Initialize auth state on first navigation
  await userStore.init();

  // Allow public routes without auth
  if (to.meta.public) {
    // Redirect to home if already authenticated
    if (
      userStore.isAuthenticated &&
      (to.name === 'login' || to.name === 'reset-password')
    ) {
      return '/';
    }
    return true;
  }

  // Protected routes — require authentication
  if (!userStore.isAuthenticated) {
    return '/login';
  }

  return true;
});

export default router;
