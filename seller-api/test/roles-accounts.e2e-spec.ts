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
  ADD_ACCOUNT,
  COMPANY_PERMISSIONS,
  COMPANY_ROLES,
  COPY_COMPANY_ROLE,
  CREATE_COMPANY_ROLE,
  CREATE_SELLER_ROLE,
  ME,
  REMOVE_ACCOUNT,
  REMOVE_COMPANY_ROLE,
  REMOVE_SELLER_ROLE,
  RESTORE_ACCOUNT,
  RESTORE_COMPANY_ROLE,
  RESTORE_SELLER_ROLE,
  SELLER_PERMISSIONS,
  SELLER_ROLES,
  UPDATE_COMPANY_ROLE,
  UPDATE_SELLER_ROLE,
} from './utils/operations.js'
import { addAccount } from './utils/helpers.js'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(() => ctx.reset())

interface RoleRow {
  id: string
  name: string
  permissions: string[]
  locked?: boolean
  archivedAt?: string | null
  names?: Record<string, string | null>
}

const rolesOf = async (companyId: string, withDeleted = false) =>
  (await gql<{ companyRoles: RoleRow[] }>(ctx.app, COMPANY_ROLES, { companyId, withDeleted })).data!
    .companyRoles

const createRole = async (
  companyId: string,
  name: string,
  permissions: string[],
  names?: Record<string, string>,
) => {
  const created = await gql<{ createCompanyRole: RoleRow }>(ctx.app, CREATE_COMPANY_ROLE, {
    companyId,
    input: { name, permissions, names },
  })
  if (created.errors) throw new Error(JSON.stringify(created.errors))
  return created.data!.createCompanyRole
}

describe('roles of a company', () => {
  it('makes a role with a name in every language and shows it in the list', async () => {
    const created = await createRole('c-demo', 'Kok', ['orders:read', 'orders:prepare'], {
      en: 'Cook',
      fr: 'Cuisinier',
    })
    expect(created.names).toEqual({ nl: 'Kok', en: 'Cook', fr: 'Cuisinier', de: null })
    const list = await rolesOf('c-demo')
    expect(list.map((role) => role.name)).toEqual(['TENANT_ADMIN', 'Kok'])
    expect(list[1]?.permissions).toEqual(['orders:read', 'orders:prepare'])
  })

  it('removing a role is a soft delete: it leaves the list, stays known and comes back on restore', async () => {
    const role = await createRole('c-demo', 'Kok', ['orders:read'])
    const archived = await gql<{ removeCompanyRole: RoleRow }>(ctx.app, REMOVE_COMPANY_ROLE, {
      companyId: 'c-demo',
      roleId: role.id,
    })
    expect(archived.errors).toBeUndefined()
    expect(archived.data?.removeCompanyRole.archivedAt).toBeTruthy()

    expect((await rolesOf('c-demo')).map((row) => row.name)).toEqual(['TENANT_ADMIN'])
    const all = await rolesOf('c-demo', true)
    expect(all.map((row) => row.name)).toEqual(['TENANT_ADMIN', 'Kok'])
    expect(all[1]?.archivedAt).toBeTruthy()

    const restored = await gql<{ restoreCompanyRole: RoleRow }>(ctx.app, RESTORE_COMPANY_ROLE, {
      companyId: 'c-demo',
      roleId: role.id,
    })
    expect(restored.data?.restoreCompanyRole.archivedAt).toBeNull()
    expect((await rolesOf('c-demo')).map((row) => row.name)).toEqual(['TENANT_ADMIN', 'Kok'])
  })

  it('never archives or changes the locked administrator role', async () => {
    const archive = await gql(ctx.app, REMOVE_COMPANY_ROLE, {
      companyId: 'c-demo',
      roleId: 'c-demo-admin',
    })
    expect(codeOf(archive)).toBe('CONFLICT')
    expect(domainCodeOf(archive)).toBe('role_locked')
    const change = await gql(ctx.app, UPDATE_COMPANY_ROLE, {
      companyId: 'c-demo',
      roleId: 'c-demo-admin',
      input: { permissions: ['orders:read'] },
    })
    expect(domainCodeOf(change)).toBe('role_locked')
  })

  it('says NOT_FOUND for a role that does not exist and CONFLICT for restoring one that is not archived', async () => {
    const missing = await gql(ctx.app, REMOVE_COMPANY_ROLE, {
      companyId: 'c-demo',
      roleId: 'bestaat-niet',
    })
    expect(codeOf(missing)).toBe('NOT_FOUND')
    const role = await createRole('c-demo', 'Kok', ['orders:read'])
    const restore = await gql(ctx.app, RESTORE_COMPANY_ROLE, {
      companyId: 'c-demo',
      roleId: role.id,
    })
    expect(codeOf(restore)).toBe('CONFLICT')
    expect(domainCodeOf(restore)).toBe('not_archived')
    expect(codeOf(await gql(ctx.app, COMPANY_ROLES, { companyId: 'bestaat-niet' }))).toBe(
      'NOT_FOUND',
    )
  })

  it('changes the rights of a role, one cell of the table at a time', async () => {
    const role = await createRole('c-demo', 'Kok', ['orders:read'])
    const updated = await gql<{ updateCompanyRole: RoleRow }>(ctx.app, UPDATE_COMPANY_ROLE, {
      companyId: 'c-demo',
      roleId: role.id,
      input: { permissions: ['orders:read', 'orders:prepare', 'orders:prepare'] },
    })
    expect(updated.data?.updateCompanyRole.permissions).toEqual(['orders:read', 'orders:prepare'])
    // Only the rights changed, the name stays
    expect(updated.data?.updateCompanyRole.name).toBe('Kok')
    const renamed = await gql<{ updateCompanyRole: RoleRow }>(ctx.app, UPDATE_COMPANY_ROLE, {
      companyId: 'c-demo',
      roleId: role.id,
      input: { names: { en: 'Cook' } },
    })
    expect(renamed.data?.updateCompanyRole.names?.en).toBe('Cook')
    expect(renamed.data?.updateCompanyRole.permissions).toEqual(['orders:read', 'orders:prepare'])
  })

  it('refuses a permission the platform does not know', async () => {
    const result = await gql(ctx.app, CREATE_COMPANY_ROLE, {
      companyId: 'c-demo',
      input: { name: 'Hacker', permissions: ['db:drop'] },
    })
    expect(codeOf(result)).toBe('BAD_REQUEST')
    expect(domainCodeOf(result)).toBe('unknown_permission')
  })

  it('offers the list of permissions to build a role from', async () => {
    const { data } = await gql<{ companyPermissions: string[] }>(ctx.app, COMPANY_PERMISSIONS)
    expect(data?.companyPermissions).toContain('orders:prepare')
  })

  it('copies a role to other companies and leaves a company alone that has a role with that name', async () => {
    const role = await createRole('c-demo', 'Kok', ['orders:read', 'orders:prepare'], {
      en: 'Cook',
      fr: 'Cuisinier',
    })
    await createRole('c-gelato', 'kok', ['orders:read'])
    ctx.platform.companiesList.push({
      id: 'c-pizza',
      name: 'Pizza',
      subdomain: 'pizza',
      createdAt: '2026-10-11T09:00:00.000Z',
    })

    const result = await gql<{ copyCompanyRole: { copied: number; skipped: string[] } }>(
      ctx.app,
      COPY_COMPANY_ROLE,
      {
        companyId: 'c-demo',
        roleId: role.id,
        input: { targetCompanyIds: ['c-gelato', 'c-pizza', 'c-pizza', 'c-demo'] },
      },
    )
    expect(result.errors).toBeUndefined()
    expect(result.data?.copyCompanyRole).toEqual({ copied: 1, skipped: ['Gelato Bar: Kok'] })

    const copy = (await rolesOf('c-pizza')).find((row) => row.name === 'Kok')
    expect(copy?.permissions).toEqual(['orders:read', 'orders:prepare'])
    expect(copy?.names).toMatchObject({ nl: 'Kok', en: 'Cook', fr: 'Cuisinier' })
    // What the other company had stays as it was
    expect((await rolesOf('c-gelato')).find((row) => row.name === 'kok')?.permissions).toEqual([
      'orders:read',
    ])
  })
})

describe('our own staff', () => {
  it('adds, changes and archives an account, and restores it', async () => {
    const added = await gql<{ addAccount: { email: string; role: { key: string } } }>(
      ctx.app,
      ADD_ACCOUNT,
      {
        input: { email: ' Technieker@Fabrikant.example ', roleKey: 'technician' },
      },
    )
    expect(added.data?.addAccount.email).toBe(TECH)
    expect(added.data?.addAccount.role.key).toBe('technician')
    const changed = await gql<{ addAccount: { role: { key: string } } }>(ctx.app, ADD_ACCOUNT, {
      input: { email: TECH, roleKey: 'admin' },
    })
    expect(changed.data?.addAccount.role.key).toBe('admin')

    const list = (
      await gql<{ accounts: { email: string; role: { key: string } }[] }>(ctx.app, ACCOUNTS)
    ).data!.accounts
    expect(list.map((account) => [account.email, account.role.key])).toEqual([
      [ADMIN, 'admin'],
      [TECH, 'admin'],
    ])

    const archived = await gql<{ removeAccount: { deletedAt: string | null } }>(
      ctx.app,
      REMOVE_ACCOUNT,
      { email: TECH },
    )
    expect(archived.data?.removeAccount.deletedAt).toBeTruthy()
    const afterArchive = (await gql<{ accounts: { email: string }[] }>(ctx.app, ACCOUNTS)).data!
      .accounts
    expect(afterArchive.map((account) => account.email)).toEqual([ADMIN])
    const withArchived = (
      await gql<{ accounts: { email: string; deletedAt: string | null }[] }>(ctx.app, ACCOUNTS, {
        withDeleted: true,
      })
    ).data!.accounts
    expect(withArchived.find((account) => account.email === TECH)?.deletedAt).toBeTruthy()

    const restored = await gql<{ restoreAccount: { deletedAt: string | null } }>(
      ctx.app,
      RESTORE_ACCOUNT,
      { email: TECH },
    )
    expect(restored.data?.restoreAccount.deletedAt).toBeNull()
    expect(codeOf(await gql(ctx.app, RESTORE_ACCOUNT, { email: TECH }))).toBe('CONFLICT')
    expect(codeOf(await gql(ctx.app, REMOVE_ACCOUNT, { email: 'niemand@x.be' }))).toBe('NOT_FOUND')
  })

  it('an archived account that gets a role again is brought back, not made twice', async () => {
    await addAccount(ctx, TECH, 'technician')
    await gql(ctx.app, REMOVE_ACCOUNT, { email: TECH })
    await addAccount(ctx, TECH, 'technician')
    const all = (
      await gql<{ accounts: { email: string }[] }>(ctx.app, ACCOUNTS, { withDeleted: true })
    ).data!.accounts
    expect(all.filter((account) => account.email === TECH)).toHaveLength(1)
    expect((await gql(ctx.app, ME, {}, TECH)).data).toMatchObject({
      me: { role: { key: 'technician' } },
    })
  })

  it('an administrator from the settings cannot be changed, and nobody removes themselves', async () => {
    const change = await gql(ctx.app, ADD_ACCOUNT, {
      input: { email: ADMIN, roleKey: 'technician' },
    })
    expect(domainCodeOf(change)).toBe('managed_by_config')
    expect(domainCodeOf(await gql(ctx.app, REMOVE_ACCOUNT, { email: ADMIN }))).toBe(
      'managed_by_config',
    )
    await addAccount(ctx, TECH, 'admin')
    expect(domainCodeOf(await gql(ctx.app, REMOVE_ACCOUNT, { email: TECH }, TECH))).toBe(
      'cannot_remove_self',
    )
    expect(
      domainCodeOf(
        await gql(ctx.app, ADD_ACCOUNT, { input: { email: 'iemand@x.be', roleKey: 'koning' } }),
      ),
    ).toBe('role_not_found')
    expect(
      domainCodeOf(
        await gql(ctx.app, ADD_ACCOUNT, { input: { email: 'geen-adres', roleKey: 'admin' } }),
      ),
    ).toBe('invalid_email')
  })
})

describe('the roles of our own staff (a table of rights, not a fixed list)', () => {
  interface SellerRoleRow {
    id: string
    key: string
    locked: boolean
    permissions: string[]
    deletedAt: string | null
    names: Record<string, string | null>
    nl: string
    fr: string
    de: string
  }
  const roles = async (withDeleted = false) =>
    (await gql<{ sellerRoles: SellerRoleRow[] }>(ctx.app, SELLER_ROLES, { withDeleted })).data!
      .sellerRoles
  const create = (input: Record<string, unknown>) =>
    gql<{ createSellerRole: { id: string; key: string } }>(ctx.app, CREATE_SELLER_ROLE, { input })

  it('starts with the locked administrator and the technician, with names in four languages', async () => {
    const list = await roles()
    expect(list.map((role) => [role.key, role.locked])).toEqual([
      ['admin', true],
      ['technician', false],
    ])
    expect(list[1]).toMatchObject({ nl: 'Technicus', fr: 'Technicien', de: 'Techniker' })
  })

  it('lists the standard rights with their group: the rows of the table', async () => {
    const { data } = await gql<{ sellerPermissions: { key: string; group: string }[] }>(
      ctx.app,
      SELLER_PERMISSIONS,
    )
    expect(data?.sellerPermissions).toContainEqual({ key: 'defects:claim', group: 'defects' })
    expect(data?.sellerPermissions).toContainEqual({ key: 'archive:restore', group: 'archive' })
    expect(data?.sellerPermissions).toHaveLength(18)
  })

  it('makes a new role with extra claims, and refuses what is neither a right nor a claim', async () => {
    const made = await create({
      key: 'helpdesk',
      names: { nl: 'Helpdesk' },
      permissions: ['defects:read', 'defects:call', 'exports:invoices', 'defects:read'],
    })
    expect(made.errors).toBeUndefined()
    const row = (await roles()).find((role) => role.key === 'helpdesk')
    expect(row?.permissions).toEqual(['defects:read', 'defects:call', 'exports:invoices'])
    // No translation yet: French falls back to English, then to any other language
    expect(row?.fr).toBe('Helpdesk')

    const bad = await create({
      key: 'slecht',
      names: { nl: 'Slecht' },
      permissions: ['gewoon maar wat'],
    })
    expect(domainCodeOf(bad)).toBe('invalid_claim')
    expect(domainCodeOf(await create({ key: 'zonder-naam', names: {}, permissions: [] }))).toBe(
      'invalid_names',
    )
    expect(
      domainCodeOf(await create({ key: 'helpdesk', names: { nl: 'Nog eens' }, permissions: [] })),
    ).toBe('role_exists')
    expect(codeOf(await create({ key: 'Slecht Woord', names: { nl: 'X' }, permissions: [] }))).toBe(
      'BAD_REQUEST',
    )
  })

  it('an extra claim works for the person who has it: it shows up in `me`', async () => {
    await create({
      key: 'boekhouder',
      names: { nl: 'Boekhouder' },
      permissions: ['companies:read', 'exports:invoices'],
    })
    await addAccount(ctx, TECH, 'boekhouder')
    const me = await gql<{ me: { permissions: string[] } }>(ctx.app, ME, {}, TECH)
    expect(me.data?.me.permissions).toEqual(['companies:read', 'exports:invoices'])
  })

  it('changes names and rights of a role, but never the rights of the administrator', async () => {
    const technician = (await roles()).find((role) => role.key === 'technician')!
    const updated = await gql<{ updateSellerRole: { names: Record<string, string> } }>(
      ctx.app,
      UPDATE_SELLER_ROLE,
      {
        id: technician.id,
        input: { names: { nl: 'Technicus', en: 'Technician', fr: 'Technicien', de: 'Techniker' } },
      },
    )
    expect(updated.errors).toBeUndefined()
    const admin = (await roles()).find((role) => role.key === 'admin')!
    const locked = await gql(ctx.app, UPDATE_SELLER_ROLE, {
      id: admin.id,
      input: { permissions: [] },
    })
    expect(codeOf(locked)).toBe('CONFLICT')
    expect(domainCodeOf(locked)).toBe('role_locked')
  })

  it('archives a role that nobody has (soft delete), and a role in use blocks it', async () => {
    const made = await create({
      key: 'tijdelijk',
      names: { nl: 'Tijdelijk' },
      permissions: ['companies:read'],
    })
    const id = made.data!.createSellerRole.id
    await addAccount(ctx, TECH, 'tijdelijk')

    const blocked = await gql(ctx.app, REMOVE_SELLER_ROLE, { id })
    expect(codeOf(blocked)).toBe('CONFLICT')
    expect(domainCodeOf(blocked)).toBe('role_in_use')

    await addAccount(ctx, TECH, 'technician')
    const archived = await gql<{ removeSellerRole: { deletedAt: string | null } }>(
      ctx.app,
      REMOVE_SELLER_ROLE,
      { id },
    )
    expect(archived.data?.removeSellerRole.deletedAt).toBeTruthy()
    expect((await roles()).map((role) => role.key)).toEqual(['admin', 'technician'])
    expect((await roles(true)).map((role) => role.key)).toContain('tijdelijk')

    // The key stays taken by the archived role, and the role cannot be given to someone
    expect(
      domainCodeOf(await create({ key: 'tijdelijk', names: { nl: 'Weer' }, permissions: [] })),
    ).toBe('role_exists')
    expect(
      domainCodeOf(
        await gql(ctx.app, ADD_ACCOUNT, { input: { email: TECH, roleKey: 'tijdelijk' } }),
      ),
    ).toBe('role_not_found')

    const restored = await gql<{ restoreSellerRole: { deletedAt: string | null } }>(
      ctx.app,
      RESTORE_SELLER_ROLE,
      { id },
    )
    expect(restored.data?.restoreSellerRole.deletedAt).toBeNull()
    expect((await roles()).map((role) => role.key)).toContain('tijdelijk')
    expect(codeOf(await gql(ctx.app, RESTORE_SELLER_ROLE, { id }))).toBe('CONFLICT')
  })

  it('never archives the administrator role', async () => {
    const admin = (await roles()).find((role) => role.key === 'admin')!
    const result = await gql(ctx.app, REMOVE_SELLER_ROLE, { id: admin.id })
    expect(domainCodeOf(result)).toBe('role_locked')
  })
})
