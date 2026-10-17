import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import type { Permission } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

declare module 'vue-router' {
  interface RouteMeta {
    /** Only for people who are not logged in (the login page) */
    guest?: boolean
    /** Only for the staff of the robot seller (any role) */
    seller?: boolean
    /** Only for a role that has this permission */
    permission?: Permission
  }
}

/** Only follow internal paths after a login, never another site */
export function safeRedirect(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null
}

/**
 * The route guard: log in first, then the role, then the permission of the page. Without a role you
 * land on the "no access" page, also when the API cannot tell who you are. Someone who is already logged in and opens
 * the login page goes to their own start page (a technician to the dashboard).
 */
export async function guard(to: RouteLocationNormalized): Promise<true | RouteLocationRaw> {
  const auth = useAuthStore()
  await auth.waitForAuthReady()

  if (to.meta.guest) {
    return auth.user ? { name: 'home' } : true
  }

  if (!auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.seller || to.meta.permission) {
    const me = useMeStore()
    try {
      await me.load()
    } catch {
      return { name: 'forbidden', query: { error: '1' } }
    }
    if (!me.isSeller) return { name: 'forbidden' }
    if (to.meta.permission && !me.can(to.meta.permission)) return { name: 'forbidden', query: { reason: 'role' } }
  }

  return true
}
