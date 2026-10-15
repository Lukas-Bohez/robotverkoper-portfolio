import { describe, expect, it } from 'vitest'
import { permissionArea, permissionKey, relativeTime, shortDate, translationKey } from '../format'
import { sectionsFor } from '../preview'

const NOW = Date.parse('2026-10-15T12:00:00Z')

describe('relativeTime', () => {
  it.each([
    ['2026-10-15T11:59:50Z', 'en', 'seconds ago'],
    ['2026-10-15T11:30:00Z', 'en', '30 minutes ago'],
    ['2026-10-15T10:00:00Z', 'nl', '2 uur geleden'],
    ['2026-10-14T12:00:00Z', 'en', 'yesterday'],
    ['2026-10-12T12:00:00Z', 'en', '3 days ago'],
  ])('says how long ago %s was (%s)', (iso, locale, expected) => {
    expect(relativeTime(iso, locale, NOW)).toContain(expected)
  })
})

describe('format helpers', () => {
  it('writes a short date and nothing for no date', () => {
    expect(shortDate('2026-09-23T10:00:00Z', 'nl')).toContain('2026')
    expect(shortDate(null, 'nl')).toBe('')
  })

  it('makes keys the translations can hold', () => {
    expect(translationKey('company-role.created')).toBe('company_role_created')
    expect(permissionKey('orders:read')).toBe('orders_read')
    expect(permissionArea('orders:read')).toBe('orders')
  })
})

describe('sectionsFor: what a company role sees', () => {
  it('shows a cook the orders and the preparation, and lands on the orders', () => {
    expect(sectionsFor(['orders:read', 'orders:prepare'])).toEqual(['orders', 'preparation'])
  })

  it('shows a loader the loading page', () => {
    expect(sectionsFor(['robots:load', 'orders:dispatch'])).toEqual(['dispatch'])
  })

  it('shows an administrator everything, in the order of the menu', () => {
    const all = [
      'tenant:manage', 'roles:read', 'roles:manage', 'staff:read', 'staff:manage', 'audit:read', 'menu:read', 'menu:manage',
      'orders:read', 'orders:prepare', 'orders:dispatch', 'orders:manage', 'robots:read', 'robots:load', 'robots:override',
      'incidents:read', 'incidents:decide',
    ]
    expect(sectionsFor(all)).toEqual(['orders', 'preparation', 'dispatch', 'menu', 'incidents', 'staff', 'roles', 'settings', 'log'])
  })

  it('shows nothing for a role without permissions', () => {
    expect(sectionsFor([])).toEqual([])
  })
})
