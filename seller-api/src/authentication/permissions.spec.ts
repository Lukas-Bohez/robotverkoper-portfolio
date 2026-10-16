import { describe, expect, it } from 'vitest'
import {
  ADMIN_ROLE_KEY,
  COMPANY_PERMISSIONS,
  DEFAULT_ROLES,
  EXTRA_CLAIM,
  SELLER_PERMISSIONS,
  SELLER_PERMISSION_GROUPS,
  TECHNICIAN_ROLE_KEY,
  groupOf,
  isStandardPermission,
} from './permissions.js'

describe('the rights of our own staff', () => {
  it('has 18 standard rights, none twice, in five groups', () => {
    expect(SELLER_PERMISSIONS).toHaveLength(18)
    expect(new Set(SELLER_PERMISSIONS).size).toBe(SELLER_PERMISSIONS.length)
    expect(Object.keys(SELLER_PERMISSION_GROUPS)).toEqual(['companies', 'robots', 'defects', 'team', 'archive'])
  })

  it('every right is written as area:action', () => {
    for (const key of SELLER_PERMISSIONS) expect(key).toMatch(EXTRA_CLAIM)
  })

  it('knows the group of a right, and calls anything else "extra"', () => {
    expect(groupOf('defects:claim')).toBe('defects')
    expect(groupOf('archive:restore')).toBe('archive')
    expect(groupOf('company-roles:manage')).toBe('companies')
    expect(groupOf('exports:invoices')).toBe('extra')
  })

  it('tells a standard right from an extra claim', () => {
    expect(isStandardPermission('robots:replace')).toBe(true)
    expect(isStandardPermission('exports:invoices')).toBe(false)
  })
})

describe('extra claims', () => {
  it.each(['exports:invoices', 'a:b', 'area-1:do-it', 'x9:y9'])('accepts %s', claim => {
    expect(claim).toMatch(EXTRA_CLAIM)
  })

  it.each(['exports', ':invoices', 'exports:', 'Exports:Invoices', 'exports:invoices:all', 'ex ports:x', '1x:y', 'x:1y', ''])(
    'refuses %j',
    claim => {
      expect(claim).not.toMatch(EXTRA_CLAIM)
    },
  )
})

describe('the roles a fresh database starts with', () => {
  const admin = DEFAULT_ROLES.find(role => role.key === ADMIN_ROLE_KEY)!
  const technician = DEFAULT_ROLES.find(role => role.key === TECHNICIAN_ROLE_KEY)!

  it('are the administrator and the technician', () => {
    expect(DEFAULT_ROLES.map(role => role.key)).toEqual(['admin', 'technician'])
  })

  it('the administrator is locked and holds every right', () => {
    expect(admin.locked).toBe(true)
    expect([...admin.permissions].sort()).toEqual([...SELLER_PERMISSIONS].sort())
  })

  it('the technician works on robots and defects, and has no say over people, companies, roles or the archive', () => {
    expect(technician.locked).toBe(false)
    for (const right of technician.permissions) expect(isStandardPermission(right)).toBe(true)
    expect(technician.permissions).toEqual(
      expect.arrayContaining(['defects:read', 'defects:claim', 'defects:close', 'robots:replace']),
    )
    for (const forbidden of ['accounts:manage', 'roles:manage', 'audit:read', 'archive:restore', 'companies:create', 'defects:call']) {
      expect(technician.permissions, forbidden).not.toContain(forbidden)
    }
  })

  it('both have a name in the four languages of the app', () => {
    for (const role of DEFAULT_ROLES) {
      expect(Object.keys(role.names).sort()).toEqual(['de', 'en', 'fr', 'nl'])
    }
  })
})

describe('the rights a company role can hold', () => {
  it('is a list without doubles in the same area:action form', () => {
    expect(new Set(COMPANY_PERMISSIONS).size).toBe(COMPANY_PERMISSIONS.length)
    for (const key of COMPANY_PERMISSIONS) expect(key).toMatch(EXTRA_CLAIM)
  })
})
