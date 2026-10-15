import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { piniaWith, routerAt } from '@/test/helpers'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: mocks, apiErrorMessage: (_e: unknown, fallback: string) => fallback }))

const { i18n } = await import('@/i18n')
const { default: CompanyRolesView } = await import('../CompanyRolesView.vue')

const company = { id: 'c1', name: 'Demozaak', subdomain: 'demo', createdAt: '', robotCount: 0, openDefects: 0 }
const permissions = ['tenant:manage', 'orders:read', 'orders:prepare', 'robots:load']
let roles: unknown[] = []

async function mountView() {
  const router = await routerAt('/companies/c1/roles')
  return mount(CompanyRolesView, { global: { plugins: [i18n, piniaWith(), router] } })
}

describe('CompanyRolesView', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'nl'
    roles = [
      { id: 'r-admin', name: 'TENANT_ADMIN', permissions, locked: true },
      { id: 'r-kok', name: 'Kok', permissions: ['orders:read', 'orders:prepare'], locked: false },
    ]
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.delete.mockReset()
    mocks.get.mockImplementation((path: string) => {
      if (path === '/companies/c1') return Promise.resolve(company)
      if (path === '/companies/c1/roles') return Promise.resolve({ items: roles })
      if (path === '/company-permissions') return Promise.resolve({ items: permissions })
      return Promise.reject(new Error(`unexpected ${path}`))
    })
    mocks.post.mockResolvedValue({ id: 'r-new' })
    mocks.delete.mockResolvedValue(undefined)
  })

  it('shows the roles: the administrator locked, the others with what they may do', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="roles-title"]').text()).toBe('Accounts en rollen van Demozaak')
    const rows = wrapper.findAll('[data-testid="role-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Beheerder')
    expect(rows[0]!.text()).toContain('vergrendeld')
    expect(rows[0]!.find('[data-testid="role-remove"]').exists()).toBe(false)
    expect(rows[1]!.text()).toContain('Kok')
    expect(rows[1]!.text()).toContain('Bestellingen bekijken, Bestellingen bereiden')
    expect(rows[1]!.find('[data-testid="role-remove"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('namen en e-mailadressen zie je hier niet')
  })

  it('creates a role from the permissions you tick', async () => {
    const wrapper = await mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="role-form"]').exists()).toBe(false)
    await wrapper.find('[data-testid="new-role"]').trigger('click')
    await wrapper.find('[data-testid="role-name"]').setValue('Lader')
    await wrapper.find('[data-testid="perm-robots_load"]').setValue(true)
    await wrapper.find('[data-testid="role-form"]').trigger('submit')
    await flushPromises()
    expect(mocks.post).toHaveBeenCalledWith('/companies/c1/roles', { name: 'Lader', permissions: ['robots:load'] })
    expect(wrapper.find('[data-testid="roles-message"]').text()).toContain('Lader is aangemaakt')
    expect(wrapper.find('[data-testid="role-form"]').exists()).toBe(false)
  })

  it('says what went wrong when the role cannot be created', async () => {
    mocks.post.mockRejectedValue(new Error('exists'))
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="new-role"]').trigger('click')
    await wrapper.find('[data-testid="role-name"]').setValue('Kok')
    await wrapper.find('[data-testid="role-form"]').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-testid="role-form-error"]').exists()).toBe(true)
  })

  it('removes a role', async () => {
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="role-remove"]').trigger('click')
    await flushPromises()
    expect(mocks.delete).toHaveBeenCalledWith('/companies/c1/roles/r-kok')
    expect(wrapper.findAll('[data-testid="role-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="roles-message"]').text()).toContain('Kok is verwijderd')
  })

  it('says so when a role cannot be removed', async () => {
    mocks.delete.mockRejectedValue(new Error('locked'))
    const wrapper = await mountView()
    await flushPromises()
    await wrapper.find('[data-testid="role-remove"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="roles-remove-error"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="role-row"]')).toHaveLength(2)
  })

  it('links every role to the preview of that role', async () => {
    const wrapper = await mountView()
    await flushPromises()
    const links = wrapper.findAll('[data-testid="role-preview"]')
    expect(links[1]!.attributes('href')).toBe('/companies/c1/preview?role=r-kok')
  })
})
