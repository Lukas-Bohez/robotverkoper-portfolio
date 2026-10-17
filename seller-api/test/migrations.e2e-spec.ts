import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AppConfig } from '../src/config/app-config.js'
import { DatabaseVersionService } from '../src/database/database-version.service.js'

/**
 * The database of someone who ran the first version (before roles as data, soft delete and the defect lifecycle): several
 * companies, robots and defects with the old `id` field under a unique index. Migrating it must not collide on the
 * removed field (a unique index treats a removed field as null).
 */
const base = (process.env.MONGODB_URI ?? '').replace(/\/[^/]*$/, '')
const uri = `${base}/legacy-${randomUUID().slice(0, 8)}`
let client: MongoClient

beforeAll(async () => {
  client = await new MongoClient(uri).connect()
  const db = client.db()
  // What versions 1 and 2 left behind
  await db.collection('_migrations').insertMany([
    { _id: 1 as never, description: 'baseline', appliedAt: new Date() },
    { _id: 2 as never, description: 'indexes', appliedAt: new Date() },
  ])
  await db.collection('companies').createIndex({ id: 1 }, { unique: true, name: 'companies_id' })
  await db.collection('robots').createIndex({ id: 1 }, { unique: true, name: 'robots_id' })
  await db.collection('robot_models').createIndex({ id: 1 }, { unique: true, name: 'robot_models_id' })
  await db.collection('defects').createIndex({ id: 1 }, { unique: true, name: 'defects_id' })
  await db.collection('defects').createIndex({ status: 1 }, { name: 'defects_status' })
  await db.collection('companies').insertMany([
    { id: 'c1', name: 'Demozaak', subdomain: 'demo', createdAt: new Date('2026-09-23') },
    { id: 'c2', name: 'Gelato Bar', subdomain: 'gelato', createdAt: new Date('2026-10-10') },
    { id: 'c3', name: 'Pizzeria', subdomain: 'pizza', createdAt: new Date('2026-10-14') },
  ])
  await db.collection('robot_models').insertMany([
    { id: 'model-food', name: 'Eten', kind: 'FOOD' },
    { id: 'model-parcel', name: 'Pakket', kind: 'PARCEL' },
  ])
  await db.collection('robots').insertMany([
    { id: 'r1', companyId: 'c1', modelId: 'model-food', name: 'Eerste', createdAt: new Date('2026-09-24') },
    { id: 'r2', companyId: 'c1', modelId: 'model-parcel', name: 'Tweede', createdAt: new Date('2026-09-25') },
    { id: 'r3', companyId: 'c2', modelId: 'model-food', name: 'Derde', createdAt: new Date('2026-10-11') },
  ])
  await db.collection('defects').insertMany([
    { id: 'd1', robotId: 'r1', companyId: 'c1', summary: 'Sensor vast', severity: 'high', status: 'open', createdAt: new Date('2026-10-01') },
    { id: 'd2', robotId: 'r2', companyId: 'c1', summary: 'Wiel', severity: 'low', status: 'closed', createdAt: new Date('2026-10-02'), resolvedAt: new Date('2026-10-03') },
    { id: 'd3', robotId: 'r3', companyId: 'c2', summary: 'Klep', severity: 'medium', status: 'replaced', createdAt: new Date('2026-10-04'), resolvedAt: new Date('2026-10-05'), replacementRobotId: 'r9' },
  ])
  await db.collection('accounts').insertMany([
    { email: 'a@x.be', role: 'admin', createdBy: null },
    { email: 'b@x.be', role: 'technician', createdBy: 'a@x.be' },
  ])
})
afterAll(async () => {
  await client.db().dropDatabase()
  await client.close()
})

describe('migrating a database of the first version', () => {
  it('moves every old document to the new shape without a duplicate key error', async () => {
    const versions = new DatabaseVersionService({ mongodbUri: uri } as AppConfig)
    const applied = await versions.migrate()
    expect(applied.map(migration => migration.id)).toEqual([3, 4])

    const db = client.db()
    const companies = await db.collection('companies').find().sort({ name: 1 }).toArray()
    expect(companies.map(c => c.platformId)).toEqual(['c1', 'c2', 'c3'])
    expect(companies.every(c => c.id === undefined && c.deletedAt === null)).toBe(true)

    const robots = await db.collection('robots').find().sort({ createdAt: 1 }).toArray()
    expect(robots.map(r => [r.platformId, r.serial])).toEqual([
      ['r1', 'RBT-000001'],
      ['r2', 'RBT-000002'],
      ['r3', 'RBT-000003'],
    ])

    const models = await db.collection('robot_models').find().toArray()
    expect(models.map(m => m.key).sort()).toEqual(['model-food', 'model-parcel'])

    const accounts = await db.collection('accounts').find().sort({ email: 1 }).toArray()
    expect(accounts.map(a => a.roleKey)).toEqual(['admin', 'technician'])
    expect(await db.collection('seller_roles').countDocuments()).toBe(2)
  })

  it('turns the old status of a defect into what happened to it', async () => {
    const defects = await client.db().collection('defects').find().sort({ createdAt: 1 }).toArray()
    expect(defects.map(d => [d.resolution, d.status, d.id])).toEqual([
      [null, undefined, undefined],
      ['repaired', undefined, undefined],
      ['replaced', undefined, undefined],
    ])
    expect(defects.every(d => d.coldAt === null && d.deletedAt === null && Array.isArray(d.checklistDone))).toBe(true)
  })

  it('is safe to run again', async () => {
    const versions = new DatabaseVersionService({ mongodbUri: uri } as AppConfig)
    expect(await versions.migrate()).toEqual([])
  })
})
