import type { LocalizedNames } from '../entities/localized-names.entity.js'

/**
 * The rights of the people who work at the robot seller, in groups (the screen "Rollen en rechten van het team"
 * shows them as the rows of a table). A role holds a list of these keys, plus any extra claims.
 */
export const SELLER_PERMISSION_GROUPS = {
  companies: ['companies:read', 'companies:create', 'companies:archive', 'company-roles:manage'],
  robots: ['robots:read', 'robots:create', 'robots:replace', 'robots:archive'],
  defects: ['defects:read', 'defects:report', 'defects:claim', 'defects:close', 'defects:call'],
  team: ['accounts:manage', 'roles:manage', 'audit:read'],
  archive: ['archive:read', 'archive:restore'],
} as const

export const SELLER_PERMISSIONS = [
  ...SELLER_PERMISSION_GROUPS.companies,
  ...SELLER_PERMISSION_GROUPS.robots,
  ...SELLER_PERMISSION_GROUPS.defects,
  ...SELLER_PERMISSION_GROUPS.team,
  ...SELLER_PERMISSION_GROUPS.archive,
] as const
export type SellerPermission = (typeof SELLER_PERMISSIONS)[number]

/**
 * An extra claim is a right outside the standard list, in the form `area:action` (for example
 * `exports:invoices`). The API stores it with the role; the app that needs it checks for it.
 */
export const EXTRA_CLAIM = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/

export function isStandardPermission(key: string): key is SellerPermission {
  return (SELLER_PERMISSIONS as readonly string[]).includes(key)
}

/** The group of a permission (companies, robots, ...), or `extra` for an extra claim */
export function groupOf(key: string): string {
  for (const [group, keys] of Object.entries(SELLER_PERMISSION_GROUPS)) {
    if ((keys as readonly string[]).includes(key)) return group
  }
  return 'extra'
}

/** The keys of the roles that always exist */
export const ADMIN_ROLE_KEY = 'admin'
export const TECHNICIAN_ROLE_KEY = 'technician'

export interface DefaultRole {
  key: string
  names: LocalizedNames
  permissions: readonly string[]
  /** The administrator role is locked: it always holds every right and cannot be archived */
  locked: boolean
}

/**
 * The roles a fresh database starts with. The administrator (the superadmin of the client feedback) can do
 * everything; the technician sees robots and defects and works on them, but has no say over people, companies
 * or the setup (the "API role" of the client feedback #129).
 */
export const DEFAULT_ROLES: DefaultRole[] = [
  {
    key: ADMIN_ROLE_KEY,
    names: { nl: 'Beheerder', en: 'Administrator', fr: 'Administrateur', de: 'Administrator' },
    permissions: SELLER_PERMISSIONS,
    locked: true,
  },
  {
    key: TECHNICIAN_ROLE_KEY,
    names: { nl: 'Technicus', en: 'Technician', fr: 'Technicien', de: 'Techniker' },
    permissions: [
      'companies:read',
      'robots:read',
      'robots:create',
      'robots:replace',
      'defects:read',
      'defects:report',
      'defects:claim',
      'defects:close',
    ],
    locked: false,
  },
]

/**
 * The permission keys a company role can hold: the vocabulary of the platform of the companies (a copy of
 * its permission list). It is the only list shared with the platform.
 */
export const COMPANY_PERMISSIONS = [
  'tenant:manage',
  'roles:read',
  'roles:manage',
  'staff:read',
  'staff:manage',
  'audit:read',
  'menu:read',
  'menu:manage',
  'orders:read',
  'orders:prepare',
  'orders:dispatch',
  'orders:manage',
  'robots:read',
  'robots:load',
  'robots:override',
  'incidents:read',
  'incidents:decide',
] as const
