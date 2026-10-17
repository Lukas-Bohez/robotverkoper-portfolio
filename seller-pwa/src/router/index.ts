import { createRouter, createWebHistory } from 'vue-router'
import { guard } from './guard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Where a person starts depends on the role: a technician lands on the dashboard, the rest on the companies
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { seller: true } },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },

    // ---- the administrator (a computer): companies, robots, roles, team ----
    { path: '/companies', name: 'companies', component: () => import('@/views/CompaniesView.vue'), meta: { permission: 'companies:read' } },
    { path: '/companies/new', name: 'company-new', component: () => import('@/views/NewCompanyView.vue'), meta: { permission: 'companies:create' } },
    { path: '/companies/:id', name: 'company-robots', component: () => import('@/views/CompanyRobotsView.vue'), meta: { permission: 'robots:read' } },
    { path: '/companies/:id/roles', name: 'company-roles', component: () => import('@/views/CompanyRolesView.vue'), meta: { permission: 'company-roles:manage' } },
    { path: '/companies/:id/preview', name: 'role-preview', component: () => import('@/views/RolePreviewView.vue'), meta: { permission: 'company-roles:manage' } },
    { path: '/robots/:id', name: 'robot', component: () => import('@/views/RobotView.vue'), meta: { permission: 'robots:read' } },
    { path: '/defects', name: 'defects', component: () => import('@/views/DefectsView.vue'), meta: { permission: 'defects:read' } },
    { path: '/defects/:id', name: 'defect', component: () => import('@/views/DefectView.vue'), meta: { permission: 'defects:read' } },
    { path: '/team', name: 'team', component: () => import('@/views/TeamView.vue'), meta: { permission: 'accounts:manage' } },
    { path: '/team/roles', name: 'team-roles', component: () => import('@/views/TeamRolesView.vue'), meta: { permission: 'roles:manage' } },
    { path: '/team/presets', name: 'presets', component: () => import('@/views/RolePresetsView.vue'), meta: { permission: 'company-roles:manage' } },
    { path: '/team/archive', name: 'archive', component: () => import('@/views/ArchiveView.vue'), meta: { permission: 'archive:read' } },

    // ---- the technician (a phone): dashboard, on site, replacing with QR codes ----
    { path: '/tasks', name: 'tasks', component: () => import('@/views/TasksView.vue'), meta: { permission: 'defects:claim' } },
    { path: '/defects/:id/on-site', name: 'on-site', component: () => import('@/views/OnSiteView.vue'), meta: { permission: 'defects:claim' } },
    { path: '/defects/:id/replace', name: 'replace', component: () => import('@/views/ReplaceRobotView.vue'), meta: { permission: 'robots:replace' } },
    { path: '/scan', name: 'scan', component: () => import('@/views/ScanView.vue'), meta: { permission: 'robots:read' } },

    { path: '/forbidden', name: 'forbidden', component: () => import('@/views/ForbiddenView.vue') },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

router.beforeEach(guard)

export default router
