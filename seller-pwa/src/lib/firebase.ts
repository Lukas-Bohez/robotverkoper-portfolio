import { initializeApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_authDomain,
  projectId: import.meta.env.VITE_FIREBASE_projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_appId,
}

const configured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0,
)
if (!configured) {
  console.warn('Firebase is not configured: fill in VITE_FIREBASE_* in apps/seller-pwa/.env')
}

/**
 * Null without the Firebase values in .env: getAuth() would throw on the missing key and
 * leave a blank page. The app still renders then, only logging in fails (auth/not-configured).
 */
export const auth: Auth | null = configured ? getAuth(initializeApp(firebaseConfig)) : null
