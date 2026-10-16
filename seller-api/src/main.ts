import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { applySecurity } from './common/security/app-security.js'
import { APP_CONFIG, type AppConfig } from './config/app-config.js'
import { DatabaseVersionService } from './database/database-version.service.js'
import { SeedService } from './seed/seed.service.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get<AppConfig>(APP_CONFIG)
  applySecurity(app, config.corsOrigins) // CORS and Helmet

  // The database first: migrations, then the robot models (and in the demo the demo data)
  await app.get(DatabaseVersionService).migrate()
  try {
    await app.get(SeedService).seedAll()
  } catch (error) {
    // A platform that does not answer yet must not stop the API: the demo data can be added later (`npm run cli -- seed`)
    new Logger('Seed').error(`Seeding failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  await app.listen(config.port, config.host)
  const log = new Logger('seller-api')
  log.log(`GraphQL on ${await app.getUrl()}/graphql`)
  log.log(`Auth: ${config.authMode}. Administrators: ${config.sellerAdminEmails.join(', ') || '(none: set SELLER_ADMIN_EMAILS)'}`)
  log.log(`Platform: ${config.platformUrl}. Database: ${config.mongodbUri.replace(/\/\/[^@]*@/, '//***@')}`)
}
await bootstrap()
