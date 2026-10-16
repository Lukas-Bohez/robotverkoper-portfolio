import { Inject, Injectable } from '@nestjs/common'
import { DomainException } from '../common/domain-exception.js'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import {
  PlatformGateway,
  type PlatformCompany,
  type PlatformRole,
  type RegisteredRobot,
  type RobotLive,
  type RobotRegistration,
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

  listRoles(companyId: string): Promise<PlatformRole[]> {
    return this.call('GET', `/companies/${encodeURIComponent(companyId)}/roles`)
  }

  createRole(companyId: string, input: { name: string; permissions: string[] }): Promise<PlatformRole> {
    return this.call('POST', `/companies/${encodeURIComponent(companyId)}/roles`, input)
  }

  deleteRole(companyId: string, roleId: string): Promise<void> {
    return this.call('DELETE', `/companies/${encodeURIComponent(companyId)}/roles/${encodeURIComponent(roleId)}`)
  }

  registerRobot(input: RobotRegistration): Promise<RegisteredRobot> {
    return this.call('POST', '/robots', input)
  }

  async retireRobot(robotId: string): Promise<void> {
    await this.call('POST', `/robots/${encodeURIComponent(robotId)}/retire`, {})
  }

  async simulateTelemetry(robotId: string, state: { online: boolean; battery: number }): Promise<void> {
    await this.call('POST', `/robots/${encodeURIComponent(robotId)}/telemetry`, state)
  }

  async robotsLive(ids: string[]): Promise<RobotLive[]> {
    if (ids.length === 0) return []
    return this.call('GET', `/robots/live?ids=${ids.map(encodeURIComponent).join(',')}`)
  }
}
