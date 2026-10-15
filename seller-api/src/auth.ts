import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { HttpError } from './http.ts'

export interface Identity {
  uid: string
  email: string
}

export interface TokenVerifier {
  verify(token: string): Promise<Identity>
}

const FIREBASE_KEYS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

/**
 * Checks a Firebase ID token the way Google documents it: RS256 signature against Google's public
 * keys, issuer and audience of our project, not expired. No service account is needed for that.
 */
export class FirebaseTokenVerifier implements TokenVerifier {
  private readonly projectId: string
  private readonly keys: JWTVerifyGetKey
  private readonly requireVerifiedEmail: boolean

  constructor(options: { projectId: string; requireVerifiedEmail: boolean; keys?: JWTVerifyGetKey }) {
    this.projectId = options.projectId
    this.requireVerifiedEmail = options.requireVerifiedEmail
    this.keys = options.keys ?? createRemoteJWKSet(new URL(FIREBASE_KEYS))
  }

  async verify(token: string): Promise<Identity> {
    let payload
    try {
      ;({ payload } = await jwtVerify(token, this.keys, {
        issuer: `https://securetoken.google.com/${this.projectId}`,
        audience: this.projectId,
        algorithms: ['RS256'],
      }))
    } catch {
      throw new HttpError(401, 'invalid_token', 'The login is not valid or has expired')
    }
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : ''
    if (!payload.sub || !email) throw new HttpError(401, 'invalid_token', 'The login has no email address')
    if (this.requireVerifiedEmail && payload.email_verified !== true) {
      throw new HttpError(403, 'email_not_verified', 'Verify your email address first')
    }
    return { uid: payload.sub, email }
  }
}

/** For a local demo without internet: the token is "dev:<email>". Never accepted in production. */
export class DevTokenVerifier implements TokenVerifier {
  verify(token: string): Promise<Identity> {
    const match = /^dev:([^\s@]+@[^\s@]+\.[^\s@]+)$/.exec(token)
    if (!match?.[1]) return Promise.reject(new HttpError(401, 'invalid_token', 'A dev token looks like dev:name@example.com'))
    const email = match[1].toLowerCase()
    return Promise.resolve({ uid: `dev-${email}`, email })
  }
}
