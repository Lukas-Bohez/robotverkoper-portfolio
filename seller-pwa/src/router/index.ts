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
      meta: { permission: 'companies:read' },
    },
    {
      path: '/companies/new',
      name: 'company-new',
      component: () => import('@/views/NewCompanyView.vue'),
      meta: { permission: 'companies:create' },
    },
    {
      path: '/companies/:id',
      name: 'company-robots',
      component: () => import('@/views/CompanyRobotsView.vue'),
      meta: { permission: 'robots:read' },
    },
    {
      path: '/companies/:id/roles',
      name: 'company-roles',
      component: () => import('@/views/CompanyRolesView.vue'),
      meta: { permission: 'company-roles:manage' },
    },
    {
      path: '/companies/:id/preview',
      name: 'role-preview',
      component: () => import('@/views/RolePreviewView.vue'),
      meta: { permission: 'company-roles:manage' },
    },
    {
      path: '/defects',
      name: 'defects',
      component: () => import('@/views/DefectsView.vue'),
      meta: { permission: 'defects:read' },
    },
    {
      path: '/team',
      name: 'team',
      component: () => import('@/views/TeamView.vue'),
      meta: { permission: 'accounts:manage' },
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
