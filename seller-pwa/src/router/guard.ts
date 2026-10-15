import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMeStore } from '@/stores/me'

declare module 'vue-router' {
  interface RouteMeta {
    /** Only for people who are not logged in (the login page) */
    guest?: boolean
    /** Only for the sellers of the robots (a platform admin) */
    seller?: boolean
  }
}

/** Only follow internal paths after a login, never another site */
export function safeRedirect(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null
}

/**
 * The route guard: log in first, then the role. Without the seller role you land
 * on the "no access" page, also when the API cannot tell who you are.
 */
export async function guard(to: RouteLocationNormalized): Promise<true | RouteLocationRaw> {
  const auth = useAuthStore()
  await auth.waitForAuthReady()

  if (to.meta.guest) {
    return auth.user ? { name: 'companies' } : true
  }

  if (!auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.seller) {
    const me = useMeStore()
    try {
      await me.load()
    } catch {
      return { name: 'forbidden', query: { error: '1' } }
    }
    if (!me.isSeller) return { name: 'forbidden' }
  }

  return true
}
