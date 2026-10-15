import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import ApiKeyDialog from '../ApiKeyDialog.vue'

function mountDialog() {
  return mount(ApiKeyDialog, {
    props: { robotName: 'Demo Parcel Bot', apiKey: 'robot-key-abc123' },
    global: { plugins: [i18n] },
  })
}

describe('ApiKeyDialog', () => {
  const writeText = vi.fn()

  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  it('shows the key and says it is shown only once', () => {
    const wrapper = mountDialog()
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
})
