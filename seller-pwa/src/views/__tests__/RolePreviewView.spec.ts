import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { piniaWith, routerAt } from '@/test/helpers'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks, apiErrorMessage: (_e: unknown, fallback: string) => fallback }))

const { i18n } = await import('@/i18n')
const { default: RolePreviewView } = await import('../RolePreviewView.vue')

const company = { id: 'c1', name: 'Demozaak', subdomain: 'demo', createdAt: '', robotCount: 0, openDefects: 0 }
const roles = [
  { id: 'r-admin', name: 'TENANT_ADMIN', permissions: ['orders:read', 'orders:prepare', 'menu:manage', 'tenant:manage'], locked: true },
  { id: 'r-kok', name: 'Kok', permissions: ['orders:read', 'orders:prepare'], locked: false },
  { id: 'r-leeg', name: 'Gast', permissions: [], locked: false },
]

async function mountView(path = '/companies/c1/preview?role=r-kok') {
  const router = await routerAt(path)
  return mount(RolePreviewView, { global: { plugins: [i18n, piniaWith(), router] } })
}

describe('RolePreviewView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    mocks.get.mockReset()
    mocks.get.mockImplementation((path: string) => {
      if (path === '/companies/c1') return Promise.resolve(company)
      if (path === '/companies/c1/roles') return Promise.resolve({ items: roles })
      return Promise.reject(new Error(`unexpected ${path}`))
    })
  })

  it('says you only look and cannot change anything, and shows what the role sees', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="preview-banner"]').text()).toContain('Je bekijkt Demozaak als de rol Kok. Je kunt niets wijzigen.')
    expect(wrapper.findAll('[data-testid="preview-section"]').map((s) => s.text())).toEqual(['Bestellingen', 'Bereiding'])
    expect(wrapper.find('[data-testid="preview-landing"]').text()).toBe('Bestellingen')
    expect(wrapper.text()).toContain('verzonnen gegevens')
  })

  it('switches to another role', async () => {
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="preview-role"]').setValue('r-admin')
    expect(wrapper.find('[data-testid="preview-banner"]').text()).toContain('als de rol Beheerder')
    expect(wrapper.findAll('[data-testid="preview-section"]').map((s) => s.text())).toEqual([
      'Bestellingen',
      'Bereiding',
      'Menu',
      'Bedrijfsinstellingen',
    ])
  })

  it('says a role without permissions sees nothing', async () => {
    const wrapper = await mountView('/companies/c1/preview?role=r-leeg')
    await flushPromises()
    expect(wrapper.find('[data-testid="preview-none"]').exists()).toBe(true)
  })

  it('starts with the first role when the role in the address does not exist', async () => {
    const wrapper = await mountView('/companies/c1/preview?role=bestaat-niet')
    await flushPromises()
    expect(wrapper.find('[data-testid="preview-banner"]').text()).toContain('als de rol Beheerder')
  })

  it('goes back to the roles when you stop viewing', async () => {
    const wrapper = await mountView()
    await flushPromises()
    const router = wrapper.vm.$router
    await wrapper.find('[data-testid="preview-stop"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('company-roles')
  })

  it('shows an error when the roles cannot be loaded', async () => {
    mocks.get.mockRejectedValue(new Error('offline'))
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="preview-error"]').exists()).toBe(true)
  })
})
