import { describe, expect, it } from 'vitest'
import type { PermissionInfo, SellerRole } from '@/api/types'
import {
  changedCells,
  changedRoles,
  languagesOf,
  matrixOf,
  missingLanguagesOf,
  rightRows,
  roleKeyFromName,
  toggled,
} from '../roles'

const role = (id: string, permissions: string[], names: SellerRole['names'] = { nl: 'X', en: 'X' }) => ({ id, permissions, names }) as SellerRole

describe('the table of rights', () => {
  it('toggles one cell and leaves the old table alone', () => {
    const before = matrixOf([role('r1', ['defects:read'])])
    const after = toggled(before, 'r1', 'defects:claim')
    expect(after.r1).toEqual(['defects:read', 'defects:claim'])
    expect(before.r1).toEqual(['defects:read'])
    expect(toggled(after, 'r1', 'defects:read').r1).toEqual(['defects:claim'])
  })

  it('counts what changed against what is saved', () => {
    const saved = matrixOf([role('r1', ['a:b', 'c:d']), role('r2', [])])
    let current = toggled(saved, 'r1', 'a:b')
    current = toggled(current, 'r2', 'e:f')
    expect(changedCells(saved, current)).toBe(2)
    expect(changedRoles(saved, current).sort()).toEqual(['r1', 'r2'])
    expect(changedCells(saved, saved)).toBe(0)
    expect(changedRoles(saved, saved)).toEqual([])
  })

  it('knows the order of rights does not matter', () => {
    expect(changedRoles({ r: ['a:b', 'c:d'] }, { r: ['c:d', 'a:b'] })).toEqual([])
  })

  it('lists the standard rights by group and then every extra right', () => {
    const catalog: PermissionInfo[] = [
      { key: 'defects:read', group: 'defects' },
      { key: 'companies:read', group: 'companies' },
    ]
    const rows = rightRows(catalog, [role('r1', ['defects:read', 'wijn:schenken'])])
    expect(rows.map(r => r.key).slice(0, 2)).toEqual(['companies:read', 'defects:read'])
    expect(rows.filter(r => r.extra).map(r => r.key)).toEqual(['defects:forward', 'exports:invoices', 'reports:weekly', 'wijn:schenken'])
  })
})

describe('names of a role', () => {
  it('says which languages have a name and which are missing', () => {
    const r = role('r', [], { nl: 'Kok', en: 'Cook', fr: '', de: null })
    expect(languagesOf(r)).toEqual(['nl', 'en'])
    expect(missingLanguagesOf(r)).toEqual(['fr', 'de'])
  })

  it('makes a key from a name', () => {
    expect(roleKeyFromName('Eerste hulp')).toBe('eerste-hulp')
    expect(roleKeyFromName('  Café – Ober! ')).toBe('cafe-ober')
  })
})
