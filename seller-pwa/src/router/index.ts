import { createRouter, createWebHistory } from 'vue-router'
import { guard } from './guard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: { name: 'companies' } },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { guest: true },
    },
    {
      path: '/companies',
      name: 'companies',
      component: () => import('@/views/CompaniesView.vue'),
      meta: { seller: true },
    },
    {
      path: '/companies/:id',
      name: 'company-robots',
      component: () => import('@/views/CompanyRobotsView.vue'),
      meta: { seller: true },
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('@/views/ForbiddenView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'companies' } },
  ],
})

router.beforeEach(guard)

export default router
