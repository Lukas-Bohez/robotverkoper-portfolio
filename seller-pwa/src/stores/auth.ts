import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { FirebaseError } from 'firebase/app'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

/**
 * Local demo logins: no Firebase, no internet. Only in the Vite dev server (never in a build) and
 * only when `npm run dev` of Lukas/ switched it on because the Firebase values are missing.
 * The seller API only accepts the matching `dev:<email>` tokens when it runs in AUTH_MODE=dev.
 */
export const devLoginEnabled = import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'dev'
const DEV_KEY = 'seller-pwa.dev-user'

export interface SessionUser {
  uid: string
  email: string | null
}

function savedDevUser(): SessionUser | null {
  if (!devLoginEnabled) return null
  try {
    const email = sessionStorage.getItem(DEV_KEY)
    return email ? { uid: `dev-${email}`, email } : null
  } catch {
    return null
  }
}

/** Firebase, or a translatable error when seller-pwa/.env lacks its values */
function requireAuth(): Auth {
  if (!auth) throw new FirebaseError('auth/not-configured', 'Firebase is not configured')
  return auth
}

/** The translation key of a login error */
export function loginErrorKey(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'login.errors.invalid'
    case 'auth/too-many-requests':
      return 'login.errors.tooMany'
    case 'auth/network-request-failed':
      return 'login.errors.network'
    case 'auth/not-configured':
      return 'login.errors.notConfigured'
    default:
      return 'login.errors.unknown'
  }
}

/** The logged-in user (Pinia). Email and password only: no Google login. */
export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<SessionUser | null>(savedDevUser())
  const authReady = shallowRef(false)

  let resolveAuthReady!: () => void
  const authReadyPromise = new Promise<void>((resolve) => {
    resolveAuthReady = resolve
  })

  if (auth && !devLoginEnabled) {
    onAuthStateChanged(auth, (currentUser) => {
      user.value = currentUser ? { uid: currentUser.uid, email: currentUser.email } : null
      if (!authReady.value) {
        authReady.value = true
        resolveAuthReady()
      }
    })
  } else {
    // No Firebase (or a local demo login), so no session to restore
    authReady.value = true
    resolveAuthReady()
  }

  const email = computed(() => user.value?.email ?? '')

  function waitForAuthReady() {
    return authReadyPromise
  }

  async function login(emailAddress: string, password: string) {
    if (devLoginEnabled) {
      const address = emailAddress.trim().toLowerCase()
      user.value = { uid: `dev-${address}`, email: address }
      try {
        sessionStorage.setItem(DEV_KEY, address)
      } catch {
        // The login then lasts until the page reloads
      }
      return
    }
    await signInWithEmailAndPassword(requireAuth(), emailAddress, password)
  }

  async function logout() {
    if (devLoginEnabled) {
      user.value = null
      try {
        sessionStorage.removeItem(DEV_KEY)
      } catch {
        // Nothing was kept
      }
      return
    }
    await signOut(requireAuth())
  }

  async function getIdToken() {
    // Right after a page load Firebase is still restoring the session
    await authReadyPromise
    if (devLoginEnabled) return user.value?.email ? `dev:${user.value.email}` : null
    return (await auth?.currentUser?.getIdToken()) ?? null
  }

  return { user, email, authReady, waitForAuthReady, login, logout, getIdToken }
})
