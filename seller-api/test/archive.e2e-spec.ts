import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ADMIN,
  TECH,
  codeOf,
  createTestApp,
  domainCodeOf,
  gql,
  type TestContext,
} from './utils/test-app.js'
import {
  ACCOUNTS,
  ARCHIVE,
  AUDIT,
  CLOSE_DEFECT,
  COLD_STORAGE_YEARS,
  COMPANIES,
  CREATE_ROLE_PRESET,
  CREATE_SELLER_ROLE,
  DEFECTS,
  MOVE_TO_COLD_STORAGE,
  REMOVE_ACCOUNT,
  REMOVE_COMPANY,
  REMOVE_DEFECT,
  REMOVE_ROBOT,
  REMOVE_ROLE_PRESET,
  REMOVE_SELLER_ROLE,
  RESTORE_ARCHIVED,
  ROBOTS,
  SELLER_ROLES,
} from './utils/operations.js'
import {
  addAccount,
  createRobot,
  insertOldAuditEntry,
  insertOldDefect,
  reportDefect,
} from './utils/helpers.js'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(() => ctx.reset())

interface Archived {
  id: string
  kind: string
  label: string
  detail: string | null
  archivedAt: string
  archivedBy: string | null
}
const archive = async (variables: Record<string, unknown> = {}, as = ADMIN) =>
  (await gql<{ archive: Archived[] }>(ctx.app, ARCHIVE, variables, as)).data!.archive

/** One archived thing of every kind */
async function archiveEverything() {
  await addAccount(ctx, TECH, 'technician')
  await gql(ctx.app, REMOVE_ACCOUNT, { email: TECH })

  const role = await gql<{ createSellerRole: { id: string } }>(ctx.app, CREATE_SELLER_ROLE, {
    input: { key: 'tijdelijk', names: { nl: 'Tijdelijk' }, permissions: ['companies:read'] },
  })
  await gql(ctx.app, REMOVE_SELLER_ROLE, { id: role.data!.createSellerRole.id })

  const preset = await gql<{ createRolePreset: { id: string } }>(ctx.app, CREATE_ROLE_PRESET, {
    input: { names: { nl: 'Kok' }, permissions: ['orders:read'] },
  })
  await gql(ctx.app, REMOVE_ROLE_PRESET, { id: preset.data!.createRolePreset.id })

  await gql(ctx.app, REMOVE_COMPANY, { id: 'c-gelato' })

  const robot = await createRobot(ctx, 'Oude Bot')
  await gql(ctx.app, REMOVE_ROBOT, { id: robot.id })

  const other = await createRobot(ctx, 'Bot met defect')
  const defect = await reportDefect(ctx, other.id, 'Sensor vast')
  await gql(ctx.app, CLOSE_DEFECT, { id: defect.id, input: { resolution: 'FALSE_ALARM' } })
  await gql(ctx.app, REMOVE_DEFECT, { id: defect.id })
  return {
    robot,
    other,
    defect,
    preset: preset.data!.createRolePreset.id,
    role: role.data!.createSellerRole.id,
  }
}

describe('the archive: nothing is deleted, everything can be restored', () => {
  it('shows what was archived, of every kind, newest first, with who did it', async () => {
    await archiveEverything()
    const items = await archive()
    expect(items.map((item) => item.kind).sort()).toEqual([
      'ACCOUNT',
      'COMPANY',
      'DEFECT',
      'ROBOT',
      'ROLE_PRESET',
      'SELLER_ROLE',
    ])
    const times = items.map((item) => new Date(item.archivedAt).getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(items.every((item) => item.archivedBy === ADMIN)).toBe(true)
    expect(items.find((item) => item.kind === 'ACCOUNT')).toMatchObject({
      id: TECH,
      label: TECH,
      detail: 'technician',
    })
    expect(items.find((item) => item.kind === 'COMPANY')).toMatchObject({
      label: 'Gelato Bar',
      detail: 'gelato',
    })
    expect(items.find((item) => item.kind === 'ROBOT')).toMatchObject({
      label: 'Oude Bot',
      detail: 'RBT-000001',
    })
    expect(items.find((item) => item.kind === 'SELLER_ROLE')).toMatchObject({
      label: 'Tijdelijk',
      detail: 'tijdelijk',
    })
    expect(items.find((item) => item.kind === 'DEFECT')?.label).toBe('Sensor vast')
  })

  it('filters on kind and on the year it was archived', async () => {
    await archiveEverything()
    expect((await archive({ kind: 'ROBOT' })).map((item) => item.label)).toEqual(['Oude Bot'])
    const thisYear = new Date().getUTCFullYear()
    expect(await archive({ year: thisYear })).toHaveLength(6)
    expect(await archive({ year: thisYear - 1 })).toHaveLength(0)
    expect(await archive({ kind: 'COMPANY', year: thisYear })).toHaveLength(1)
  })

  it('restores every kind, and each comes back where it was', async () => {
    const made = await archiveEverything()
    for (const item of await archive()) {
      const restored = await gql(ctx.app, RESTORE_ARCHIVED, { kind: item.kind, id: item.id })
      expect(restored.errors, item.kind).toBeUndefined()
    }
    expect(await archive()).toHaveLength(0)

    expect(
      (await gql<{ accounts: { email: string }[] }>(ctx.app, ACCOUNTS)).data!.accounts.map(
        (a) => a.email,
      ),
    ).toContain(TECH)
    expect(
      (await gql<{ sellerRoles: { key: string }[] }>(ctx.app, SELLER_ROLES)).data!.sellerRoles.map(
        (r) => r.key,
      ),
    ).toContain('tijdelijk')
    expect(
      (
        await gql<{ companies: { items: { id: string }[] } }>(ctx.app, COMPANIES)
      ).data!.companies.items.map((c) => c.id),
    ).toContain('c-gelato')
    const robots = (
      await gql<{ robots: { items: { name: string }[] } }>(ctx.app, ROBOTS, { companyId: 'c-demo' })
    ).data!.robots.items
    expect(robots.map((robot) => robot.name)).toContain(made.robot.name)
    expect(
      (
        await gql<{ defects: { id: string }[] }>(ctx.app, DEFECTS, { onlyOpen: false })
      ).data!.defects.map((d) => d.id),
    ).toContain(made.defect.id)
  })

  it('an item that is restored is no longer in the archive, and cannot be restored twice', async () => {
    await archiveEverything()
    const [item] = await archive({ kind: 'ROBOT' })
    expect(
      (await gql(ctx.app, RESTORE_ARCHIVED, { kind: 'ROBOT', id: item!.id })).errors,
    ).toBeUndefined()
    const again = await gql(ctx.app, RESTORE_ARCHIVED, { kind: 'ROBOT', id: item!.id })
    expect(codeOf(again)).toBe('NOT_FOUND')
    expect(domainCodeOf(again)).toBe('archived_not_found')
    expect(
      domainCodeOf(await gql(ctx.app, RESTORE_ARCHIVED, { kind: 'DEFECT', id: 'bestaat-niet' })),
    ).toBe('archived_not_found')
  })

  it('the log tells who archived and who restored', async () => {
    await archiveEverything()
    const [robot] = await archive({ kind: 'ROBOT' })
    await gql(ctx.app, RESTORE_ARCHIVED, { kind: 'ROBOT', id: robot!.id })
    const actions = (
      await gql<{ auditLog: { action: string }[] }>(ctx.app, AUDIT, { limit: 200 })
    ).data!.auditLog.map((entry) => entry.action)
    expect(actions).toEqual(
      expect.arrayContaining([
        'account.archived',
        'seller-role.archived',
        'role-preset.archived',
        'company.archived',
        'robot.archived',
        'defect.archived',
        'robot.restored',
      ]),
    )
  })

  it('reading the archive and restoring are rights of their own', async () => {
    await addAccount(ctx, TECH, 'technician')
    expect(codeOf(await gql(ctx.app, ARCHIVE, {}, TECH))).toBe('FORBIDDEN')
    expect(codeOf(await gql(ctx.app, RESTORE_ARCHIVED, { kind: 'ROBOT', id: 'x' }, TECH))).toBe(
      'FORBIDDEN',
    )
    expect(codeOf(await gql(ctx.app, COLD_STORAGE_YEARS, {}, TECH))).toBe('FORBIDDEN')
    expect(codeOf(await gql(ctx.app, MOVE_TO_COLD_STORAGE, {}, TECH))).toBe('FORBIDDEN')
  })
})

describe('cold storage: old data leaves the daily lists but is kept', () => {
  const NOW = new Date()
  const monthsAgo = (months: number) => {
    const date = new Date(NOW)
    date.setUTCMonth(date.getUTCMonth() - months)
    return date.toISOString()
  }

  it('moves what was resolved more than a year ago, and nothing that is still open', async () => {
    const robot = await createRobot(ctx)
    await insertOldDefect(
      ctx,
      robot,
      { createdAt: '2024-11-02T15:40:00.000Z', resolvedAt: '2024-11-03T08:10:00.000Z' },
      'Klep van 2024',
    )
    await insertOldDefect(
      ctx,
      robot,
      { createdAt: '2025-03-12T09:20:00.000Z', resolvedAt: '2025-03-12T13:05:00.000Z' },
      'Wiel van 2025',
    )
    // Old but never resolved: still a problem, so it stays warm
    await insertOldDefect(
      ctx,
      robot,
      { createdAt: '2024-05-01T09:00:00.000Z', resolvedAt: null },
      'Nog open sinds 2024',
    )
    const fresh = await reportDefect(ctx, (await createRobot(ctx, 'Nieuwe Bot')).id, 'Van vandaag')
    await gql(ctx.app, CLOSE_DEFECT, { id: fresh.id, input: { resolution: 'FALSE_ALARM' } })

    const moved = await gql<{ moveToColdStorage: { defects: number } }>(
      ctx.app,
      MOVE_TO_COLD_STORAGE,
      {},
    )
    expect(moved.data?.moveToColdStorage.defects).toBe(2)

    const warm = await gql<{ defects: { summary: string }[] }>(ctx.app, DEFECTS, {
      onlyOpen: false,
    })
    expect(warm.data!.defects.map((defect) => defect.summary).sort()).toEqual([
      'Nog open sinds 2024',
      'Van vandaag',
    ])
    const all = await gql<{
      defects: {
        summary: string
        coldAt: string | null
        condition: unknown
        checklistDone: string[]
      }[]
    }>(ctx.app, DEFECTS, { onlyOpen: false, includeCold: true })
    expect(all.data!.defects).toHaveLength(4)
    const cold = all.data!.defects.find((defect) => defect.summary === 'Klep van 2024')!
    expect(cold.coldAt).toBeTruthy()
    // The heavy parts are dropped, the story stays
    expect(cold.condition).toBeNull()
    expect(cold.checklistDone).toEqual([])
  })

  it('is safe to run again: it only moves what is still warm', async () => {
    const robot = await createRobot(ctx)
    await insertOldDefect(ctx, robot, {
      createdAt: '2024-11-02T15:40:00.000Z',
      resolvedAt: '2024-11-03T08:10:00.000Z',
    })
    expect(
      (await gql<{ moveToColdStorage: { defects: number } }>(ctx.app, MOVE_TO_COLD_STORAGE, {}))
        .data?.moveToColdStorage.defects,
    ).toBe(1)
    expect(
      (await gql<{ moveToColdStorage: { defects: number } }>(ctx.app, MOVE_TO_COLD_STORAGE, {}))
        .data?.moveToColdStorage.defects,
    ).toBe(0)
  })

  it('takes another age when asked: 6 months', async () => {
    const robot = await createRobot(ctx)
    await insertOldDefect(
      ctx,
      robot,
      { createdAt: monthsAgo(8), resolvedAt: monthsAgo(8) },
      'Acht maanden oud',
    )
    await insertOldDefect(
      ctx,
      robot,
      { createdAt: monthsAgo(3), resolvedAt: monthsAgo(3) },
      'Drie maanden oud',
    )
    expect(
      (await gql<{ moveToColdStorage: { defects: number } }>(ctx.app, MOVE_TO_COLD_STORAGE, {}))
        .data?.moveToColdStorage.defects,
    ).toBe(0)
    const moved = await gql<{ moveToColdStorage: { defects: number } }>(
      ctx.app,
      MOVE_TO_COLD_STORAGE,
      { months: 6 },
    )
    expect(moved.data?.moveToColdStorage.defects).toBe(1)
    const warm = (
      await gql<{ defects: { summary: string }[] }>(ctx.app, DEFECTS, { onlyOpen: false })
    ).data!.defects
    expect(warm.map((defect) => defect.summary)).toEqual(['Drie maanden oud'])
  })

  it('filters per year, also in cold storage, and lists the years that have cold data', async () => {
    const robot = await createRobot(ctx)
    await insertOldDefect(
      ctx,
      robot,
      { createdAt: '2024-11-02T15:40:00.000Z', resolvedAt: '2024-11-03T08:10:00.000Z' },
      'Klep van 2024',
    )
    await insertOldDefect(
      ctx,
      robot,
      { createdAt: '2025-03-12T09:20:00.000Z', resolvedAt: '2025-03-12T13:05:00.000Z' },
      'Wiel van 2025',
    )
    expect(
      (await gql<{ coldStorageYears: number[] }>(ctx.app, COLD_STORAGE_YEARS)).data
        ?.coldStorageYears,
    ).toEqual([])
    await gql(ctx.app, MOVE_TO_COLD_STORAGE, {})
    expect(
      (await gql<{ coldStorageYears: number[] }>(ctx.app, COLD_STORAGE_YEARS)).data
        ?.coldStorageYears,
    ).toEqual([2025, 2024])

    const of2025 = await gql<{ defects: { summary: string }[] }>(ctx.app, DEFECTS, {
      onlyOpen: false,
      includeCold: true,
      year: 2025,
    })
    expect(of2025.data!.defects.map((defect) => defect.summary)).toEqual(['Wiel van 2025'])
    const of2024 = await gql<{ defects: { summary: string }[] }>(ctx.app, DEFECTS, {
      onlyOpen: false,
      includeCold: true,
      year: 2024,
    })
    expect(of2024.data!.defects.map((defect) => defect.summary)).toEqual(['Klep van 2024'])
    // Without asking for cold storage the year shows nothing
    expect(
      (await gql<{ defects: unknown[] }>(ctx.app, DEFECTS, { onlyOpen: false, year: 2025 })).data
        ?.defects,
    ).toEqual([])
  })

  it('moves old lines of the log too, and shows them only on request', async () => {
    await insertOldAuditEntry(ctx, '2024-06-01T10:00:00.000Z')
    await insertOldAuditEntry(ctx, '2025-02-01T10:00:00.000Z')
    await createRobot(ctx)
    const moved = await gql<{ moveToColdStorage: { auditEntries: number } }>(
      ctx.app,
      MOVE_TO_COLD_STORAGE,
      {},
    )
    expect(moved.data?.moveToColdStorage.auditEntries).toBe(2)

    const warm = (await gql<{ auditLog: { action: string }[] }>(ctx.app, AUDIT)).data!.auditLog
    expect(warm.map((entry) => entry.action)).toEqual(['robot.created'])
    const all = (
      await gql<{ auditLog: { coldAt: string | null }[] }>(ctx.app, AUDIT, { includeCold: true })
    ).data!.auditLog
    expect(all).toHaveLength(3)
    expect(all.filter((entry) => entry.coldAt)).toHaveLength(2)
    const of2024 = (
      await gql<{ auditLog: unknown[] }>(ctx.app, AUDIT, { includeCold: true, year: 2024 })
    ).data!.auditLog
    expect(of2024).toHaveLength(1)
  })

  it('an archived defect that is old goes to cold storage as well, and keeps its place in the archive', async () => {
    const robot = await createRobot(ctx)
    await insertOldDefect(ctx, robot, {
      createdAt: '2024-11-02T15:40:00.000Z',
      resolvedAt: '2024-11-03T08:10:00.000Z',
    })
    const [old] = (await gql<{ defects: { id: string }[] }>(ctx.app, DEFECTS, { onlyOpen: false }))
      .data!.defects
    await gql(ctx.app, REMOVE_DEFECT, { id: old!.id })
    await gql(ctx.app, MOVE_TO_COLD_STORAGE, {})
    expect(await archive({ kind: 'DEFECT' })).toHaveLength(1)
    expect(
      (await gql<{ coldStorageYears: number[] }>(ctx.app, COLD_STORAGE_YEARS)).data
        ?.coldStorageYears,
    ).toEqual([2024])
    expect(ADMIN).toBeTruthy()
  })
})
