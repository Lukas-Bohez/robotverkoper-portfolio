import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { DevTokenVerifier } from '../src/auth.ts'
import { createSellerApi } from '../src/app.ts'
import { openDatabase } from '../src/db.ts'
import { HttpError } from '../src/http.ts'
import type {
  PlatformCompany,
  PlatformGateway,
  PlatformRole,
  RegisteredRobot,
  RobotLive,
  RobotRegistration,
} from '../src/platform.ts'
import { seedModels } from '../src/seed.ts'
import { SellerService } from '../src/service.ts'
import { SellerStore } from '../src/store.ts'

/** The platform, played in memory: no network, no real company data */
export class FakePlatform implements PlatformGateway {
  companiesList: PlatformCompany[] = [
    { id: 'c-demo', name: 'Demozaak', subdomain: 'demo', createdAt: '2026-09-23T08:00:00.000Z' },
    { id: 'c-gelato', name: 'Gelato Bar', subdomain: 'gelato', createdAt: '2026-10-10T09:30:00.000Z' },
  ]
  roles = new Map<string, PlatformRole[]>()
  robots = new Map<string, { registration: RobotRegistration; retired: boolean; online: boolean; battery: number }>()
  keys: string[] = []
  down = false
  simulated = new Map<string, { online: boolean; battery: number }>()
  lastCreateCompany: unknown = null

  private check(): void {
    if (this.down) throw new HttpError(502, 'platform_unavailable', 'The platform does not answer')
  }

  listCompanies(): Promise<PlatformCompany[]> {
    this.check()
    return Promise.resolve(this.companiesList.map((c) => ({ ...c })))
  }

  createCompany(input: { name: string; subdomain: string; adminEmail: string }): Promise<PlatformCompany> {
    this.check()
    this.lastCreateCompany = input
    if (this.companiesList.some((c) => c.subdomain === input.subdomain)) {
      return Promise.reject(new HttpError(409, 'subdomain_taken', `The subdomain "${input.subdomain}" is taken`))
    }
    const company = { id: randomUUID(), name: input.name, subdomain: input.subdomain, createdAt: new Date().toISOString() }
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
    return Promise.resolve(this.roles.get(companyId)!.map((r) => ({ ...r })))
  }

  async createRole(companyId: string, input: { name: string; permissions: string[] }): Promise<PlatformRole> {
    await this.listRoles(companyId)
    const role = { id: randomUUID(), name: input.name, permissions: input.permissions, locked: false }
    this.roles.get(companyId)!.push(role)
    return role
  }

  async deleteRole(companyId: string, roleId: string): Promise<void> {
    await this.listRoles(companyId)
    this.roles.set(companyId, this.roles.get(companyId)!.filter((r) => r.id !== roleId))
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
        .map((id) => ({ id, robot: this.robots.get(id) }))
        .filter((item) => item.robot)
        .map((item) => ({ id: item.id, online: item.robot!.online, battery: item.robot!.battery })),
    )
  }
}

export interface TestApp {
  base: string
  platform: FakePlatform
  store: SellerStore
  service: SellerService
  close: () => Promise<void>
  call: (method: string, path: string, options?: { as?: string | null; body?: unknown; origin?: string }) => Promise<{ status: number; json: any; headers: Headers }>
}

export const ADMIN = 'docent@howest.be'

export async function startApp(): Promise<TestApp> {
  const store = new SellerStore(openDatabase(':memory:'))
  seedModels(store)
  const platform = new FakePlatform()
  const service = new SellerService(store, platform, {
    sellerAdminEmails: [ADMIN],
    robotApiUrl: 'http://platform.test/graphql',
  })
  const server: Server = createSellerApi({
    service,
    verifier: new DevTokenVerifier(),
    corsOrigins: ['http://localhost:5174'],
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  return {
    base,
    platform,
    store,
    service,
    close: () => new Promise((resolve) => server.close(() => resolve())),
    async call(method, path, options = {}) {
      const as = options.as === undefined ? ADMIN : options.as
      const response = await fetch(base + path, {
        method,
        headers: {
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(as ? { authorization: `Bearer dev:${as}` } : {}),
          ...(options.origin ? { origin: options.origin } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      const raw = await response.text()
      return { status: response.status, json: raw ? JSON.parse(raw) : null, headers: response.headers }
    },
  }
}
