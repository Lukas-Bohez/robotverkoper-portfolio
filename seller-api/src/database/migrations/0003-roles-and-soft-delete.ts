import type { Db } from 'mongodb'
import { DEFAULT_ROLES } from '../../authentication/permissions.js'
import type { Migration } from '../migration.interface.js'

/** Drops an index that may not exist (a database that never had it) */
async function dropIndexIfExists(db: Db, collection: string, name: string): Promise<void> {
  try {
    await db.collection(collection).dropIndex(name)
  } catch {
    // The index is not there: nothing to drop
  }
}

/**
 * The feedback of 16/10 (#137) changed the data model of our own staff and of the mirrors of the platform:
 *  - roles became data: `seller_roles` (names per language, rights, locked) and an account has a `roleKey`
 *    instead of the old `role` of a fixed list
 *  - everything that can be "deleted" got `deletedAt` (soft delete): accounts, roles, companies, robots
 *  - companies and robots keep the id of the platform as `platformId` instead of `id` (`_id` is the id of the document)
 *  - a robot got a serial number (the number on its QR code) and a place; the log got `createdAt` instead of `at`
 */
const migration: Migration = {
  id: 3,
  description: 'Roles as data, soft delete, platformId, serial numbers and createdAt in the log',
  async up(db) {
    const now = new Date()

    // 1. The roles that always exist (and nothing else: an existing role is left alone)
    for (const role of DEFAULT_ROLES) {
      await db.collection('seller_roles').updateOne(
        { key: role.key },
        {
          $setOnInsert: {
            key: role.key,
            names: role.names,
            permissions: [...role.permissions],
            locked: role.locked,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        },
        { upsert: true },
      )
    }

    // 2. Accounts: `role` ('admin' or 'technician') becomes `roleKey`, and an account can be archived
    await db
      .collection('accounts')
      .updateMany({ roleKey: { $exists: false }, role: { $exists: true } }, [
        { $set: { roleKey: '$role' } },
        { $unset: 'role' },
      ])
    await db.collection('accounts').updateMany({ deletedAt: { $exists: false } }, { $set: { deletedAt: null } })

    // 3. Companies and robots: the id of the platform is `platformId`; both can be archived
    for (const name of ['companies', 'robots']) {
      await db
        .collection(name)
        .updateMany({ platformId: { $exists: false }, id: { $exists: true } }, [
          { $set: { platformId: '$id' } },
          { $unset: 'id' },
        ])
      await db.collection(name).updateMany({ deletedAt: { $exists: false } }, { $set: { deletedAt: null } })
    }
    await dropIndexIfExists(db, 'companies', 'companies_id')
    await dropIndexIfExists(db, 'robots', 'robots_id')
    await dropIndexIfExists(db, 'robot_models', 'robot_models_id')
    await dropIndexIfExists(db, 'robots', 'robots_company')

    // 4. Robot models are found by their key
    await db
      .collection('robot_models')
      .updateMany({ key: { $exists: false }, id: { $exists: true } }, [{ $set: { key: '$id' } }, { $unset: 'id' }])

    // 5. Robots: a serial number (RBT- and six digits, in the order they were made), a company that may be empty
    // (a robot in the warehouse) and a place
    const robots = await db.collection('robots').find({ serial: { $exists: false } }).sort({ createdAt: 1 }).toArray()
    const highest = await db
      .collection('robots')
      .find({ serial: { $exists: true } })
      .toArray()
      .then(found => found.reduce((max, robot) => Math.max(max, Number(String(robot.serial).slice(4)) || 0), 0))
    let number = highest
    for (const robot of robots) {
      number += 1
      await db
        .collection('robots')
        .updateOne({ _id: robot._id }, { $set: { serial: `RBT-${String(number).padStart(6, '0')}`, location: null } })
    }

    // 6. The log: `at` is `createdAt`, and an entry can move to cold storage
    await db
      .collection('audit')
      .updateMany({ createdAt: { $exists: false }, at: { $exists: true } }, [
        { $set: { createdAt: '$at', coldAt: null } },
        { $unset: 'at' },
      ])
    await db.collection('audit').updateMany({ coldAt: { $exists: false } }, { $set: { coldAt: null } })

    // 7. Indexes: the new keys are unique, and the lists we filter on are indexed
    await db.collection('seller_roles').createIndex({ key: 1 }, { unique: true, name: 'seller_roles_key' })
    await db.collection('robot_models').createIndex({ key: 1 }, { unique: true, name: 'robot_models_key' })
    await db
      .collection('companies')
      .createIndex({ platformId: 1 }, { unique: true, name: 'companies_platform_id' })
    await db.collection('robots').createIndex({ serial: 1 }, { unique: true, name: 'robots_serial' })
    await db
      .collection('robots')
      .createIndex(
        { platformId: 1 },
        { unique: true, name: 'robots_platform_id', partialFilterExpression: { platformId: { $type: 'string' } } },
      )
    await db
      .collection('robots')
      .createIndex({ companyId: 1, retiredAt: 1, deletedAt: 1 }, { name: 'robots_company' })
  },
}

export default migration
