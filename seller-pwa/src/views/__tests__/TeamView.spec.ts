import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { piniaWith, routerAt } from '@/test/helpers'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks, apiErrorMessage: (_e: unknown, fallback: string) => fallback }))

const { i18n } = await import('@/i18n')
const { default: TeamView } = await import('../TeamView.vue')

const accounts = [
  { email: 'docent@howest.be', role: 'admin', createdBy: null, createdAt: null },
  { email: 'technieker@fabrikant.example', role: 'technician', createdBy: 'docent@howest.be', createdAt: '2026-10-15T10:00:00Z' },
]
const audit = [
  { id: 2, at: new Date(Date.now() - 3600_000).toISOString(), actor: 'docent@howest.be', action: 'robot.created', target: 'r1', detail: 'Demo Food Bot' },
  { id: 1, at: new Date(Date.now() - 7200_000).toISOString(), actor: 'docent@howest.be', action: 'iets.nieuws', target: null, detail: null },
]

async function mountView() {
  const router = await routerAt('/team')
  return mount(TeamView, { global: { plugins: [i18n, piniaWith(), router] } })
}

describe('TeamView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.delete.mockReset()
    mocks.get.mockImplementation((path: string) => {
      if (path === '/accounts') return Promise.resolve({ items: accounts })
      if (path.startsWith('/audit')) return Promise.resolve({ items: audit })
      return Promise.reject(new Error(`unexpected ${path}`))
    })
    mocks.post.mockResolvedValue({})
    mocks.delete.mockResolvedValue(undefined)
  })

  it('lists the accounts and the log, with a translated action and a fallback for new ones', async () => {
    const wrapper = await mountView()
    await flushPromises()
    const rows = wrapper.findAll('[data-testid="account-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('instellingen van de server')
    expect(rows[1]!.text()).toContain('Technicus')
    const log = wrapper.findAll('[data-testid="audit-row"]')
    expect(log[0]!.text()).toContain('Robot toegekend')
    expect(log[0]!.text()).toContain('Demo Food Bot')
    expect(log[1]!.text()).toContain('iets.nieuws')
  })

  it('cannot remove the accounts of the server settings, and not your own', async () => {
    const wrapper = await mountView()
    await flushPromises()
    const rows = wrapper.findAll('[data-testid="account-row"]')
    expect(rows[0]!.find('[data-testid="account-remove"]').exists()).toBe(false)
    expect(rows[1]!.find('[data-testid="account-remove"]').exists()).toBe(true)
  })

  it('adds an account with a role', async () => {
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="account-email"]').setValue(' nieuw@fabrikant.example ')
    await wrapper.find('[data-testid="account-role"]').setValue('admin')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/accounts', { email: 'nieuw@fabrikant.example', role: 'admin' })
    expect(wrapper.find('[data-testid="team-message"]').text()).toContain('nieuw@fabrikant.example')
  })

  it('shows what the role allows while you choose it', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Alleen robots, defecten en technische gegevens.')
    await wrapper.find('[data-testid="account-role"]').setValue('admin')
    expect(wrapper.text()).toContain('Alles: bedrijven')
  })

  it('removes an account', async () => {
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="account-remove"]').trigger('click')
    await flushPromises()
    expect(mocks.delete).toHaveBeenCalledWith('/accounts/technieker%40fabrikant.example')
    expect(wrapper.find('[data-testid="team-message"]').text()).toContain('verwijderd')
  })

  it('says what went wrong when saving fails', async () => {
    mocks.post.mockRejectedValue(new Error('boem'))
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="account-email"]').setValue('x@y.example')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-testid="team-error"]').exists()).toBe(true)
  })

  it('shows an error when the team cannot be loaded', async () => {
    mocks.get.mockRejectedValue(new Error('offline'))
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="team-load-error"]').exists()).toBe(true)
  })
})
