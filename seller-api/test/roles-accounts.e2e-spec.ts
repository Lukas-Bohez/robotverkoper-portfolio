import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ADMIN, TECH, codeOf, createTestApp, domainCodeOf, gql, type TestContext } from './utils/test-app.js'
import {
  ACCOUNTS,
  ADD_ACCOUNT,
  COMPANY_PERMISSIONS,
  COMPANY_ROLES,
  CREATE_COMPANY_ROLE,
  DELETE_COMPANY_ROLE,
  REMOVE_ACCOUNT,
} from './utils/operations.js'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(() => ctx.reset())

describe('roles of a company', () => {
  it('creates and removes a role, but never the locked administrator role', async () => {
    const created = await gql<{ createCompanyRole: { id: string } }>(ctx.app, CREATE_COMPANY_ROLE, {
      companyId: 'c-demo',
      input: { name: 'Kok', permissions: ['orders:read', 'orders:prepare'] },
    })
    expect(created.errors).toBeUndefined()
    const list = (await gql<{ companyRoles: { name: string }[] }>(ctx.app, COMPANY_ROLES, { companyId: 'c-demo' })).data!.companyRoles
    expect(list.map(role => role.name)).toEqual(['TENANT_ADMIN', 'Kok'])

    const locked = await gql(ctx.app, DELETE_COMPANY_ROLE, { companyId: 'c-demo', roleId: 'c-demo-admin' })
    expect(codeOf(locked)).toBe('CONFLICT')
    expect(domainCodeOf(locked)).toBe('role_locked')
    const roleId = created.data!.createCompanyRole.id
    expect((await gql(ctx.app, DELETE_COMPANY_ROLE, { companyId: 'c-demo', roleId })).errors).toBeUndefined()
    expect(codeOf(await gql(ctx.app, DELETE_COMPANY_ROLE, { companyId: 'c-demo', roleId }))).toBe('NOT_FOUND')
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
})

describe('our own staff', () => {
  it('adds, changes and removes an account', async () => {
    const added = await gql<{ addAccount: { email: string } }>(ctx.app, ADD_ACCOUNT, {
      input: { email: ' Technieker@Fabrikant.example ', role: 'TECHNICIAN' },
    })
    expect(added.data?.addAccount.email).toBe(TECH)
    const changed = await gql<{ addAccount: { role: string } }>(ctx.app, ADD_ACCOUNT, {
      input: { email: TECH, role: 'ADMIN' },
    })
    expect(changed.data?.addAccount.role).toBe('ADMIN')
    const list = (await gql<{ accounts: { email: string; role: string }[] }>(ctx.app, ACCOUNTS)).data!.accounts
    expect(list.map(account => [account.email, account.role])).toEqual([
      [ADMIN, 'ADMIN'],
      [TECH, 'ADMIN'],
    ])
    expect((await gql(ctx.app, REMOVE_ACCOUNT, { email: TECH })).errors).toBeUndefined()
    expect(codeOf(await gql(ctx.app, REMOVE_ACCOUNT, { email: TECH }))).toBe('NOT_FOUND')
  })

  it('an administrator from the settings cannot be changed, and nobody removes themselves', async () => {
    const change = await gql(ctx.app, ADD_ACCOUNT, { input: { email: ADMIN, role: 'TECHNICIAN' } })
    expect(domainCodeOf(change)).toBe('managed_by_config')
    expect(domainCodeOf(await gql(ctx.app, REMOVE_ACCOUNT, { email: ADMIN }))).toBe('managed_by_config')
    await gql(ctx.app, ADD_ACCOUNT, { input: { email: TECH, role: 'ADMIN' } })
    expect(domainCodeOf(await gql(ctx.app, REMOVE_ACCOUNT, { email: TECH }, TECH))).toBe('cannot_remove_self')
    expect(codeOf(await gql(ctx.app, ADD_ACCOUNT, { input: { email: 'iemand@x.be', role: 'KONING' } }))).toBeDefined()
    expect(domainCodeOf(await gql(ctx.app, ADD_ACCOUNT, { input: { email: 'geen-adres', role: 'ADMIN' } }))).toBe('invalid_email')
  })
})
