import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { DocumentNode } from 'graphql'

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn() }))
vi.mock('@/lib/graphql', () => ({
  graphql: { query: mocks.query, mutate: mocks.mutate },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ params: { id: 't1' } }),
}))

const { i18n } = await import('@/i18n')
const { default: CompanyRobotsView } = await import('../CompanyRobotsView.vue')

// Nuxt UI components are imported by the build plugin, so tests render the real ones;
// only the router link needs a stand-in (there is no router in these tests)
const stubs = {
  RouterLink: { props: ['to'], template: '<a v-bind="$attrs"><slot /></a>' },
}

const company = { id: 't1', name: 'Demozaak', subdomain: 'demo', createdAt: null }
const models = [
  { id: 'm1', name: 'Compact food robot', kind: 'FOOD' },
  { id: 'm2', name: 'Small parcel robot', kind: 'PARCEL' },
]
const robot = {
  id: 'r1',
  name: 'Demo Food Bot',
  apiKeyPrefix: 'demo-rob',
  online: true,
  battery: 87.4,
  model: { name: 'Compact food robot', kind: 'FOOD' },
}

let robots: unknown[] = []
let tenants: unknown[] = [company]

function operation(doc: DocumentNode): string | undefined {
  const definition = doc.definitions[0] as { name?: { value: string } }
  return definition.name?.value
}

function mountView() {
  return mount(CompanyRobotsView, { global: { plugins: [i18n], stubs } })
}

describe('CompanyRobotsView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    robots = []
    tenants = [company]
    mocks.query.mockReset()
    mocks.mutate.mockReset()
    mocks.query.mockImplementation((doc: DocumentNode) => {
      switch (operation(doc)) {
        case 'SellerCompanies':
          return Promise.resolve({ tenants })
        case 'SellerRobotModels':
          return Promise.resolve({ robotModels: models })
        case 'SellerCompanyRobots':
          return Promise.resolve({ robots })
        default:
          return Promise.reject(new Error('unexpected query'))
      }
    })
    mocks.mutate.mockResolvedValue({
      createRobot: { apiKey: 'robot-key-abc123', robot: { id: 'r2', name: 'Food Robot 2' } },
    })
  })

  it('shows the company and says when it has no robots', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="robots-title"]').text()).toBe('Robots van Demozaak')
    expect(wrapper.find('[data-testid="robots-empty"]').exists()).toBe(true)
    expect(mocks.query.mock.calls.some(([, variables]) => variables?.tenantId === 't1')).toBe(true)
  })

  it('lists the robots with their key prefix, never the key', async () => {
    robots = [robot]
    const wrapper = mountView()
    await flushPromises()
    const row = wrapper.find('[data-testid="robot-row"]')
    expect(row.text()).toContain('Demo Food Bot')
    expect(row.text()).toContain('begint met demo-rob')
    expect(row.text()).toContain('Online')
    expect(row.text()).toContain('87%')
  })

  it('says so when the company does not exist', async () => {
    tenants = []
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="robots-not-found"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="robot-submit"]').exists()).toBe(false)
  })

  it('gives a food robot with a temperature, and shows its key once', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="robot-name"]').setValue('Food Robot 2')
    await wrapper.find('[data-testid="robot-model"]').setValue('m1')
    expect(wrapper.find('[data-testid="robot-temperature"]').exists()).toBe(true)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mocks.mutate.mock.calls[0]![1]).toEqual({
      input: { tenantId: 't1', modelId: 'm1', name: 'Food Robot 2', temperatureType: 'WARM' },
    })
    expect(wrapper.find('[data-testid="api-key-value"]').text()).toBe('robot-key-abc123')

    await wrapper.find('[data-testid="api-key-done"]').trigger('click')
    expect(wrapper.find('[data-testid="api-key-dialog"]').exists()).toBe(false)
  })

  it('gives a parcel robot without a temperature', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="robot-name"]').setValue('Parcel Robot 1')
    await wrapper.find('[data-testid="robot-model"]').setValue('m2')
    expect(wrapper.find('[data-testid="robot-temperature"]').exists()).toBe(false)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mocks.mutate.mock.calls[0]![1]).toEqual({
      input: { tenantId: 't1', modelId: 'm2', name: 'Parcel Robot 1' },
    })
  })

  it('does not create a robot without a model', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="robot-name"]').setValue('Robot zonder model')
    expect(
      (wrapper.find('[data-testid="robot-submit"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
    await wrapper.find('form').trigger('submit')
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it('shows an error and no key when the robot cannot be created', async () => {
    mocks.mutate.mockRejectedValue(new Error('duplicate name'))
    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('[data-testid="robot-name"]').setValue('Food Robot 2')
    await wrapper.find('[data-testid="robot-model"]').setValue('m2')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="robot-form-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="api-key-dialog"]').exists()).toBe(false)
  })
})
