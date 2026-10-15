import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks, apiErrorMessage: (_e: unknown, fallback: string) => fallback }))

const { i18n } = await import('@/i18n')
const { default: ApiKeyDialog } = await import('../ApiKeyDialog.vue')

function mountDialog() {
  return mount(ApiKeyDialog, {
    props: { robotId: 'r1', robotName: 'Demo Parcel Bot', apiKey: 'robot-key-abc123' },
    global: { plugins: [i18n] },
  })
}

const local = { id: 'p1', device: 'Windows-simulator', code: '4K7Q', loopback: true, createdAt: 'nu' }
const phone = { id: 'p2', device: 'Pixel', code: 'M3ZX', loopback: false, createdAt: 'nu' }

describe('ApiKeyDialog', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    i18n.global.locale.value = 'nl'
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.get.mockResolvedValue({ items: [] })
    mocks.post.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })
  afterEach(() => vi.useRealTimers())

  it('shows the key and says it is shown only once', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.find('[data-testid="api-key-value"]').text()).toBe('robot-key-abc123')
    expect(wrapper.text()).toContain('Demo Parcel Bot')
    expect(wrapper.text()).toContain('maar één keer')
    expect(wrapper.attributes('role')).toBe('alertdialog')
  })

  it('copies the key', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="api-key-copy"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('robot-key-abc123')
    expect(wrapper.find('[data-testid="api-key-copy"]').text()).toBe('Gekopieerd')
  })

  it('does not claim it copied when the browser refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="api-key-copy"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="api-key-copy"]').text()).toBe('Kopiëren')
  })

  it('closes when the key has been saved', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="api-key-done"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('tells how to get the key into the simulator when none waits', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.find('[data-testid="handoff-none"]').text()).toContain('verschijnt daar vanzelf')
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('sends the key by itself to a simulator on this computer, so nothing is copied', async () => {
    mocks.get.mockResolvedValue({ items: [local] })
    const wrapper = mountDialog()
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/pairings/p1/deliver', { robotId: 'r1', apiKey: 'robot-key-abc123' })
    expect(wrapper.find('[data-testid="handoff-sent"]').text()).toContain('Windows-simulator')
    expect(wrapper.find('[data-testid="handoff-none"]').exists()).toBe(false)
  })

  it('sends it as soon as a simulator starts waiting while the dialog is open', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(mocks.post).not.toHaveBeenCalled()
    mocks.get.mockResolvedValue({ items: [local] })
    await vi.advanceTimersByTimeAsync(2100)
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="handoff-sent"]').exists()).toBe(true)
  })

  it('does not send to a simulator elsewhere (a phone) until the seller picks it', async () => {
    mocks.get.mockResolvedValue({ items: [phone] })
    const wrapper = mountDialog()
    await flushPromises()
    expect(mocks.post).not.toHaveBeenCalled()
    const button = wrapper.find('[data-testid="handoff-send"]')
    expect(button.text()).toContain('M3ZX')
    await button.trigger('click')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/pairings/p2/deliver', { robotId: 'r1', apiKey: 'robot-key-abc123' })
    expect(wrapper.find('[data-testid="handoff-sent"]').exists()).toBe(true)
  })

  it('says so when the key could not be sent, and leaves the copy button', async () => {
    mocks.get.mockResolvedValue({ items: [local] })
    mocks.post.mockRejectedValue(new Error('boem'))
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.find('[data-testid="handoff-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="api-key-copy"]').exists()).toBe(true)
  })

  it('stops asking for simulators when the dialog is gone', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    wrapper.unmount()
    mocks.get.mockClear()
    await vi.advanceTimersByTimeAsync(10000)
    expect(mocks.get).not.toHaveBeenCalled()
  })
})
