import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(),
  routes: [
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

export default router;
