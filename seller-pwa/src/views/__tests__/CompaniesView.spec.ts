import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { piniaWith, routerAt, TECHNICIAN_PERMISSIONS } from '@/test/helpers'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks, apiErrorMessage: (_e: unknown, fallback: string) => fallback }))

const { i18n } = await import('@/i18n')
const { default: CompaniesView } = await import('../CompaniesView.vue')

const demo = { id: 't1', name: 'Demozaak', subdomain: 'demo', createdAt: '2026-09-23T10:00:00.000Z', robotCount: 3, openDefects: 1 }
const gelato = { id: 't2', name: 'Gelato Bar', subdomain: 'gelato', createdAt: '2026-10-10T10:00:00.000Z', robotCount: 2, openDefects: 0 }

async function mountView(pinia = piniaWith()) {
  const router = await routerAt('/companies')
  return mount(CompaniesView, { global: { plugins: [i18n, pinia, router] } })
}

describe('CompaniesView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    mocks.get.mockReset()
    mocks.get.mockResolvedValue({ items: [demo, gelato], source: 'platform' })
  })

  it('lists the companies with their robots and defects, without any staff or email address', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="companies-loading"]').exists()).toBe(true)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="company-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Demozaak')
    expect(rows[0]!.find('[data-testid="company-robot-count"]').text()).toBe('3')
    expect(rows[0]!.find('[data-testid="company-defects"]').text()).toBe('1 defect')
    expect(rows[1]!.find('[data-testid="company-defects"]').text()).toBe('Geen')
    expect(wrapper.find('[data-testid="companies-table"]').text()).not.toContain('@')
    expect(wrapper.find('[data-testid="companies-info"]').text()).toContain('geen personeel')
    expect(mocks.get).toHaveBeenCalledWith('/companies')
  })

  it('has a card for every company too (the phone layout)', async () => {
    const wrapper = await mountView()
    await flushPromises()
    const cards = wrapper.findAll('[data-testid="company-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.text()).toContain('3 robots')
  })

  it('links every company to its robots', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="company-robots-link"]').attributes('href')).toBe('/companies/t1')
  })

  it('links every company to its roles, in the table and on the phone card', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="company-roles-link"]').attributes('href')).toBe('/companies/t1/roles')
    expect(wrapper.find('[data-testid="company-roles-link"]').text()).toBe('Rollen openen')
    expect(wrapper.findAll('[data-testid="company-card-roles-link"]').map((link) => link.attributes('href'))).toEqual([
      '/companies/t1/roles',
      '/companies/t2/roles',
    ])
  })

  it('does not offer the roles to a role that may not manage them', async () => {
    const wrapper = await mountView(piniaWith('technician', TECHNICIAN_PERMISSIONS))
    await flushPromises()
    expect(wrapper.find('[data-testid="company-robots-link"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="company-roles-link"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="company-card-roles-link"]').exists()).toBe(false)
  })

  it('offers "new company" only to a role that may create companies', async () => {
    let wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="new-company"]').exists()).toBe(true)
    wrapper = await mountView(piniaWith('technician', TECHNICIAN_PERMISSIONS))
    await flushPromises()
    expect(wrapper.find('[data-testid="new-company"]').exists()).toBe(false)
  })

  it('warns when it shows the last known list because the platform does not answer', async () => {
    mocks.get.mockResolvedValue({ items: [demo], source: 'cache' })
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="companies-cache"]').text()).toContain('laatst bekende')
  })

  it('says so when there are no companies', async () => {
    mocks.get.mockResolvedValue({ items: [] })
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="companies-empty"]').exists()).toBe(true)
  })

  it('shows an error when the companies cannot be loaded', async () => {
    mocks.get.mockRejectedValue(new Error('offline'))
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="companies-error"]').text()).toContain('niet geladen')
  })
})
