/**
 * What a company role would see in the app of the company. The sellers use this to check a role
 * before the company does ("Bekijken als rol"). It only reads the permission keys: nothing of the
 * company's real data is shown.
 */
export type SectionId =
  | 'orders'
  | 'preparation'
  | 'dispatch'
  | 'menu'
  | 'incidents'
  | 'staff'
  | 'roles'
  | 'settings'
  | 'log'

/** In the order of the menu of the company app: the first one is where the role lands */
const SECTIONS: [SectionId, string[]][] = [
  ['orders', ['orders:read', 'orders:manage']],
  ['preparation', ['orders:prepare']],
  ['dispatch', ['orders:dispatch', 'robots:load', 'robots:override', 'robots:read']],
  ['menu', ['menu:read', 'menu:manage']],
  ['incidents', ['incidents:read', 'incidents:decide']],
  ['staff', ['staff:read', 'staff:manage']],
  ['roles', ['roles:read', 'roles:manage']],
  ['settings', ['tenant:manage']],
  ['log', ['audit:read']],
]

export function sectionsFor(permissions: readonly string[]): SectionId[] {
  return SECTIONS.filter(([, keys]) => keys.some((key) => permissions.includes(key))).map(([id]) => id)
}
