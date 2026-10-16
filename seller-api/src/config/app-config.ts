export type AuthMode = 'firebase' | 'dev'

export interface AppConfig {
  /** 127.0.0.1: only this computer. 0.0.0.0 lets a phone on the network or another container reach the API. */
  host: string
  port: number
  mongodbUri: string
  authMode: AuthMode
  firebaseProjectId: string | null
  requireVerifiedEmail: boolean
  sellerAdminEmails: string[]
  platformUrl: string
  platformToken: string
  /** Where a robot connects (sent to the simulator together with the key) */
  robotApiUrl: string
  corsOrigins: string[]
  seedDemo: boolean
  production: boolean
}

/** Injection token of the settings (the environment, checked once at start) */
export const APP_CONFIG = Symbol('APP_CONFIG')

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

/** Reads the settings from the environment and refuses combinations that would be unsafe */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const production = env.NODE_ENV === 'production'
  const authMode = (env.AUTH_MODE ?? 'firebase') as AuthMode
  if (authMode !== 'firebase' && authMode !== 'dev') {
    throw new Error(`AUTH_MODE is "firebase" or "dev", not "${env.AUTH_MODE}"`)
  }
  if (authMode === 'dev' && production) {
    throw new Error('AUTH_MODE=dev accepts anyone: it never runs in production')
  }
  const firebaseProjectId = env.FIREBASE_PROJECT_ID?.trim() || null
  if (authMode === 'firebase' && !firebaseProjectId) {
    throw new Error(
      'AUTH_MODE=firebase needs FIREBASE_PROJECT_ID (the projectId of the Firebase web app)',
    )
  }
  const seedDemo = env.SEED_DEMO === 'true'
  if (seedDemo && production) {
    throw new Error('SEED_DEMO is for a demo, never for production')
  }

  const platformUrl = (env.PLATFORM_URL ?? 'http://127.0.0.1:4100').replace(
    /\/+$/,
    '',
  )

  return {
    host: env.BIND_HOST?.trim() || '127.0.0.1',
    port: Number(env.PORT ?? 4200),
    mongodbUri: env.MONGODB_URI?.trim() || 'mongodb://127.0.0.1:27028/seller',
    authMode,
    firebaseProjectId,
    requireVerifiedEmail: env.REQUIRE_VERIFIED_EMAIL
      ? env.REQUIRE_VERIFIED_EMAIL === 'true'
      : production,
    sellerAdminEmails: list(env.SELLER_ADMIN_EMAILS).map(email =>
      email.toLowerCase(),
    ),
    platformUrl,
    platformToken: env.PLATFORM_TOKEN ?? 'dev-platform-token',
    robotApiUrl: env.ROBOT_API_URL?.trim() || `${platformUrl}/graphql`,
    corsOrigins: list(
      env.CORS_ORIGINS ?? 'http://localhost:5174,http://127.0.0.1:5174',
    ),
    seedDemo,
    production,
  }
}
