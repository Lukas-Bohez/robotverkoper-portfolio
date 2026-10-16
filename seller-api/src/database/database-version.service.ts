import { Inject, Injectable, Logger } from '@nestjs/common'
import { MongoClient, type Db } from 'mongodb'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import type { Migration } from './migration.interface.js'
import { migrations } from './migrations/index.js'

/** One document per applied migration */
export const MIGRATIONS_COLLECTION = '_migrations'

interface AppliedMigration {
  _id: number
  description: string
  appliedAt: Date
}

export interface DatabaseStatus {
  /** Highest migration id applied to this database (0 = untouched) */
  current: number
  /** Highest migration id this code knows */
  expected: number
  pending: Migration[]
}

/** The database has migrations applied that this code does not know about */
export class DatabaseOutOfDateError extends Error {}

/**
 * Tracks which migrations ran and applies the pending ones, in order, once. It only needs the MONGODB_URI and the
 * native driver, so the CLI (`db:status`, `db:migrate`) can run it before the rest of the app boots, and the API
 * runs it when it starts.
 */
@Injectable()
export class DatabaseVersionService {
  private readonly logger = new Logger(DatabaseVersionService.name)

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private async withDb<T>(work: (db: Db) => Promise<T>): Promise<T> {
    const client = new MongoClient(this.config.mongodbUri)
    try {
      await client.connect()
      return await work(client.db())
    } finally {
      await client.close()
    }
  }

  expectedVersion(): number {
    return migrations.at(-1)?.id ?? 0
  }

  private async appliedIds(db: Db): Promise<Set<number>> {
    const docs = await db
      .collection<AppliedMigration>(MIGRATIONS_COLLECTION)
      .find({}, { projection: { _id: 1 } })
      .toArray()
    return new Set(docs.map(doc => doc._id))
  }

  async status(): Promise<DatabaseStatus> {
    return this.withDb(async db => {
      const applied = await this.appliedIds(db)
      return {
        current: applied.size === 0 ? 0 : Math.max(...applied),
        expected: this.expectedVersion(),
        pending: migrations.filter(migration => !applied.has(migration.id)),
      }
    })
  }

  /** Applies every pending migration and records it. Safe to call again: then there is nothing left to do. */
  async migrate(): Promise<Migration[]> {
    return this.withDb(async db => {
      const applied = await this.appliedIds(db)
      const current = applied.size === 0 ? 0 : Math.max(...applied)
      if (current > this.expectedVersion()) {
        throw new DatabaseOutOfDateError(
          `The database is at version ${current}, but this code only knows migrations up to ` +
            `${this.expectedVersion()}. Update the code (git pull) before running it against this database.`,
        )
      }
      const pending = migrations.filter(migration => !applied.has(migration.id))
      for (const migration of pending) {
        this.logger.log(`Applying migration ${migration.id}: ${migration.description}`)
        await migration.up(db)
        await db.collection<AppliedMigration>(MIGRATIONS_COLLECTION).updateOne(
          { _id: migration.id },
          { $setOnInsert: { _id: migration.id, description: migration.description, appliedAt: new Date() } },
          { upsert: true },
        )
      }
      return pending
    })
  }

  /** Drops the whole database. Development only: only the explicit `db:reset` command calls it. */
  async reset(): Promise<void> {
    await this.withDb(db => db.dropDatabase())
  }
}
