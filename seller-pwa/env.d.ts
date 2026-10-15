/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_FIREBASE_apiKey?: string
  readonly VITE_FIREBASE_authDomain?: string
  readonly VITE_FIREBASE_projectId?: string
  readonly VITE_FIREBASE_storageBucket?: string
  readonly VITE_FIREBASE_messagingSenderId?: string
  readonly VITE_FIREBASE_appId?: string
}
