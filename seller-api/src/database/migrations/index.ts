import type { Migration } from '../migration.interface.js'
import baseline from './0001-baseline.js'
import sellerIndexes from './0002-seller-indexes.js'
import rolesAndSoftDelete from './0003-roles-and-soft-delete.js'
import defectLifecycle from './0004-defect-lifecycle.js'

/**
 * Every migration, in the order they must run. To add one: create `NNNN-short-name.ts` next to this file
 * (next number = highest id + 1) and append it here. Never edit or remove one that is merged: add a new one.
 */
export const migrations: Migration[] = [baseline, sellerIndexes, rolesAndSoftDelete, defectLifecycle]

const ids = migrations.map(migration => migration.id)
if (ids.some((id, index) => index > 0 && id <= (ids[index - 1] ?? 0))) {
  throw new Error('The migrations must have ascending, unique ids')
}
