import { randomUUID } from 'node:crypto'
import { DomainException } from '../../src/common/domain-exception.js'
import {
  PlatformGateway,
  type PlatformCompany,
  type PlatformCondition,
  type PlatformRole,
  type RegisteredRobot,
  type RobotLive,
  type RobotRegistration,
  type RoleInput,
} from '../../src/platform/platform.gateway.js'

/** The platform, played in memory: no network, no real company data */
export class FakePlatform extends PlatformGateway {
  companiesList: PlatformCompany[] = []
  roles = new Map<string, PlatformRole[]>()
  robots = new Map<
    string,
    { registration: RobotRegistration; retired: boolean; online: boolean; battery: number }
  >()
  keys: string[] = []
  down = false
  simulated = new Map<string, { online: boolean; battery: number }>()
  conditions = new Map<string, Omit<PlatformCondition, 'id'>>()
  lastCreateCompany: unknown = null

  constructor() {
    super()
    this.reset()
  }

  reset(): void {
    this.companiesList = [
      { id: 'c-demo', name: 'Demozaak', subdomain: 'demo', createdAt: '2026-09-23T08:00:00.000Z' },
      {
        id: 'c-gelato',
        name: 'Gelato Bar',
        subdomain: 'gelato',
        createdAt: '2026-10-10T09:30:00.000Z',
      },
    ]
    this.roles = new Map()
    this.robots = new Map()
    this.keys = []
    this.down = false
    this.simulated = new Map()
    this.conditions = new Map()
    this.lastCreateCompany = null
  }

  private check(): void {
    if (this.down)
      throw new DomainException(502, 'platform_unavailable', 'The platform does not answer')
  }

  listCompanies(): Promise<PlatformCompany[]> {
    this.check()
    return Promise.resolve(this.companiesList.map((company) => ({ ...company })))
  }

  createCompany(input: {
    name: string
    subdomain: string
    adminEmail: string
  }): Promise<PlatformCompany> {
    this.check()
    this.lastCreateCompany = input
    if (this.companiesList.some((company) => company.subdomain === input.subdomain)) {
      return Promise.reject(
        new DomainException(409, 'subdomain_taken', `The subdomain "${input.subdomain}" is taken`),
      )
    }
    const company = {
      id: randomUUID(),
      name: input.name,
      subdomain: input.subdomain,
      createdAt: new Date().toISOString(),
    }
    this.companiesList.push(company)
    return Promise.resolve(company)
  }

  private rolesOf(companyId: string): PlatformRole[] {
    if (!this.roles.has(companyId)) {
      this.roles.set(companyId, [
        {
          id: `${companyId}-admin`,
          name: 'TENANT_ADMIN',
          names: null,
          permissions: ['tenant:manage'],
          locked: true,
          archivedAt: null,
        },
      ])
    }
    return this.roles.get(companyId)!
  }

  listRoles(companyId: string, withArchived = false): Promise<PlatformRole[]> {
    this.check()
    return Promise.resolve(
      this.rolesOf(companyId)
        .filter((role) => withArchived || !role.archivedAt)
        .map((role) => ({ ...role })),
    )
  }

  async createRole(companyId: string, input: RoleInput): Promise<PlatformRole> {
    this.check()
    const role: PlatformRole = {
      id: randomUUID(),
      name: input.name,
      names: input.names ?? null,
      permissions: input.permissions,
      locked: false,
      archivedAt: null,
    }
    this.rolesOf(companyId).push(role)
    return { ...role }
  }

  private roleOf(companyId: string, roleId: string): PlatformRole {
    const role = this.rolesOf(companyId).find((item) => item.id === roleId)
    if (!role) throw new DomainException(404, 'role_not_found', 'This role does not exist')
    return role
  }

  async updateRole(
    companyId: string,
    roleId: string,
    input: Partial<RoleInput>,
  ): Promise<PlatformRole> {
    this.check()
    const role = this.roleOf(companyId, roleId)
    if (input.name) role.name = input.name
    if (input.names) role.names = input.names
    if (input.permissions) role.permissions = input.permissions
    return { ...role }
  }

  async archiveRole(companyId: string, roleId: string): Promise<PlatformRole> {
    this.check()
    const role = this.roleOf(companyId, roleId)
    role.archivedAt = new Date().toISOString()
    return { ...role }
  }

  async restoreRole(companyId: string, roleId: string): Promise<PlatformRole> {
    this.check()
    const role = this.roleOf(companyId, roleId)
    role.archivedAt = null
    return { ...role }
  }

  registerRobot(input: RobotRegistration): Promise<RegisteredRobot> {
    this.check()
    const id = randomUUID()
    const apiKey = `rb_${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`
    this.keys.push(apiKey)
    this.robots.set(id, { registration: input, retired: false, online: true, battery: 80 })
    return Promise.resolve({ id, apiKey, apiKeyPrefix: apiKey.slice(0, 11) })
  }

  retireRobot(robotId: string): Promise<void> {
    this.check()
    const robot = this.robots.get(robotId)
    if (robot) {
      robot.retired = true
      robot.online = false
    }
    return Promise.resolve()
  }

  reinstateRobot(robotId: string): Promise<void> {
    this.check()
    const robot = this.robots.get(robotId)
    if (robot) robot.retired = false
    return Promise.resolve()
  }

  simulateTelemetry(robotId: string, state: { online: boolean; battery: number }): Promise<void> {
    this.simulated.set(robotId, state)
    const robot = this.robots.get(robotId)
    if (robot) Object.assign(robot, state)
    return Promise.resolve()
  }

  simulateCondition(
    robotId: string,
    condition: Partial<Omit<PlatformCondition, 'id'>>,
  ): Promise<void> {
    this.conditions.set(robotId, {
      tilted: false,
      tiltDegrees: null,
      hasCargo: false,
      cargoSummary: null,
      cargoSince: null,
      compartmentTemp: null,
      lid: 'LOCKED',
      errorCode: null,
      errorText: null,
      location: null,
      ...this.conditions.get(robotId),
      ...condition,
    })
    return Promise.resolve()
  }

  robotConditions(ids: string[]): Promise<PlatformCondition[]> {
    this.check()
    return Promise.resolve(
      ids.flatMap((id) => {
        const condition = this.conditions.get(id)
        return condition ? [{ id, ...condition }] : []
      }),
    )
  }

  robotsLive(ids: string[]): Promise<RobotLive[]> {
    this.check()
    return Promise.resolve(
      ids
        .map((id) => ({ id, robot: this.robots.get(id) }))
        .filter((item) => item.robot)
        .map((item) => ({ id: item.id, online: item.robot!.online, battery: item.robot!.battery })),
    )
  }
}
