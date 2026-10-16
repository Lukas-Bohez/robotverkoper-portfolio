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

export interface PlatformRole {
  id: string
  name: string
  permissions: string[]
  locked: boolean
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

/** A class (not an interface) so it can be the injection token: a real platform plugs in as another provider */
export abstract class PlatformGateway {
  abstract listCompanies(): Promise<PlatformCompany[]>
  abstract createCompany(input: { name: string; subdomain: string; adminEmail: string }): Promise<PlatformCompany>
  abstract listRoles(companyId: string): Promise<PlatformRole[]>
  abstract createRole(companyId: string, input: { name: string; permissions: string[] }): Promise<PlatformRole>
  abstract deleteRole(companyId: string, roleId: string): Promise<void>
  abstract registerRobot(input: RobotRegistration): Promise<RegisteredRobot>
  abstract retireRobot(robotId: string): Promise<void>
  abstract robotsLive(ids: string[]): Promise<RobotLive[]>
  /**
   * Only for a platform that is played by a simulator: make a robot look online with a battery, until the
   * robot reports itself. A real platform does not have this (and the demo seed then skips it).
   */
  simulateTelemetry?(robotId: string, state: { online: boolean; battery: number }): Promise<void>
}
