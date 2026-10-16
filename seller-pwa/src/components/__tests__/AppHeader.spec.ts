import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { piniaWith, routerAt, TECHNICIAN_PERMISSIONS } from '@/test/helpers'

// The session is faked: Firebase is not part of what the header decides
const session = vi.hoisted(() => ({ user: null as { uid: string; email: string | null } | null }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get user() {
      return session.user
    },
    get email() {
      return session.user?.email ?? ''
    },
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}))

const { i18n } = await import('@/i18n')
const { default: AppHeader } = await import('../AppHeader.vue')

async function mountHeader() {
  const router = await routerAt('/')
  return mount(AppHeader, { global: { plugins: [i18n, piniaWith('admin'), router] } })
}

describe('AppHeader', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    session.user = null
  })

  // The Figma design of "Inloggen" has no menu, no e-mail badge and no "Uitloggen":
  // someone who is not logged in must not see them.
  it('shows no menu, e-mail or logout to someone who is not logged in', async () => {
    const wrapper = await mountHeader()
    expect(wrapper.findAll('[data-testid="nav-link"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="menu-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="user-email"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="logout"]').exists()).toBe(false)
  })

  it('still shows the brand and the language buttons before logging in', async () => {
    const wrapper = await mountHeader()
    expect(wrapper.find('[data-testid="brand"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="language-nl"]').exists()).toBe(true)
  })

  it('shows the menu, the e-mail address and logout once logged in', async () => {
    session.user = { uid: 'u1', email: 'docent@howest.be' }
    const wrapper = await mountHeader()
    expect(wrapper.findAll('[data-testid="nav-link"]').map((link) => link.text())).toEqual([
      'Bedrijven',
      'Robotdefecten',
      'Team',
    ])
    expect(wrapper.find('[data-testid="menu-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-email"]').text()).toBe('docent@howest.be')
    expect(wrapper.find('[data-testid="logout"]').exists()).toBe(true)
  })

  it('hides the Team link from a technician, who may not manage accounts', async () => {
    session.user = { uid: 'u2', email: 'technieker@fabrikant.example' }
    const router = await routerAt('/')
    const wrapper = mount(AppHeader, {
      global: { plugins: [i18n, piniaWith('technician', TECHNICIAN_PERMISSIONS), router] },
    })
    expect(wrapper.findAll('[data-testid="nav-link"]').map((link) => link.text())).toEqual([
      'Bedrijven',
      'Robotdefecten',
    ])
  })
})
