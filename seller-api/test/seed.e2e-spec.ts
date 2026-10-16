import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SeedService } from '../src/seed/seed.service.js'
import { ADMIN, createTestApp, gql, type TestContext } from './utils/test-app.js'
import {
  ACCOUNTS,
  ARCHIVE,
  COLD_STORAGE_YEARS,
  COMPANY_ROLES,
  DEFECTS,
  ROLE_PRESETS,
  SELLER_ROLES,
  STOCK_ROBOTS,
} from './utils/operations.js'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(async () => {
  await ctx.reset()
  ctx.platform.companiesList = [
    { id: 'c-demo', name: 'Demozaak', subdomain: 'demo', createdAt: '2026-09-23T08:00:00.000Z' },
    {
      id: 'c-gelato',
      name: 'Gelato Bar',
      subdomain: 'gelato',
      createdAt: '2026-10-10T09:30:00.000Z',
    },
    {
      id: 'c-pizza',
      name: 'Pizzeria Test',
      subdomain: 'pizzeria-test',
      createdAt: '2026-10-14T11:15:00.000Z',
    },
  ]
})

describe('the demo seed', () => {
  it('fills an empty database with staff, presets, robots, stock, three defects and old defects in cold storage', async () => {
    const seed = ctx.app.get(SeedService)
    await seed.seedDemo()

    expect(ctx.platform.robots.size, 'six robots at the companies').toBe(6)
    expect(ctx.platform.simulated.size).toBe(6)
    expect(
      [...ctx.platform.simulated.values()].every((state) => typeof state.battery === 'number'),
    ).toBe(true)

    const stock = (await gql<{ stockRobots: { serial: string }[] }>(ctx.app, STOCK_ROBOTS)).data!
      .stockRobots
    expect(stock.map((robot) => robot.serial).sort()).toEqual([
      'RBT-000417',
      'RBT-000418',
      'RBT-000419',
    ])

    const open = (
      await gql<{
        defects: {
          summary: string
          status: string
          robot: { name: string }
          condition: { hasCargo: boolean } | null
        }[]
      }>(ctx.app, DEFECTS, { onlyOpen: true })
    ).data!.defects
    expect(open).toHaveLength(3)
    const withFood = open.find((defect) => defect.robot.name === 'Food Robot 2')
    expect(withFood).toMatchObject({ status: 'EN_ROUTE', condition: { hasCargo: true } })
    expect(open.filter((defect) => defect.status === 'OPEN')).toHaveLength(2)

    const history = (
      await gql<{ defects: unknown[] }>(ctx.app, DEFECTS, { onlyOpen: false, includeCold: true })
    ).data!.defects
    expect(history).toHaveLength(5)
    expect(
      (await gql<{ coldStorageYears: number[] }>(ctx.app, COLD_STORAGE_YEARS)).data
        ?.coldStorageYears,
    ).toEqual([2025, 2024])
  })

  it('makes staff with roles in four languages, and archives one of the accounts', async () => {
    await ctx.app.get(SeedService).seedDemo()
    const roles = (
      await gql<{ sellerRoles: { key: string; fr: string; de: string }[] }>(ctx.app, SELLER_ROLES)
    ).data!.sellerRoles
    expect(roles.map((role) => role.key)).toEqual(['admin', 'helpdesk', 'stagiair', 'technician'])
    expect(roles.find((role) => role.key === 'helpdesk')).toMatchObject({
      fr: 'Assistance',
      de: 'Helpdesk',
    })

    const accounts = (await gql<{ accounts: { email: string }[] }>(ctx.app, ACCOUNTS)).data!
      .accounts
    expect(accounts.map((account) => account.email)).not.toContain('technieker.oud@fabrikant.be')
    const archived = (
      await gql<{ archive: { kind: string; label: string }[] }>(ctx.app, ARCHIVE, {
        kind: 'ACCOUNT',
      })
    ).data!.archive
    expect(archived.map((item) => item.label)).toEqual(['technieker.oud@fabrikant.be'])
  })

  it('has presets, and the first company already uses three of them', async () => {
    await ctx.app.get(SeedService).seedDemo()
    const presets = (
      await gql<{ rolePresets: { nl: string; missingLanguages: string[] }[] }>(
        ctx.app,
        ROLE_PRESETS,
      )
    ).data!.rolePresets
    expect(presets.map((preset) => preset.nl)).toEqual(['Kassier', 'Kok', 'Lader', 'Ober'])
    expect(presets.find((preset) => preset.nl === 'Ober')?.missingLanguages).toEqual(['fr', 'de'])
    const roles = (
      await gql<{ companyRoles: { name: string }[] }>(ctx.app, COMPANY_ROLES, {
        companyId: 'c-demo',
      })
    ).data!.companyRoles
    expect(roles.map((role) => role.name).sort()).toEqual(['Kok', 'Lader', 'Ober', 'TENANT_ADMIN'])
  })

  it('runs once: a second run changes nothing', async () => {
    const seed = ctx.app.get(SeedService)
    await seed.seedDemo()
    await seed.seedDemo()
    expect(ctx.platform.robots.size).toBe(6)
    expect(
      (await gql<{ stockRobots: unknown[] }>(ctx.app, STOCK_ROBOTS)).data?.stockRobots,
    ).toHaveLength(3)
    expect(ADMIN).toBeTruthy()
  })

  it('seedAll without the demo flag only puts the models and the roles in place', async () => {
    await ctx.app.get(SeedService).seedAll()
    expect(ctx.platform.robots.size).toBe(0)
    const roles = (await gql<{ sellerRoles: { key: string }[] }>(ctx.app, SELLER_ROLES)).data!
      .sellerRoles
    expect(roles.map((role) => role.key)).toEqual(['admin', 'technician'])
  })

  it('clear empties what we own, and the administrators of the settings can still log in', async () => {
    const seed = ctx.app.get(SeedService)
    await seed.seedDemo()
    await seed.clearAll()
    expect(
      (await gql<{ stockRobots: unknown[] }>(ctx.app, STOCK_ROBOTS)).data?.stockRobots,
    ).toHaveLength(0)
    // The roles are gone with it, but the administrators of the settings are never locked out
    expect(
      (await gql<{ sellerRoles: unknown[] }>(ctx.app, SELLER_ROLES)).data?.sellerRoles,
    ).toHaveLength(0)
    await seed.seedAll()
    expect(
      (await gql<{ sellerRoles: unknown[] }>(ctx.app, SELLER_ROLES)).data?.sellerRoles,
    ).toHaveLength(2)
  })
})
