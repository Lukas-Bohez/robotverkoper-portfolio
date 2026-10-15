import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { piniaWith, routerAt } from '@/test/helpers'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks, apiErrorMessage: (_e: unknown, fallback: string) => fallback }))

const { i18n } = await import('@/i18n')
const { default: DefectsView } = await import('../DefectsView.vue')

const defect = {
  id: 'd1',
  robot: { id: 'r1', name: 'Demo Parcel Bot' },
  company: { id: 'c1', name: 'Demozaak' },
  summary: 'Batterij valt snel leeg',
  severity: 'high',
  status: 'open',
  reportedBy: 'docent@howest.be',
  createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  resolvedAt: null,
  replacementRobotId: null,
}

let defects: unknown[] = []

async function mountView() {
  const router = await routerAt('/defects')
  return mount(DefectsView, { global: { plugins: [i18n, piniaWith(), router] } })
}

describe('DefectsView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    defects = [defect]
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.get.mockImplementation(() => Promise.resolve({ items: defects }))
    mocks.post.mockResolvedValue({
      defect: { ...defect, status: 'replaced' },
      robot: { id: 'r2', name: 'Demo Parcel Bot (vervanger)' },
      apiKey: 'robot-key-abc123',
    })
  })

  it('lists the open defects of all companies', async () => {
    const wrapper = await mountView()
    await flushPromises()
    const rows = wrapper.findAll('[data-testid="defect-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Demo Parcel Bot')
    expect(rows[0]!.text()).toContain('Demozaak')
    expect(rows[0]!.text()).toContain('Batterij valt snel leeg')
    expect(rows[0]!.text()).toContain('2 uur geleden')
    expect(mocks.get).toHaveBeenCalledWith('/defects')
  })

  it('says all robots work when there is no defect', async () => {
    defects = []
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="defects-empty"]').text()).toContain('Alle robots werken')
  })

  it('shows an error when the defects cannot be loaded', async () => {
    mocks.get.mockRejectedValue(new Error('offline'))
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="defects-error"]').exists()).toBe(true)
  })

  it('replaces a robot: asks for a name, then shows the new key once', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="replace-submit"]').exists()).toBe(false)
    await wrapper.find('[data-testid="defect-replace"]').trigger('click')
    expect(wrapper.find('[data-testid="panel-for"]').text()).toBe('Demo Parcel Bot (Demozaak)')
    expect((wrapper.find('[data-testid="replace-name"]').element as HTMLInputElement).value).toBe('Demo Parcel Bot (vervanger)')

    defects = []
    await wrapper.find('[data-testid="replace-name"]').setValue('Pakketrobot 2')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mocks.post).toHaveBeenCalledWith('/defects/d1/replace', { name: 'Pakketrobot 2' })
    expect(wrapper.find('[data-testid="defects-message"]').text()).toContain('is vervangen')
    expect(wrapper.find('[data-testid="api-key-value"]').text()).toBe('robot-key-abc123')
    expect(wrapper.find('[data-testid="defects-empty"]').exists()).toBe(true)
  })

  it('keeps the defect and says what went wrong when replacing fails', async () => {
    mocks.post.mockRejectedValue(new Error('boem'))
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="defect-replace"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-testid="panel-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="defect-row"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="api-key-dialog"]').exists()).toBe(false)
  })

  it('closes a defect without replacing the robot', async () => {
    mocks.post.mockResolvedValue({ ...defect, status: 'closed' })
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="defect-replace"]').trigger('click')
    defects = []
    await wrapper.find('[data-testid="defect-close"]').trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/defects/d1/close', {})
    expect(wrapper.find('[data-testid="defects-message"]').text()).toContain('gesloten')
  })
})
