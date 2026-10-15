import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { Permission, SellerRole } from '@/api/types'
import { useMeStore } from '@/stores/me'

export const ALL_PERMISSIONS: Permission[] = [
  'companies:read',
  'companies:create',
  'company-roles:manage',
  'robots:read',
  'robots:create',
  'defects:read',
  'defects:manage',
  'accounts:manage',
  'audit:read',
]

export const TECHNICIAN_PERMISSIONS: Permission[] = [
  'companies:read',
  'robots:read',
  'robots:create',
  'defects:read',
  'defects:manage',
]

/** A fresh Pinia where the logged-in person already has this role (no network) */
export function piniaWith(role: SellerRole | null = 'admin', permissions: Permission[] = ALL_PERMISSIONS) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useMeStore().me = { email: 'docent@howest.be', role, permissions }
  return pinia
}

/** The routes of the app with empty pages: enough for links and `useRoute()` */
export async function routerAt(path: string) {
  const blank = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: blank },
      { path: '/login', name: 'login', component: blank },
      { path: '/companies', name: 'companies', component: blank },
      { path: '/companies/new', name: 'company-new', component: blank },
      { path: '/companies/:id', name: 'company-robots', component: blank },
      { path: '/companies/:id/roles', name: 'company-roles', component: blank },
      { path: '/companies/:id/preview', name: 'role-preview', component: blank },
      { path: '/defects', name: 'defects', component: blank },
      { path: '/team', name: 'team', component: blank },
      { path: '/forbidden', name: 'forbidden', component: blank },
    ],
  })
  await router.push(path)
  await router.isReady()
  return router
}
