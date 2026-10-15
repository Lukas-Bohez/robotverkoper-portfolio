import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { piniaWith, routerAt } from '@/test/helpers'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks, apiErrorMessage: (_e: unknown, fallback: string) => fallback }))

const { i18n } = await import('@/i18n')
const { default: NewCompanyView } = await import('../NewCompanyView.vue')

async function mountView() {
  const router = await routerAt('/companies/new')
  return mount(NewCompanyView, { global: { plugins: [i18n, piniaWith(), router] } })
}

async function fill(wrapper: Awaited<ReturnType<typeof mountView>>, name: string, email: string) {
  await wrapper.find('[data-testid="company-name"]').setValue(name)
  await wrapper.find('[data-testid="company-admin-email"]').setValue(email)
}

describe('NewCompanyView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    mocks.post.mockReset()
    mocks.post.mockResolvedValue({ id: 't9', name: 'Pizzeria Test', subdomain: 'pizzeria-test' })
  })

  it('suggests the address from the name, until you type your own', async () => {
    const wrapper = await mountView()
    const subdomain = () => (wrapper.find('[data-testid="company-subdomain"]').element as HTMLInputElement).value
    await wrapper.find('[data-testid="company-name"]').setValue('Pizzeria Têst!')
    expect(subdomain()).toBe('pizzeria-test')
    await wrapper.find('[data-testid="company-subdomain"]').setValue('pizza')
    await wrapper.find('[data-testid="company-name"]').setValue('Pizzeria Nieuw')
    expect(subdomain()).toBe('pizza')
  })

  it('cannot be submitted until everything is filled in', async () => {
    const wrapper = await mountView()
    const submit = () => wrapper.find('[data-testid="company-submit"]').attributes('disabled')
    expect(submit()).toBeDefined()
    await fill(wrapper, 'Pizzeria Test', '')
    expect(submit()).toBeDefined()
    await fill(wrapper, 'Pizzeria Test', 'chef@pizzeria.example')
    expect(submit()).toBeUndefined()
  })

  it('creates the company, says so and links to its robots', async () => {
    const wrapper = await mountView()
    await fill(wrapper, 'Pizzeria Test', ' chef@pizzeria.example ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/companies', {
      name: 'Pizzeria Test',
      subdomain: 'pizzeria-test',
      adminEmail: 'chef@pizzeria.example',
    })
    expect(wrapper.find('[data-testid="company-created"]').text()).toContain('Pizzeria Test is aangemaakt')
    expect(wrapper.find('[data-testid="company-created-link"]').attributes('href')).toBe('/companies/t9')
    expect((wrapper.find('[data-testid="company-name"]').element as HTMLInputElement).value).toBe('')
  })

  it('shows what went wrong and keeps what was typed', async () => {
    mocks.post.mockRejectedValue(new Error('taken'))
    const wrapper = await mountView()
    await fill(wrapper, 'Pizzeria Test', 'chef@pizzeria.example')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-testid="company-form-error"]').text()).toContain('niet aangemaakt')
    expect((wrapper.find('[data-testid="company-name"]').element as HTMLInputElement).value).toBe('Pizzeria Test')
    expect(wrapper.find('[data-testid="company-created"]').exists()).toBe(false)
  })
})
