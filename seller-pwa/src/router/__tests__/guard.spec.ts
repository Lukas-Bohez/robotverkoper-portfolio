import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

const authState = {
  user: null as unknown,
  waitForAuthReady: vi.fn(() => Promise.resolve()),
}
const meState = {
  isSeller: false,
  permissions: [] as string[],
  can: (permission: string) => meState.permissions.includes(permission),
  load: vi.fn(() => Promise.resolve()),
}

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('@/stores/me', () => ({ useMeStore: () => meState }))

const { guard, safeRedirect } = await import('../guard')

function route(meta: Record<string, unknown>, fullPath = '/companies'): RouteLocationNormalized {
  return { meta, fullPath } as unknown as RouteLocationNormalized
}

describe('guard', () => {
  beforeEach(() => {
    authState.user = null
    meState.isSeller = false
    meState.permissions = []
    meState.load.mockReset()
    meState.load.mockResolvedValue(undefined)
  })

  it('sends someone who is logged in away from the login page', async () => {
    authState.user = { uid: 'u1' }
    expect(await guard(route({ guest: true }, '/login'))).toEqual({ name: 'companies' })
  })

  it('lets a visitor open the login page', async () => {
    expect(await guard(route({ guest: true }, '/login'))).toBe(true)
  })

  it('asks for a login first, and remembers where you wanted to go', async () => {
    expect(await guard(route({ permission: 'companies:read' }, '/companies/t1'))).toEqual({
      name: 'login',
      query: { redirect: '/companies/t1' },
    })
    expect(meState.load).not.toHaveBeenCalled()
  })

  it('refuses a logged-in user who has no role at the robot seller', async () => {
    authState.user = { uid: 'u1' }
    meState.isSeller = false
    expect(await guard(route({ seller: true }))).toEqual({ name: 'forbidden' })
    expect(await guard(route({ permission: 'companies:read' }))).toEqual({ name: 'forbidden' })
  })

  it('lets someone with a role into a page that needs no special permission', async () => {
    authState.user = { uid: 'u1' }
    meState.isSeller = true
    expect(await guard(route({ seller: true }))).toBe(true)
  })

  it('refuses a role that lacks the permission of the page', async () => {
    authState.user = { uid: 'u1' }
    meState.isSeller = true
    meState.permissions = ['companies:read', 'robots:read']
    expect(await guard(route({ permission: 'accounts:manage' }, '/team'))).toEqual({
      name: 'forbidden',
      query: { reason: 'role' },
    })
  })

  it('lets a role with the permission in', async () => {
    authState.user = { uid: 'u1' }
    meState.isSeller = true
    meState.permissions = ['defects:read']
    expect(await guard(route({ permission: 'defects:read' }, '/defects'))).toBe(true)
  })

  it('refuses when the API cannot tell who you are, and says so', async () => {
    authState.user = { uid: 'u1' }
    meState.load.mockRejectedValue(new Error('offline'))
    expect(await guard(route({ permission: 'companies:read' }))).toEqual({
      name: 'forbidden',
      query: { error: '1' },
    })
  })
})

describe('safeRedirect', () => {
  it.each(['/companies', '/companies/t1?x=1'])('follows the internal path %s', (value) => {
    expect(safeRedirect(value)).toBe(value)
  })

  it.each(['//evil.example', 'https://evil.example', '', undefined, 42])(
    'never follows %s',
    (value) => {
      expect(safeRedirect(value)).toBeNull()
    },
  )
})
