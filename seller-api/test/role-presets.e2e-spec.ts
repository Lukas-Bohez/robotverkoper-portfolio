import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  codeOf,
  createTestApp,
  domainCodeOf,
  gql,
  TECH,
  type TestContext,
} from './utils/test-app.js'
import {
  APPLY_ROLE_PRESET,
  COMPANY_ROLES,
  CREATE_COMPANY_ROLE,
  CREATE_ROLE_PRESET,
  REMOVE_ROLE_PRESET,
  RESTORE_ROLE_PRESET,
  ROLE_PRESETS,
  SAVE_ROLE_AS_PRESET,
} from './utils/operations.js'
import { addAccount } from './utils/helpers.js'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(() => ctx.reset())

interface PresetRow {
  id: string
  permissions: string[]
  deletedAt: string | null
  names: Record<string, string | null>
  nl: string
  fr: string
  missingLanguages: string[]
}

const presets = async (withDeleted = false) =>
  (await gql<{ rolePresets: PresetRow[] }>(ctx.app, ROLE_PRESETS, { withDeleted })).data!
    .rolePresets

const makePreset = async (names: Record<string, string>, permissions: string[]) => {
  const made = await gql<{ createRolePreset: { id: string } }>(ctx.app, CREATE_ROLE_PRESET, {
    input: { names, permissions },
  })
  if (made.errors) throw new Error(JSON.stringify(made.errors))
  return made.data!.createRolePreset.id
}

describe('role presets: a role made once, given to many companies', () => {
  it('makes a preset and says which languages still need a name', async () => {
    await makePreset({ nl: 'Kok', en: 'Cook' }, ['orders:read', 'orders:prepare'])
    const [preset] = await presets()
    expect(preset).toMatchObject({
      nl: 'Kok',
      fr: 'Cook',
      permissions: ['orders:read', 'orders:prepare'],
    })
    expect(preset?.missingLanguages).toEqual(['fr', 'de'])
  })

  it('refuses a preset without a name, or with a right the platform does not know', async () => {
    const noName = await gql(ctx.app, CREATE_ROLE_PRESET, {
      input: { names: {}, permissions: ['orders:read'] },
    })
    expect(domainCodeOf(noName)).toBe('invalid_names')
    const unknown = await gql(ctx.app, CREATE_ROLE_PRESET, {
      input: { names: { nl: 'X' }, permissions: ['db:drop'] },
    })
    expect(domainCodeOf(unknown)).toBe('unknown_permission')
  })

  it('gives the role of a preset to companies, in every language, and skips a company that has it', async () => {
    const id = await makePreset({ nl: 'Ober', en: 'Waiter', fr: 'Serveur', de: 'Kellner' }, [
      'orders:read',
      'orders:dispatch',
    ])
    await gql(ctx.app, CREATE_COMPANY_ROLE, {
      companyId: 'c-gelato',
      input: { name: 'Ober', permissions: ['orders:read'] },
    })
    const result = await gql<{ applyRolePreset: { copied: number; skipped: string[] } }>(
      ctx.app,
      APPLY_ROLE_PRESET,
      {
        id,
        input: { companyIds: ['c-demo', 'c-gelato'] },
      },
    )
    expect(result.data?.applyRolePreset).toEqual({ copied: 1, skipped: ['Gelato Bar: Ober'] })

    const roles = (
      await gql<{
        companyRoles: { name: string; permissions: string[]; names: Record<string, string> }[]
      }>(ctx.app, COMPANY_ROLES, { companyId: 'c-demo' })
    ).data!.companyRoles
    expect(roles.find((role) => role.name === 'Ober')).toMatchObject({
      permissions: ['orders:read', 'orders:dispatch'],
      names: { nl: 'Ober', en: 'Waiter', fr: 'Serveur', de: 'Kellner' },
    })
  })

  it('saves a role of a company as a preset', async () => {
    const created = await gql<{ createCompanyRole: { id: string } }>(ctx.app, CREATE_COMPANY_ROLE, {
      companyId: 'c-demo',
      input: {
        name: 'Lader',
        permissions: ['robots:read', 'robots:load'],
        names: { en: 'Loader' },
      },
    })
    const saved = await gql<{
      saveRoleAsPreset: { permissions: string[]; names: Record<string, string> }
    }>(ctx.app, SAVE_ROLE_AS_PRESET, {
      companyId: 'c-demo',
      roleId: created.data!.createCompanyRole.id,
    })
    expect(saved.data?.saveRoleAsPreset).toMatchObject({
      permissions: ['robots:read', 'robots:load'],
      names: { nl: 'Lader', en: 'Loader' },
    })
    expect(await presets()).toHaveLength(1)
  })

  it('archiving a preset is a soft delete that can be undone', async () => {
    const id = await makePreset({ nl: 'Kok' }, ['orders:read'])
    const archived = await gql<{ removeRolePreset: { deletedAt: string | null } }>(
      ctx.app,
      REMOVE_ROLE_PRESET,
      { id },
    )
    expect(archived.data?.removeRolePreset.deletedAt).toBeTruthy()
    expect(await presets()).toHaveLength(0)
    expect(await presets(true)).toHaveLength(1)
    expect(
      codeOf(await gql(ctx.app, APPLY_ROLE_PRESET, { id, input: { companyIds: ['c-demo'] } })),
    ).toBe('NOT_FOUND')

    await gql(ctx.app, RESTORE_ROLE_PRESET, { id })
    expect(await presets()).toHaveLength(1)
    expect(codeOf(await gql(ctx.app, RESTORE_ROLE_PRESET, { id }))).toBe('CONFLICT')
  })

  it('is for administrators: a technician has no say over roles of companies', async () => {
    await addAccount(ctx, TECH, 'technician')
    expect(codeOf(await gql(ctx.app, ROLE_PRESETS, {}, TECH))).toBe('FORBIDDEN')
  })
})
