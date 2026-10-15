import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

const authState = {
  user: null as unknown,
  waitForAuthReady: vi.fn(() => Promise.resolve()),
}
const meState = {
  isSeller: false,
  load: vi.fn(() => Promise.resolve()),
}

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('@/stores/me', () => ({ useMeStore: () => meState }))

const { guard, safeRedirect } = await import('../guard')

function route(
  meta: Record<string, boolean>,
  fullPath = '/companies',
): RouteLocationNormalized {
  return { meta, fullPath } as unknown as RouteLocationNormalized
}

describe('guard', () => {
  beforeEach(() => {
    authState.user = null
    meState.isSeller = false
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
    expect(await guard(route({ seller: true }, '/companies/t1'))).toEqual({
      name: 'login',
      query: { redirect: '/companies/t1' },
    })
    expect(meState.load).not.toHaveBeenCalled()
  })

  it('refuses a logged-in user who is not a seller of robots', async () => {
    authState.user = { uid: 'u1' }
    meState.isSeller = false
    expect(await guard(route({ seller: true }))).toEqual({ name: 'forbidden' })
  })

  it('lets a seller of robots in', async () => {
    authState.user = { uid: 'u1' }
    meState.isSeller = true
    expect(await guard(route({ seller: true }))).toBe(true)
  })

  it('refuses when the API cannot tell who you are, and says so', async () => {
    authState.user = { uid: 'u1' }
    meState.load.mockRejectedValue(new Error('offline'))
    expect(await guard(route({ seller: true }))).toEqual({
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
