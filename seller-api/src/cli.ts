import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { CommandModule, CommandService } from './seed/nestjs-command.js'

/** `npm run cli -- seed`: runs one command of seed/seed.command.ts against the database of the settings */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  })
  try {
    await app.select(CommandModule).get(CommandService).exec()
    await app.close()
  } catch (error) {
    console.error(error)
    await app.close()
    process.exit(1)
  }
}
await bootstrap()
