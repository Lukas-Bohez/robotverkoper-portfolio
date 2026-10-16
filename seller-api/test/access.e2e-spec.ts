import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SELLER_PERMISSIONS } from '../src/authentication/permissions.js'
import {
  ADMIN,
  OWNER,
  TECH,
  codeOf,
  createTestApp,
  gql,
  type TestContext,
} from './utils/test-app.js'
import {
  ACCOUNTS,
  AUDIT,
  COMPANIES,
  CREATE_COMPANY,
  ME,
  REMOVE_ACCOUNT,
  RESTORE_ACCOUNT,
  SELLER_ROLES,
  UPDATE_SELLER_ROLE,
} from './utils/operations.js'
import { addAccount } from './utils/helpers.js'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp([ADMIN, OWNER])
})
afterAll(() => ctx.close())
beforeEach(() => ctx.reset())

describe('who may do what', () => {
  it('health is public, everything else needs a login', async () => {
    const health = await gql<{ health: { status: string; database: string } }>(
      ctx.app,
      '{ health { status database } }',
      {},
      null,
    )
    expect(health.data?.health).toEqual({ status: 'ok', database: 'up' })
    expect(codeOf(await gql(ctx.app, COMPANIES, {}, null))).toBe('UNAUTHENTICATED')
    expect(codeOf(await gql(ctx.app, ME, {}, null))).toBe('UNAUTHENTICATED')

    const http = await request(ctx.app.getHttpServer()).get('/health')
    expect(http.status).toBe(200)
    expect(http.body).toMatchObject({ status: 'ok', service: 'seller-api', database: 'up' })
  })

  it('refuses a token that is not a login', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post('/graphql')
      .set('Authorization', 'Bearer nonsense')
      .send({ query: COMPANIES })
    expect(codeOf(response.body)).toBe('UNAUTHENTICATED')
  })

  it('someone who is not on our staff is told there is no access', async () => {
    const me = await gql<{ me: { role: unknown; permissions: string[] } }>(ctx.app, ME, {}, 'vreemde@example.com')
    expect(me.data?.me).toEqual({ email: 'vreemde@example.com', role: null, permissions: [] })
    expect(codeOf(await gql(ctx.app, COMPANIES, {}, 'vreemde@example.com'))).toBe('FORBIDDEN')
  })

  it.each([ADMIN, OWNER])('%s is a superadmin: every permission, without needing an account first', async email => {
    const me = await gql<{ me: { role: { key: string; name: string }; permissions: string[] } }>(ctx.app, ME, {}, email)
    expect(me.data?.me.role).toEqual({ key: 'admin', name: 'Beheerder' })
    expect(me.data?.me.permissions).toHaveLength(SELLER_PERMISSIONS.length)
    for (const query of [COMPANIES, ACCOUNTS, AUDIT]) {
      expect((await gql(ctx.app, query, {}, email)).errors).toBeUndefined()
    }
    const created = await gql(
      ctx.app,
      CREATE_COMPANY,
      { input: { name: 'Nieuwe Zaak', subdomain: `zaak-${email.length}`, adminEmail: 'baas@nieuwe-zaak.be' } },
      email,
    )
    expect(created.errors).toBeUndefined()
  })

  it('matches an address in any letter case', async () => {
    const me = await gql<{ me: { role: { key: string } } }>(ctx.app, ME, {}, 'LukasBohez@Gmail.com')
    expect(me.data?.me.role.key).toBe('admin')
  })

  it('a technician sees robots and defects but cannot create companies, set up roles or manage staff', async () => {
    await addAccount(ctx, TECH, 'technician')
    expect((await gql(ctx.app, COMPANIES, {}, TECH)).errors).toBeUndefined()
    expect((await gql(ctx.app, '{ defects { id } }', {}, TECH)).errors).toBeUndefined()
    const create = await gql(
      ctx.app,
      CREATE_COMPANY,
      { input: { name: 'X Zaak', subdomain: 'xx', adminEmail: 'a@b.be' } },
      TECH,
    )
    expect(codeOf(create)).toBe('FORBIDDEN')
    expect(codeOf(await gql(ctx.app, '{ companyRoles(companyId: "c-demo") { id } }', {}, TECH))).toBe('FORBIDDEN')
    expect(codeOf(await gql(ctx.app, ACCOUNTS, {}, TECH))).toBe('FORBIDDEN')
    expect(codeOf(await gql(ctx.app, AUDIT, {}, TECH))).toBe('FORBIDDEN')
    expect(codeOf(await gql(ctx.app, SELLER_ROLES, {}, TECH))).toBe('FORBIDDEN')
    const robot = await gql(
      ctx.app,
      'mutation ($input: CreateRobotInput!) { createRobot(companyId: "c-demo", input: $input) { robot { id } } }',
      { input: { name: 'Robot T', modelId: 'model-parcel' } },
      TECH,
    )
    expect(robot.errors).toBeUndefined()
  })

  it('what a role may do is data: the administrator changes it and the change counts at once', async () => {
    await addAccount(ctx, TECH, 'technician')
    expect(codeOf(await gql(ctx.app, AUDIT, {}, TECH))).toBe('FORBIDDEN')

    const roles = (await gql<{ sellerRoles: { id: string; key: string; permissions: string[] }[] }>(ctx.app, SELLER_ROLES)).data!.sellerRoles
    const technician = roles.find(role => role.key === 'technician')!
    const updated = await gql(ctx.app, UPDATE_SELLER_ROLE, {
      id: technician.id,
      input: { permissions: [...technician.permissions, 'audit:read'] },
    })
    expect(updated.errors).toBeUndefined()
    expect((await gql(ctx.app, AUDIT, {}, TECH)).errors).toBeUndefined()

    const me = await gql<{ me: { permissions: string[] } }>(ctx.app, ME, {}, TECH)
    expect(me.data?.me.permissions).toContain('audit:read')
  })

  it('an account that was archived can no longer log in, and can again after it was restored', async () => {
    await addAccount(ctx, TECH, 'technician')
    expect((await gql(ctx.app, COMPANIES, {}, TECH)).errors).toBeUndefined()

    expect((await gql(ctx.app, REMOVE_ACCOUNT, { email: TECH })).errors).toBeUndefined()
    expect(codeOf(await gql(ctx.app, COMPANIES, {}, TECH))).toBe('FORBIDDEN')

    expect((await gql(ctx.app, RESTORE_ACCOUNT, { email: TECH })).errors).toBeUndefined()
    expect((await gql(ctx.app, COMPANIES, {}, TECH)).errors).toBeUndefined()
  })
})

// ───────────── the auth matrix: every operation of the schema, called without a login and without a role

interface IntrospectedType {
  kind: string
  name: string | null
  ofType: IntrospectedType | null
}
interface Arg {
  name: string
  type: IntrospectedType
}
interface Field {
  name: string
  args: Arg[]
  type: IntrospectedType
}

const TYPE_REF = 'kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } }'
const INTROSPECTION = `{ __schema {
  queryType { fields { name args { name type { ${TYPE_REF} } } type { ${TYPE_REF} } } }
  mutationType { fields { name args { name type { ${TYPE_REF} } } type { ${TYPE_REF} } } }
  types { kind name inputFields { name type { ${TYPE_REF} } } enumValues { name } }
} }`

/** Operations that are open on purpose: the health check, the simulator (a device), and `me` for any login */
const PUBLIC = new Set(['health', 'createPairing', 'collectPairing', 'cancelPairing'])
const ANY_LOGIN = new Set(['me'])

describe('the auth matrix', () => {
  type Schema = {
    queryType: { fields: Field[] }
    mutationType: { fields: Field[] }
    types: { kind: string; name: string; inputFields: Arg[] | null; enumValues: { name: string }[] | null }[]
  }
  let schema: Schema

  beforeAll(async () => {
    schema = (await gql<{ __schema: Schema }>(ctx.app, INTROSPECTION)).data!.__schema
  })

  const unwrap = (type: IntrospectedType): IntrospectedType =>
    type.kind === 'NON_NULL' || type.kind === 'LIST' ? unwrap(type.ofType!) : type

  const valueFor = (type: IntrospectedType): unknown => {
    if (type.kind === 'NON_NULL') return valueFor(type.ofType!)
    if (type.kind === 'LIST') return [valueFor(type.ofType!)]
    if (type.kind === 'ENUM') return schema.types.find(t => t.name === type.name)?.enumValues?.[0]?.name
    if (type.kind === 'INPUT_OBJECT') {
      const input = schema.types.find(t => t.name === type.name)
      return Object.fromEntries((input?.inputFields ?? []).map(field => [field.name, valueFor(field.type)]))
    }
    if (type.name === 'Boolean') return true
    if (type.name === 'Int') return 1
    if (type.name === 'Float') return 1.5
    return 'x@example.com'
  }

  /** `query { name(arg: $arg) { __typename } }` with a made-up value for every argument */
  const operation = (kind: 'query' | 'mutation', field: Field) => {
    const variables = Object.fromEntries(field.args.map(arg => [arg.name, valueFor(arg.type)]))
    const declared = field.args.map(arg => `$${arg.name}: ${typeName(arg.type)}`).join(', ')
    const used = field.args.map(arg => `${arg.name}: $${arg.name}`).join(', ')
    const leaf = unwrap(field.type)
    const selection = ['OBJECT', 'INTERFACE'].includes(leaf.kind) ? ' { __typename }' : ''
    return {
      query: `${kind} ${declared ? `(${declared})` : ''} { ${field.name}${used ? `(${used})` : ''}${selection} }`,
      variables,
    }
  }
  const typeName = (type: IntrospectedType): string =>
    type.kind === 'NON_NULL'
      ? `${typeName(type.ofType!)}!`
      : type.kind === 'LIST'
        ? `[${typeName(type.ofType!)}]`
        : type.name!

  const operations = (): { kind: 'query' | 'mutation'; field: Field }[] => [
    ...schema.queryType.fields.map(field => ({ kind: 'query' as const, field })),
    ...schema.mutationType.fields.map(field => ({ kind: 'mutation' as const, field })),
  ]

  it('finds the operations of the schema', () => {
    expect(operations().length).toBeGreaterThan(60)
  })

  it('every operation but the open ones answers UNAUTHENTICATED without a login', async () => {
    for (const { kind, field } of operations()) {
      if (PUBLIC.has(field.name)) continue
      const { query, variables } = operation(kind, field)
      const response = await gql(ctx.app, query, variables, null)
      expect(codeOf(response), `${kind} ${field.name}`).toBe('UNAUTHENTICATED')
    }
  })

  it('every operation but the open ones answers FORBIDDEN to a login without a role', async () => {
    for (const { kind, field } of operations()) {
      if (PUBLIC.has(field.name) || ANY_LOGIN.has(field.name)) continue
      const { query, variables } = operation(kind, field)
      const response = await gql(ctx.app, query, variables, 'vreemde@example.com')
      expect(codeOf(response), `${kind} ${field.name}`).toBe('FORBIDDEN')
    }
  })

  it('the open operations stay open: nobody is turned away at the door', async () => {
    for (const { kind, field } of operations()) {
      if (!PUBLIC.has(field.name)) continue
      const { query, variables } = operation(kind, field)
      const response = await gql(ctx.app, query, variables, null)
      expect(['UNAUTHENTICATED', 'FORBIDDEN'], `${kind} ${field.name}`).not.toContain(codeOf(response))
    }
  })
})
