import { Inject, Injectable } from '@nestjs/common'
import { DomainException } from '../common/domain-exception.js'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import {
  PlatformGateway,
  type PlatformCompany,
  type PlatformCondition,
  type PlatformRole,
  type RegisteredRobot,
  type RobotLive,
  type RobotRegistration,
  type RoleInput,
} from './platform.gateway.js'

/** Talks to a platform over HTTP + JSON: the simulator in the demo, a real platform behind an adapter later */
@Injectable()
export class HttpPlatformGateway extends PlatformGateway {
  private readonly baseUrl: string
  private readonly token: string
  private readonly timeoutMs = 5000

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super()
    this.baseUrl = config.platformUrl.replace(/\/+$/, '')
    this.token = config.platformToken
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(this.baseUrl + path, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch {
      throw new DomainException(502, 'platform_unavailable', 'The platform does not answer')
    }
    if (response.status === 204) return undefined as T
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      /* no JSON body: handled below */
    }
    if (response.ok) return payload as T
    if (response.status >= 500 || response.status === 401 || response.status === 403) {
      throw new DomainException(502, 'platform_unavailable', 'The platform refused or failed the request')
    }
    // The platform says no (taken subdomain, unknown permission, ...): pass its answer on
    const error = (payload ?? {}) as { code?: unknown; message?: unknown }
    throw new DomainException(
      response.status,
      typeof error.code === 'string' ? error.code : 'platform_rejected',
      typeof error.message === 'string' ? error.message : 'The platform rejected the request',
    )
  }

  async listCompanies(): Promise<PlatformCompany[]> {
    const companies = await this.call<PlatformCompany[]>('GET', '/companies')
    return companies.map(({ id, name, subdomain, createdAt }) => ({ id, name, subdomain, createdAt }))
  }

  async createCompany(input: { name: string; subdomain: string; adminEmail: string }): Promise<PlatformCompany> {
    const { id, name, subdomain, createdAt } = await this.call<PlatformCompany>('POST', '/companies', input)
    return { id, name, subdomain, createdAt }
  }

  async listRoles(companyId: string, withArchived = false): Promise<PlatformRole[]> {
    const roles = await this.call<Partial<PlatformRole>[]>(
      'GET',
      `/companies/${encodeURIComponent(companyId)}/roles${withArchived ? '?withArchived=true' : ''}`,
    )
    return roles.map(role => this.role(role))
  }

  /** A platform that does not know names per language or archiving still answers with the same shape */
  private role(role: Partial<PlatformRole>): PlatformRole {
    return {
      id: String(role.id),
      name: String(role.name),
      names: role.names ?? null,
      permissions: role.permissions ?? [],
      locked: role.locked ?? false,
      archivedAt: role.archivedAt ?? null,
    }
  }

  async createRole(companyId: string, input: RoleInput): Promise<PlatformRole> {
    return this.role(
      await this.call('POST', `/companies/${encodeURIComponent(companyId)}/roles`, input),
    )
  }

  async updateRole(
    companyId: string,
    roleId: string,
    input: Partial<RoleInput>,
  ): Promise<PlatformRole> {
    return this.role(
      await this.call(
        'PATCH',
        `/companies/${encodeURIComponent(companyId)}/roles/${encodeURIComponent(roleId)}`,
        input,
      ),
    )
  }

  async archiveRole(companyId: string, roleId: string): Promise<PlatformRole> {
    return this.role(
      await this.call(
        'POST',
        `/companies/${encodeURIComponent(companyId)}/roles/${encodeURIComponent(roleId)}/archive`,
        {},
      ),
    )
  }

  async restoreRole(companyId: string, roleId: string): Promise<PlatformRole> {
    return this.role(
      await this.call(
        'POST',
        `/companies/${encodeURIComponent(companyId)}/roles/${encodeURIComponent(roleId)}/restore`,
        {},
      ),
    )
  }

  registerRobot(input: RobotRegistration): Promise<RegisteredRobot> {
    return this.call('POST', '/robots', input)
  }

  async retireRobot(robotId: string): Promise<void> {
    await this.call('POST', `/robots/${encodeURIComponent(robotId)}/retire`, {})
  }

  async reinstateRobot(robotId: string): Promise<void> {
    await this.call('POST', `/robots/${encodeURIComponent(robotId)}/reinstate`, {})
  }

  async robotConditions(ids: string[]): Promise<PlatformCondition[]> {
    if (ids.length === 0) return []
    return this.call('GET', `/robots/conditions?ids=${ids.map(encodeURIComponent).join(',')}`)
  }

  async simulateCondition(
    robotId: string,
    condition: Partial<Omit<PlatformCondition, 'id'>>,
  ): Promise<void> {
    await this.call('PUT', `/robots/${encodeURIComponent(robotId)}/condition`, condition)
  }

  async simulateTelemetry(robotId: string, state: { online: boolean; battery: number }): Promise<void> {
    await this.call('POST', `/robots/${encodeURIComponent(robotId)}/telemetry`, state)
  }

  async robotsLive(ids: string[]): Promise<RobotLive[]> {
    if (ids.length === 0) return []
    return this.call('GET', `/robots/live?ids=${ids.map(encodeURIComponent).join(',')}`)
  }
}
