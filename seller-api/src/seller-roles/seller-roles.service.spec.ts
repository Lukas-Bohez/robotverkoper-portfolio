import { describe, expect, it, vi } from 'vitest'
import type { MongoRepository } from 'typeorm'
import type { Account } from '../accounts/entities/account.entity.js'
import type { AuditService } from '../audit/audit.service.js'
import { SELLER_PERMISSIONS } from '../authentication/permissions.js'
import { SellerRolesService } from './seller-roles.service.js'
import type { SellerRole } from './entities/seller-role.entity.js'

/** The service with a repository that holds the roles we hand it (no database) */
function serviceWith(roles: Partial<SellerRole>[], accountsInUse = 0) {
  const repository = {
    findOne: vi.fn(({ where }: { where: { key?: string } }) =>
      Promise.resolve(roles.find((role) => role.key === where.key) ?? null),
    ),
    save: vi.fn((role: SellerRole) => Promise.resolve(role)),
    softRemove: vi.fn((role: SellerRole) => Promise.resolve(role)),
    delete: vi.fn(),
    deleteOne: vi.fn(),
    remove: vi.fn(),
  }
  const accounts = { count: vi.fn(() => Promise.resolve(accountsInUse)) }
  const audit = { record: vi.fn(() => Promise.resolve()) }
  const service = new SellerRolesService(
    repository as unknown as MongoRepository<SellerRole>,
    accounts as unknown as MongoRepository<Account>,
    audit as unknown as AuditService,
  )
  return { service, repository, accounts, audit }
}

describe('SellerRolesService.permissionsOf', () => {
  const technician = {
    key: 'technician',
    locked: false,
    permissions: ['defects:read', 'exports:invoices'],
  }

  it('is empty for nobody and for a role that does not exist (or was archived)', async () => {
    const { service } = serviceWith([technician])
    expect(await service.permissionsOf(null)).toEqual([])
    expect(await service.permissionsOf('bestaat-niet')).toEqual([])
  })

  it('gives a role exactly what it holds, extra claims included', async () => {
    const { service } = serviceWith([technician])
    expect(await service.permissionsOf('technician')).toEqual(['defects:read', 'exports:invoices'])
  })

  it('gives the locked administrator every standard right, also one that was added to the code later', async () => {
    const stored = { key: 'admin', locked: true, permissions: SELLER_PERMISSIONS.slice(0, 3) }
    const { service } = serviceWith([stored])
    const rights = await service.permissionsOf('admin')
    expect([...rights].sort()).toEqual([...SELLER_PERMISSIONS].sort())
  })

  it('never locks the administrator out, not even when the roles were emptied', async () => {
    const { service } = serviceWith([])
    expect(await service.permissionsOf('admin')).toHaveLength(SELLER_PERMISSIONS.length)
    expect(await service.permissionsOf('technician')).toEqual([])
  })

  it('does not hand out a copy that changes the stored role', async () => {
    const { service } = serviceWith([technician])
    const rights = await service.permissionsOf('technician')
    rights.push('accounts:manage')
    expect(technician.permissions).toEqual(['defects:read', 'exports:invoices'])
  })
})

describe('SellerRolesService checks', () => {
  const { service } = serviceWith([])

  it('accepts standard rights and extra claims, once each', () => {
    expect(service.checkPermissions(['defects:read', 'exports:invoices', 'defects:read'])).toEqual([
      'defects:read',
      'exports:invoices',
    ])
  })

  it('refuses what is neither a right nor an extra claim', () => {
    expect(() => service.checkPermissions(['defects:read', 'gewoon maar wat'])).toThrow(
      expect.objectContaining({ code: 'invalid_claim' }),
    )
  })

  it('needs a name in at least one language and drops the empty ones', () => {
    expect(service.checkNames({ nl: ' Helpdesk ', en: '', fr: null })).toEqual({ nl: 'Helpdesk' })
    expect(() => service.checkNames({ nl: '  ' })).toThrow(
      expect.objectContaining({ code: 'invalid_names' }),
    )
  })
})

describe('archiving a role is a soft delete', () => {
  const role = { key: 'tijdelijk', locked: false, permissions: [], deletedAt: null }

  it('soft-removes and never deletes', async () => {
    const { service, repository } = serviceWith([role])
    vi.spyOn(service, 'findOne').mockResolvedValue({ ...role, id: 'r1' } as never)
    await service.remove('docent@howest.be', 'r1')
    expect(repository.softRemove).toHaveBeenCalledTimes(1)
    expect(repository.delete).not.toHaveBeenCalled()
    expect(repository.deleteOne).not.toHaveBeenCalled()
    expect(repository.remove).not.toHaveBeenCalled()
  })

  it('remembers who archived it', async () => {
    const { service, repository } = serviceWith([role])
    vi.spyOn(service, 'findOne').mockResolvedValue({ ...role, id: 'r1' } as never)
    await service.remove('docent@howest.be', 'r1')
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ deletedBy: 'docent@howest.be' }),
    )
  })

  it('is blocked while someone has the role, and nothing is changed then', async () => {
    const { service, repository } = serviceWith([role], 2)
    vi.spyOn(service, 'findOne').mockResolvedValue({ ...role, id: 'r1' } as never)
    await expect(service.remove('docent@howest.be', 'r1')).rejects.toMatchObject({
      code: 'role_in_use',
    })
    expect(repository.softRemove).not.toHaveBeenCalled()
    expect(repository.save).not.toHaveBeenCalled()
  })

  it('never archives the locked administrator role', async () => {
    const { service, repository } = serviceWith([])
    vi.spyOn(service, 'findOne').mockResolvedValue({ key: 'admin', locked: true } as never)
    await expect(service.remove('docent@howest.be', 'r1')).rejects.toMatchObject({
      code: 'role_locked',
    })
    expect(repository.softRemove).not.toHaveBeenCalled()
  })
})
