/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** The seller API, e.g. http://localhost:4200 */
  readonly VITE_API_URL?: string
  /** "dev": local demo logins (only in the dev server), else Firebase */
  readonly VITE_AUTH_MODE?: string
  readonly VITE_FIREBASE_apiKey?: string
  readonly VITE_FIREBASE_authDomain?: string
  readonly VITE_FIREBASE_projectId?: string
  readonly VITE_FIREBASE_storageBucket?: string
  readonly VITE_FIREBASE_messagingSenderId?: string
  readonly VITE_FIREBASE_appId?: string
}
