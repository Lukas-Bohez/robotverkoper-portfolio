/**
 * Everything the seller side takes from, and gives to, the platform of the companies.
 * This is the whole contract (see Lukas/CONTRACT.md): nothing else of the platform is visible here.
 */
export type PlatformModelKind = 'FOOD' | 'PARCEL'

export interface PlatformCompany {
  id: string
  name: string
  subdomain: string
  createdAt: string
}

export interface PlatformNames {
  nl?: string | null
  en?: string | null
  fr?: string | null
  de?: string | null
}

export interface PlatformRole {
  id: string
  name: string
  /** The name per language (the platform may leave it out) */
  names: PlatformNames | null
  permissions: string[]
  locked: boolean
  /** Set when the role is archived (soft delete) */
  archivedAt: string | null
}

export interface RoleInput {
  name: string
  names?: PlatformNames
  permissions: string[]
}

export interface RobotRegistration {
  companyId: string
  modelKind: PlatformModelKind
  name: string
}

export interface RegisteredRobot {
  id: string
  apiKey: string
  apiKeyPrefix: string
}

export interface RobotLive {
  id: string
  online: boolean
  battery: number | null
}

/** What the platform last heard from a robot besides its battery: the condition that a technician needs */
export interface PlatformCondition {
  id: string
  tilted: boolean
  tiltDegrees: number | null
  hasCargo: boolean
  cargoSummary: string | null
  cargoSince: string | null
  compartmentTemp: number | null
  lid: 'LOCKED' | 'UNLOCKED' | 'OPEN'
  errorCode: string | null
  errorText: string | null
  location: { country: string; address: string; longitude: number; latitude: number } | null
}

/** A class (not an interface) so it can be the injection token: a real platform plugs in as another provider */
export abstract class PlatformGateway {
  abstract listCompanies(): Promise<PlatformCompany[]>
  abstract createCompany(input: {
    name: string
    subdomain: string
    adminEmail: string
  }): Promise<PlatformCompany>
  abstract listRoles(companyId: string, withArchived?: boolean): Promise<PlatformRole[]>
  abstract createRole(companyId: string, input: RoleInput): Promise<PlatformRole>
  abstract updateRole(
    companyId: string,
    roleId: string,
    input: Partial<RoleInput>,
  ): Promise<PlatformRole>
  /** Soft delete: the platform keeps the role and can bring it back */
  abstract archiveRole(companyId: string, roleId: string): Promise<PlatformRole>
  abstract restoreRole(companyId: string, roleId: string): Promise<PlatformRole>
  abstract registerRobot(input: RobotRegistration): Promise<RegisteredRobot>
  abstract retireRobot(robotId: string): Promise<void>
  /** Takes a retired robot back into service: its key works again */
  abstract reinstateRobot(robotId: string): Promise<void>
  abstract robotsLive(ids: string[]): Promise<RobotLive[]>
  /**
   * The condition of robots (tilt, cargo, lid, temperature, location). Optional: a platform that does not know
   * it answers nothing, and the seller side then shows only what `robotsLive` says.
   */
  robotConditions?(ids: string[]): Promise<PlatformCondition[]>
  /**
   * Only for a platform that is played by a simulator: make a robot look online with a battery, until the
   * robot reports itself. A real platform does not have this (and the demo seed then skips it).
   */
  simulateTelemetry?(robotId: string, state: { online: boolean; battery: number }): Promise<void>
  /** Only for a simulated platform: set the condition of a robot by hand (the demo and the tests) */
  simulateCondition?(robotId: string, condition: Partial<Omit<PlatformCondition, 'id'>>): Promise<void>
}
