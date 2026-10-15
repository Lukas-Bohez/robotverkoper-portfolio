import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { FirebaseError } from 'firebase/app'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

/** Firebase, or a translatable error when apps/seller-pwa/.env lacks its values */
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

/** The logged-in Firebase user (Pinia). Email and password only: no Google login. */
export const useAuthStore = defineStore('auth', () => {
  const user = shallowRef<User | null>(null)
  const authReady = shallowRef(false)

  let resolveAuthReady!: () => void
  const authReadyPromise = new Promise<void>((resolve) => {
    resolveAuthReady = resolve
  })

  if (auth) {
    onAuthStateChanged(auth, (currentUser) => {
      user.value = currentUser
      if (!authReady.value) {
        authReady.value = true
        resolveAuthReady()
      }
    })
  } else {
    // No Firebase, so no session to restore
    authReady.value = true
    resolveAuthReady()
  }

  const email = computed(() => user.value?.email ?? '')

  function waitForAuthReady() {
    return authReadyPromise
  }

  async function login(emailAddress: string, password: string) {
    await signInWithEmailAndPassword(requireAuth(), emailAddress, password)
  }

  async function logout() {
    await signOut(requireAuth())
  }

  async function getIdToken() {
    // Right after a page load Firebase is still restoring the session
    await authReadyPromise
    return (await auth?.currentUser?.getIdToken()) ?? null
  }

  return { user, email, authReady, waitForAuthReady, login, logout, getIdToken }
})
