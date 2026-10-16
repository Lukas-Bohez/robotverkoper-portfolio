import type { Migration } from '../migration.interface.js'

/**
 * The indexes the seller side relies on, also where `synchronize` is off (production): every id and the e-mail
 * address of an account are unique, and the lists we filter on are indexed.
 */
const migration: Migration = {
  id: 2,
  description:
    'Unique ids and the indexes of the lists (robots per company, defects per status, audit by date)',
  async up(db) {
    await db
      .collection('robot_models')
      .createIndex({ id: 1 }, { unique: true, name: 'robot_models_id' })
    await db.collection('companies').createIndex({ id: 1 }, { unique: true, name: 'companies_id' })
    await db.collection('robots').createIndex({ id: 1 }, { unique: true, name: 'robots_id' })
    await db
      .collection('robots')
      .createIndex({ companyId: 1, retiredAt: 1 }, { name: 'robots_company' })
    await db.collection('defects').createIndex({ id: 1 }, { unique: true, name: 'defects_id' })
    await db
      .collection('defects')
      .createIndex({ status: 1, createdAt: -1 }, { name: 'defects_status' })
    await db
      .collection('accounts')
      .createIndex({ email: 1 }, { unique: true, name: 'accounts_email' })
    await db.collection('audit').createIndex({ createdAt: -1 }, { name: 'audit_created' })
  },
}

export default migration
