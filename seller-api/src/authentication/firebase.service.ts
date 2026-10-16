import { Inject, Injectable } from '@nestjs/common'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'

/** Who Firebase says the caller is */
export interface FirebaseIdentity {
  uid: string
  email?: string
  emailVerified?: boolean
}

@Injectable()
export class FirebaseService {
  private readonly auth: Auth | null

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    if (!config.firebaseProjectId) {
      // AUTH_MODE=dev: there is no Firebase, only the local demo logins
      this.auth = null
      return
    }
    // Verifying ID tokens only needs the project id, no service account
    const app =
      getApps().find((existing) => existing.name === 'seller-api') ??
      initializeApp({ projectId: config.firebaseProjectId }, 'seller-api')
    this.auth = getAuth(app)
  }

  async verifyIdToken(token: string): Promise<FirebaseIdentity> {
    if (!this.auth) throw new Error('Firebase is not configured')
    const decoded = await this.auth.verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified }
  }
}
