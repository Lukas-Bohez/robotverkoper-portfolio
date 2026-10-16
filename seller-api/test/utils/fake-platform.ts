import { randomUUID } from 'node:crypto'
import { DomainException } from '../../src/common/domain-exception.js'
import {
  PlatformGateway,
  type PlatformCompany,
  type PlatformRole,
  type RegisteredRobot,
  type RobotLive,
  type RobotRegistration,
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
  lastCreateCompany: unknown = null

  constructor() {
    super()
    this.reset()
  }

  reset(): void {
    this.companiesList = [
      { id: 'c-demo', name: 'Demozaak', subdomain: 'demo', createdAt: '2026-09-23T08:00:00.000Z' },
      { id: 'c-gelato', name: 'Gelato Bar', subdomain: 'gelato', createdAt: '2026-10-10T09:30:00.000Z' },
    ]
    this.roles = new Map()
    this.robots = new Map()
    this.keys = []
    this.down = false
    this.simulated = new Map()
    this.lastCreateCompany = null
  }

  private check(): void {
    if (this.down) throw new DomainException(502, 'platform_unavailable', 'The platform does not answer')
  }

  listCompanies(): Promise<PlatformCompany[]> {
    this.check()
    return Promise.resolve(this.companiesList.map(company => ({ ...company })))
  }

  createCompany(input: { name: string; subdomain: string; adminEmail: string }): Promise<PlatformCompany> {
    this.check()
    this.lastCreateCompany = input
    if (this.companiesList.some(company => company.subdomain === input.subdomain)) {
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

  listRoles(companyId: string): Promise<PlatformRole[]> {
    this.check()
    if (!this.roles.has(companyId)) {
      this.roles.set(companyId, [
        { id: `${companyId}-admin`, name: 'TENANT_ADMIN', permissions: ['tenant:manage'], locked: true },
      ])
    }
    return Promise.resolve(this.roles.get(companyId)!.map(role => ({ ...role })))
  }

  async createRole(companyId: string, input: { name: string; permissions: string[] }): Promise<PlatformRole> {
    await this.listRoles(companyId)
    const role = { id: randomUUID(), name: input.name, permissions: input.permissions, locked: false }
    this.roles.get(companyId)!.push(role)
    return role
  }

  async deleteRole(companyId: string, roleId: string): Promise<void> {
    await this.listRoles(companyId)
    this.roles.set(
      companyId,
      this.roles.get(companyId)!.filter(role => role.id !== roleId),
    )
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

  simulateTelemetry(robotId: string, state: { online: boolean; battery: number }): Promise<void> {
    this.simulated.set(robotId, state)
    const robot = this.robots.get(robotId)
    if (robot) Object.assign(robot, state)
    return Promise.resolve()
  }

  robotsLive(ids: string[]): Promise<RobotLive[]> {
    this.check()
    return Promise.resolve(
      ids
        .map(id => ({ id, robot: this.robots.get(id) }))
        .filter(item => item.robot)
        .map(item => ({ id: item.id, online: item.robot!.online, battery: item.robot!.battery })),
    )
  }
}
