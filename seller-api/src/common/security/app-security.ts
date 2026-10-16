import type { INestApplication } from '@nestjs/common'
import helmet from 'helmet'

/** The seller PWA and the web version of the simulator run on localhost, on any port */
const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/**
 * CORS and the security headers (Helmet), in one place so main.ts and the e2e tests set up the app
 * the same way. `extraOrigins` are the websites of CORS_ORIGINS.
 */
export function applySecurity(app: INestApplication, extraOrigins: string[] = []): void {
  app.enableCors({
    origin: [LOCALHOST, ...extraOrigins],
    credentials: true,
    allowedHeaders: ['authorization', 'content-type'],
  })
  app.use(
    helmet({
      // GraphiQL (a dev tool) loads its scripts from a CDN: a strict CSP would break it.
      // The API itself only sends JSON, which a CSP does not protect anyway.
      contentSecurityPolicy: false,
    }),
  )
}
