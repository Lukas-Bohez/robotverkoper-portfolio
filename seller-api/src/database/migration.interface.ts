import type { Db } from 'mongodb'

/**
 * A single, committed change to the database's *data* (MongoDB has no schema to compare). Use it for what
 * `synchronize` cannot do: renaming or backfilling a field, or an index that must exist before the app relies on it.
 *
 * - Never edit or renumber a migration once it is merged: others may have applied it.
 * - `up()` should be safe to run twice.
 */
export interface Migration {
  /** Sequential and unique, ascending */
  id: number
  /** What changed and why, shown by `db:status` */
  description: string
  up(db: Db): Promise<void>
}
