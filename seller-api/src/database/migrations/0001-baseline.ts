import type { Migration } from '../migration.interface.js'

/** The starting point of the version mechanism: version 0 is an untouched database, version 1 is the baseline. */
const migration: Migration = {
  id: 1,
  description: 'Baseline (no data changes)',
  async up() {
    // Intentionally empty.
  },
}

export default migration
