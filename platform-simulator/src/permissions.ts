/**
 * The permission keys of the platform (a copy of packages/api/src/roles/permissions.ts).
 * This list is the only vocabulary the seller side shares with the platform: see Lukas/CONTRACT.md.
 */
export const PERMISSIONS = [
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

export function isPermission(value: string): boolean {
  return (PERMISSIONS as readonly string[]).includes(value)
}
