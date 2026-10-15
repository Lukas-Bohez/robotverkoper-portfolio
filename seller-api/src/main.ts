import { existsSync } from 'node:fs'
import { DevTokenVerifier, FirebaseTokenVerifier, type TokenVerifier } from './auth.ts'
import { createSellerApi } from './app.ts'
import { loadConfig } from './config.ts'
import { openDatabase } from './db.ts'
import { HttpPlatformGateway } from './platform.ts'
import { seedDemo, seedModels } from './seed.ts'
import { SellerService } from './service.ts'
import { SellerStore } from './store.ts'

// A .env next to package.json is optional: the environment wins
if (existsSync('.env')) process.loadEnvFile('.env')

const config = loadConfig()
const store = new SellerStore(openDatabase(config.dbPath))
seedModels(store)

const gateway = new HttpPlatformGateway({ baseUrl: config.platformUrl, token: config.platformToken })
const service = new SellerService(store, gateway, {
  sellerAdminEmails: config.sellerAdminEmails,
  robotApiUrl: config.robotApiUrl,
})

const verifier: TokenVerifier =
  config.authMode === 'dev'
    ? new DevTokenVerifier()
    : new FirebaseTokenVerifier({
        projectId: config.firebaseProjectId!,
        requireVerifiedEmail: config.requireVerifiedEmail,
      })

const server = createSellerApi({ service, verifier, corsOrigins: config.corsOrigins, log: (line) => console.log(line) })

server.listen(config.port, '127.0.0.1', () => {
  console.log(`Seller API on http://127.0.0.1:${config.port}`)
  console.log(`  database: ${config.dbPath}`)
  console.log(`  platform: ${config.platformUrl} (robots connect to ${config.robotApiUrl})`)
  console.log(`  login:    ${config.authMode === 'dev' ? 'DEV tokens (local demo only)' : `Firebase project ${config.firebaseProjectId}`}`)
  console.log(`  admins:   ${config.sellerAdminEmails.join(', ') || '(none: add them in SELLER_ADMIN_EMAILS)'}`)
})

if (config.seedDemo) {
  // The platform simulator may still be starting: try for a while
  void (async () => {
    for (let attempt = 1; attempt <= 20; attempt++) {
      try {
        await seedDemo(service, store, gateway, (line) => console.log(line))
        return
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    }
    console.warn('Demo seed skipped: the platform did not answer')
  })()
}
