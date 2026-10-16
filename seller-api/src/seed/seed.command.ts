import { Injectable } from '@nestjs/common'
import { ColdStorageService } from '../archive/cold-storage.service.js'
import { DatabaseVersionService } from '../database/database-version.service.js'
import { Command } from './nestjs-command.js'
import { SeedService } from './seed.service.js'

/**
 * The commands of `npm run cli -- <command>` (see the README):
 *   seed       the robot models and the roles, and with SEED_DEMO=true the demo staff, robots and defects
 *   clear      empties what the seller side owns
 *   reset      clear, then seed
 *   db:status  the version of the database and the migrations that are still to run
 *   db:migrate runs the pending migrations
 *   db:reset   drops the whole database (development only)
 *   cold:move  moves resolved defects and log lines older than 12 months to cold storage (--months 6 for another age)
 */
@Injectable()
export class SeedCommand {
  constructor(
    private readonly seed: SeedService,
    private readonly database: DatabaseVersionService,
    private readonly cold: ColdStorageService,
  ) {}

  @Command({
    command: 'seed',
    describe: 'Add the robot models and the roles (and with SEED_DEMO=true the demo data)',
  })
  async seedAll(): Promise<void> {
    await this.seed.seedAll()
    console.info('Seeded: the robot models and the roles (and the demo data when SEED_DEMO=true).')
  }

  @Command({ command: 'clear', describe: 'Empty everything the seller side owns' })
  async clear(): Promise<void> {
    await this.seed.clearAll()
    console.info('Emptied everything the seller side owns.')
  }

  @Command({ command: 'reset', describe: 'Clear, then seed again' })
  async clearAndSeed(): Promise<void> {
    await this.seed.clearAll()
    await this.seed.seedAll()
    console.info('Emptied and seeded again.')
  }

  @Command({ command: 'cold:move', describe: 'Move what is older than 12 months to cold storage' })
  async coldMove(): Promise<void> {
    const months = Number(
      process.argv.find((arg) => arg.startsWith('--months='))?.split('=')[1] ?? 12,
    )
    const moved = await this.cold.moveOldData(new Date(), months)
    console.info(
      `Cold storage: ${moved.defects} defects and ${moved.auditEntries} log lines moved.`,
    )
  }

  @Command({
    command: 'db:status',
    describe: 'The version of the database and the pending migrations',
  })
  async status(): Promise<void> {
    const { current, expected, pending } = await this.database.status()
    console.info(`Database version: ${current} (this code expects: ${expected})`)
    if (pending.length === 0) console.info('No pending migrations.')
    for (const migration of pending)
      console.info(`  pending ${migration.id}: ${migration.description}`)
  }

  @Command({ command: 'db:migrate', describe: 'Run the pending migrations' })
  async migrate(): Promise<void> {
    const applied = await this.database.migrate()
    console.info(
      applied.length === 0 ? 'Nothing to migrate.' : `Applied ${applied.length} migration(s).`,
    )
  }

  @Command({ command: 'db:reset', describe: 'Drop the whole database (development only)' })
  async dropDatabase(): Promise<void> {
    await this.database.reset()
    console.info('Database dropped.')
  }
}
