import { PERMISSIONS, type PermissionInfo, type SellerRole } from '@/api/types'

/**
 * The extra rights a role can be given besides the standard ones: a short list in words, not a text field. (The API
 * accepts any `area:action`; this is what the customers can pick from. A role that already holds another claim
 * still shows it, with its key as the name.)
 */
export const EXTRA_RIGHTS = ['exports:invoices', 'defects:forward', 'reports:weekly'] as const

export const GROUP_ORDER = ['companies', 'robots', 'defects', 'team', 'archive'] as const

export function isStandardRight(key: string): boolean {
  return (PERMISSIONS as readonly string[]).includes(key)
}

export interface RightRow {
  key: string
  group: string
  /** An extra right (a claim) instead of a standard one */
  extra: boolean
}

/** The rows of the table of rights: the standard rights by group, then every extra right that exists */
export function rightRows(catalog: readonly PermissionInfo[], roles: readonly SellerRole[]): RightRow[] {
  const rows: RightRow[] = []
  for (const group of GROUP_ORDER) {
    for (const right of catalog) {
      if (right.group === group) rows.push({ key: right.key, group, extra: false })
    }
  }
  const extras = new Set<string>([...EXTRA_RIGHTS])
  for (const role of roles) for (const key of role.permissions) if (!isStandardRight(key)) extras.add(key)
  // Only the extra rights that a role holds, or that the table offers: the three known ones are always rows
  for (const key of [...extras].sort()) rows.push({ key, group: 'extra', extra: true })
  return rows
}

export type Matrix = Record<string, string[]>

/** The rights per role id, as the table edits them (a copy: the screen can undo) */
export function matrixOf(roles: readonly { id: string; permissions: string[] }[]): Matrix {
  return Object.fromEntries(roles.map(role => [role.id, [...role.permissions]]))
}

export function has(matrix: Matrix, roleId: string, key: string): boolean {
  return matrix[roleId]?.includes(key) ?? false
}

/** One cell of the table: gives the right or takes it away. Returns a new matrix (nothing is changed in place). */
export function toggled(matrix: Matrix, roleId: string, key: string): Matrix {
  const current = matrix[roleId] ?? []
  const next = current.includes(key) ? current.filter(item => item !== key) : [...current, key]
  return { ...matrix, [roleId]: next }
}

/** The ids of the roles whose rights differ from what is saved */
export function changedRoles(saved: Matrix, current: Matrix): string[] {
  return Object.keys(current).filter(id => {
    const a = [...(saved[id] ?? [])].sort()
    const b = [...(current[id] ?? [])].sort()
    return a.length !== b.length || a.some((key, index) => key !== b[index])
  })
}

/** How many cells changed (the line "3 wijzigingen nog niet opgeslagen") */
export function changedCells(saved: Matrix, current: Matrix): number {
  let count = 0
  for (const id of Object.keys(current)) {
    const before = new Set(saved[id] ?? [])
    const after = new Set(current[id] ?? [])
    for (const key of before) if (!after.has(key)) count++
    for (const key of after) if (!before.has(key)) count++
  }
  return count
}

/** The languages in which a role has a name, for the line "NL · EN · FR · DE" under its title */
export function languagesOf(role: Pick<SellerRole, 'names'>): string[] {
  return (['nl', 'en', 'fr', 'de'] as const).filter(code => (role.names?.[code] ?? '').trim() !== '')
}

export function missingLanguagesOf(role: Pick<SellerRole, 'names'>): string[] {
  const have = languagesOf(role)
  return (['nl', 'en', 'fr', 'de'] as const).filter(code => !have.includes(code))
}

/** A key for a new role from its Dutch (or first) name: "Eerste hulp" becomes "eerste-hulp" */
export function roleKeyFromName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 29)
}
