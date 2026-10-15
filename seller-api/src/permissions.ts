/** The roles of the people who work at the robot seller (not the roles inside a company) */
export const SELLER_ROLES = ['admin', 'technician'] as const
export type SellerRole = (typeof SELLER_ROLES)[number]

export const SELLER_PERMISSIONS = [
  'companies:read',
  'companies:create',
  'company-roles:manage',
  'robots:read',
  'robots:create',
  'defects:read',
  'defects:manage',
  'accounts:manage',
  'audit:read',
] as const
export type SellerPermission = (typeof SELLER_PERMISSIONS)[number]

const BY_ROLE: Record<SellerRole, readonly SellerPermission[]> = {
  admin: SELLER_PERMISSIONS,
  // The "API role" of the client feedback: robots and technical data, nothing about people or companies' setup
  technician: ['companies:read', 'robots:read', 'robots:create', 'defects:read', 'defects:manage'],
}

export function permissionsOf(role: SellerRole): readonly SellerPermission[] {
  return BY_ROLE[role]
}

/**
 * The permission keys a company role can hold: the vocabulary of the platform (a copy of
 * packages/api/src/roles/permissions.ts). It is the only list shared with the platform.
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
