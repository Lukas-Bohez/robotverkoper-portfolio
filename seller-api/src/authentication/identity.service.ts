import { Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { DomainException } from '../common/domain-exception.js'
import { FirebaseService } from './firebase.service.js'

export interface Identity {
  uid: string
  email: string
}

const DEV_TOKEN = /^dev:([^\s@]+@[^\s@]+\.[^\s@]+)$/

/**
 * Turns the bearer token of a request into an e-mail address: a Firebase ID token, or in AUTH_MODE=dev (a local
 * demo without internet, never in production) a token that looks like `dev:name@example.com`.
 */
@Injectable()
export class IdentityService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly firebase: FirebaseService,
  ) {}

  async verify(token: string): Promise<Identity> {
    if (this.config.authMode === 'dev') {
      const match = DEV_TOKEN.exec(token)
      if (!match?.[1]) {
        throw new DomainException(
          401,
          'invalid_token',
          'A dev token looks like dev:name@example.com',
        )
      }
      const email = match[1].toLowerCase()
      return { uid: `dev-${email}`, email }
    }
    let identity
    try {
      identity = await this.firebase.verifyIdToken(token)
    } catch {
      throw new UnauthorizedException('The login is not valid or has expired')
    }
    const email = identity.email?.toLowerCase() ?? ''
    if (!identity.uid || !email) {
      throw new DomainException(401, 'invalid_token', 'The login has no e-mail address')
    }
    if (this.config.requireVerifiedEmail && identity.emailVerified !== true) {
      throw new ForbiddenException('Verify your e-mail address first')
    }
    return { uid: identity.uid, email }
  }
}
