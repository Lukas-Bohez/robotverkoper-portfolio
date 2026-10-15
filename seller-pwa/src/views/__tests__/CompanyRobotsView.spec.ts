import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { piniaWith, routerAt, TECHNICIAN_PERMISSIONS } from '@/test/helpers'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks, apiErrorMessage: (_e: unknown, fallback: string) => fallback }))

const { i18n } = await import('@/i18n')
const { default: CompanyRobotsView } = await import('../CompanyRobotsView.vue')

const company = { id: 't1', name: 'Demozaak', subdomain: 'demo', createdAt: null, robotCount: 1, openDefects: 0 }
const models = [
  { id: 'model-food', name: 'Delivery Bot Eten', kind: 'FOOD', description: '' },
  { id: 'model-parcel', name: 'Delivery Bot Pakket', kind: 'PARCEL', description: '' },
]
const robot = {
  id: 'r1',
  companyId: 't1',
  name: 'Demo Food Bot',
  model: { id: 'model-food', name: 'Delivery Bot Eten', kind: 'FOOD' },
  apiKeyPrefix: 'rb_demo1234',
  online: true,
  battery: 87.4,
  status: 'online',
  openDefectId: null,
  lastSeenAt: null,
}

let robots: unknown[] = []
let source = 'platform'
let companyAnswer: () => Promise<unknown>

async function mountView(pinia = piniaWith()) {
  const router = await routerAt('/companies/t1')
  return mount(CompanyRobotsView, { global: { plugins: [i18n, pinia, router] } })
}

describe('CompanyRobotsView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    robots = []
    source = 'platform'
    companyAnswer = () => Promise.resolve(company)
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.get.mockImplementation((path: string) => {
      if (path === '/companies/t1') return companyAnswer()
      if (path === '/robot-models') return Promise.resolve({ items: models })
      if (path === '/companies/t1/robots') return Promise.resolve({ items: robots, source })
      return Promise.reject(new Error(`unexpected ${path}`))
    })
    mocks.post.mockResolvedValue({
      robot: { id: 'r2', name: 'Food Robot 2' },
      apiKey: 'robot-key-abc123',
    })
  })

  it('shows the company and says when it has no robots', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="robots-title"]').text()).toBe('Robots van Demozaak')
    expect(wrapper.find('[data-testid="robots-empty"]').exists()).toBe(true)
  })

  it('lists robots with status badge, battery and only the start of the key', async () => {
    robots = [robot, { ...robot, id: 'r3', name: 'Demo Parcel Bot', status: 'defect', battery: 12, apiKeyPrefix: 'rb_parcel99' }]
    const wrapper = await mountView()
    await flushPromises()
    const rows = wrapper.findAll('[data-testid="robot-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Demo Food Bot')
    expect(rows[0]!.find('[data-testid="robot-status"]').text()).toBe('Online')
    expect(rows[0]!.find('[data-testid="robot-battery"]').text()).toBe('87%')
    expect(rows[0]!.text()).toContain('begint met rb_demo1234')
    expect(rows[1]!.find('[data-testid="robot-status"]').text()).toBe('Defect')
    // A robot that is already defective cannot be reported again
    expect(rows[1]!.find('[data-testid="robot-report-defect"]').exists()).toBe(false)
    expect(rows[0]!.find('[data-testid="robot-report-defect"]').exists()).toBe(true)
  })

  it('tells when the platform does not answer and these are the last known values', async () => {
    robots = [robot]
    source = 'cache'
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="robots-cache"]').exists()).toBe(true)
  })

  it('says the company does not exist when the API answers 404', async () => {
    companyAnswer = () => Promise.reject(Object.assign(new Error('nope'), { status: 404 }))
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="robots-not-found"]').exists()).toBe(true)
  })

  it('shows an error when the robots cannot be loaded', async () => {
    companyAnswer = () => Promise.reject(new Error('offline'))
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="robots-error"]').text()).toContain('niet geladen')
  })

  it('offers no warm, cold or neutral to choose: the client wants one insulated kind of food robot', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="robot-temperature"]').exists()).toBe(false)
    await wrapper.find('[data-testid="robot-model"]').setValue('model-food')
    expect(wrapper.find('[data-testid="robot-temperature"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Eten gaat altijd in een geïsoleerde robot')
    const options = wrapper.findAll('option').map((option) => option.text())
    expect(options.join(' ')).not.toMatch(/warm|koud|neutraal/i)

    await wrapper.find('[data-testid="robot-name"]').setValue('Pakketje')
    await wrapper.find('[data-testid="robot-model"]').setValue('model-parcel')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/companies/t1/robots', { name: 'Pakketje', modelId: 'model-parcel' })
  })

  it('creates a food robot and shows the key once, ready for the simulator', async () => {
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="robot-name"]').setValue('Food Robot 2')
    await wrapper.find('[data-testid="robot-model"]').setValue('model-food')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mocks.post).toHaveBeenCalledWith('/companies/t1/robots', {
      name: 'Food Robot 2',
      modelId: 'model-food',
    })
    expect(wrapper.find('[data-testid="api-key-value"]').text()).toBe('robot-key-abc123')

    await wrapper.find('[data-testid="api-key-done"]').trigger('click')
    expect(wrapper.find('[data-testid="api-key-dialog"]').exists()).toBe(false)
  })

  it('shows what went wrong when the robot cannot be created', async () => {
    mocks.post.mockRejectedValue(new Error('boem'))
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="robot-name"]').setValue('Food Robot 2')
    await wrapper.find('[data-testid="robot-model"]').setValue('model-parcel')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-testid="robot-form-error"]').text()).toContain('niet aangemaakt')
    expect(wrapper.find('[data-testid="api-key-dialog"]').exists()).toBe(false)
  })

  it('reports a defect of a robot and reloads the list', async () => {
    robots = [robot]
    mocks.post.mockResolvedValue({ id: 'd1' })
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="robot-report-defect"]').trigger('click')
    expect(wrapper.find('[data-testid="defect-dialog"]').text()).toContain('Demo Food Bot')
    await wrapper.find('[data-testid="defect-summary"]').setValue('Sensor vast')
    await wrapper.find('[data-testid="defect-severity"]').setValue('high')
    await wrapper.find('[data-testid="defect-dialog"] form').trigger('submit')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/robots/r1/defects', { summary: 'Sensor vast', severity: 'high' })
    expect(wrapper.find('[data-testid="defect-dialog"]').exists()).toBe(false)
    expect(mocks.get.mock.calls.filter(([path]) => path === '/companies/t1/robots')).toHaveLength(2)
  })

  it('keeps the dialog open and says what went wrong when the defect cannot be reported', async () => {
    robots = [robot]
    mocks.post.mockRejectedValue(new Error('boem'))
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="robot-report-defect"]').trigger('click')
    await wrapper.find('[data-testid="defect-summary"]').setValue('Sensor vast')
    await wrapper.find('[data-testid="defect-dialog"] form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-testid="defect-error"]').exists()).toBe(true)
    await wrapper.find('[data-testid="defect-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="defect-dialog"]').exists()).toBe(false)
  })

  it('a technician may give robots and report defects, but sees no tabs for roles', async () => {
    robots = [robot]
    const wrapper = await mountView(piniaWith('technician', TECHNICIAN_PERMISSIONS))
    await flushPromises()
    expect(wrapper.find('[data-testid="robot-submit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="robot-report-defect"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="company-tabs"]').text()).not.toContain('rollen')
  })

  it('an administrator sees the tabs for roles and the role preview', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="company-tabs"]').text()).toContain('Accounts en rollen')
    expect(wrapper.find('[data-testid="company-tabs"]').text()).toContain('Bekijken als rol')
  })
})
