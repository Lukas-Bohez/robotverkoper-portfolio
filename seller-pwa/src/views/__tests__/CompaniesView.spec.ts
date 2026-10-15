import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn() }))
vi.mock('@/lib/graphql', () => ({
  graphql: { query: mocks.query, mutate: mocks.mutate },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}))

const { i18n } = await import('@/i18n')
const { default: CompaniesView } = await import('../CompaniesView.vue')

// Nuxt UI components are imported by the build plugin, so tests render the real ones;
// only the router link needs a stand-in (there is no router in these tests)
const stubs = {
  RouterLink: { props: ['to'], template: '<a v-bind="$attrs"><slot /></a>' },
}

const company = {
  id: 't1',
  name: 'Demozaak',
  subdomain: 'demo',
  createdAt: '2026-09-23T10:00:00.000Z',
}

function mountView() {
  return mount(CompaniesView, { global: { plugins: [i18n], stubs } })
}

describe('CompaniesView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    mocks.query.mockReset()
    mocks.mutate.mockReset()
    mocks.query.mockResolvedValue({ tenants: [company] })
    mocks.mutate.mockResolvedValue({ createTenant: company })
  })

  it('lists the companies, without any staff or email address', async () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="companies-loading"]').exists()).toBe(true)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="company-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Demozaak')
    expect(rows[0]!.text()).toContain('demo')
    expect(wrapper.find('[data-testid="companies-table"]').text()).not.toContain('@')
  })

  it('says so when there are no companies', async () => {
    mocks.query.mockResolvedValue({ tenants: [] })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="companies-empty"]').exists()).toBe(true)
  })

  it('shows an error when the companies cannot be loaded', async () => {
    mocks.query.mockRejectedValue(new Error('offline'))
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="companies-error"]').text()).toContain('niet geladen')
  })

  it('suggests the address from the name, until you type your own', async () => {
    const wrapper = mountView()
    await flushPromises()
    const subdomain = () =>
      (wrapper.find('[data-testid="company-subdomain"]').element as HTMLInputElement).value

    await wrapper.find('[data-testid="company-name"]').setValue('Pizzeria Test')
    expect(subdomain()).toBe('pizzeria-test')

    await wrapper.find('[data-testid="company-subdomain"]').setValue('mijn-adres')
    await wrapper.find('[data-testid="company-name"]').setValue('Iets anders')
    expect(subdomain()).toBe('mijn-adres')
  })

  it('does not submit an invalid address', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="company-name"]').setValue('Pizzeria Test')
    await wrapper.find('[data-testid="company-admin-email"]').setValue('chef@pizzeria.test')
    await wrapper.find('[data-testid="company-subdomain"]').setValue('Geen Geldig Adres')

    expect(wrapper.text()).toContain('Gebruik 2 tot 30 letters')
    expect(
      (wrapper.find('[data-testid="company-submit"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
    await wrapper.find('form').trigger('submit')
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it('creates a company, tells it, and reloads the list', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="company-name"]').setValue('Pizzeria Test')
    await wrapper.find('[data-testid="company-admin-email"]').setValue('  chef@pizzeria.test ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mocks.mutate).toHaveBeenCalledTimes(1)
    expect(mocks.mutate.mock.calls[0]![1]).toEqual({
      input: { name: 'Pizzeria Test', subdomain: 'pizzeria-test', adminEmail: 'chef@pizzeria.test' },
    })
    expect(wrapper.find('[data-testid="company-created"]').text()).toContain('Pizzeria Test')
    expect(mocks.query).toHaveBeenCalledTimes(2) // loaded again
    expect((wrapper.find('[data-testid="company-name"]').element as HTMLInputElement).value).toBe('')
  })

  it('shows an error and keeps the form when the company cannot be created', async () => {
    mocks.mutate.mockRejectedValue(new Error('taken'))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="company-name"]').setValue('Pizzeria Test')
    await wrapper.find('[data-testid="company-admin-email"]').setValue('chef@pizzeria.test')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="company-form-error"]').exists()).toBe(true)
    expect(
      (wrapper.find('[data-testid="company-name"]').element as HTMLInputElement).value,
    ).toBe('Pizzeria Test')
  })
})
