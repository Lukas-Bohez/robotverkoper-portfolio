import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { HttpError, readJson, sendJson, text } from './http.ts'
import { isPermission, PERMISSIONS } from './permissions.ts'
import { handleRobotGraphql } from './robot-api.ts'

export interface Company {
  id: string
  name: string
  subdomain: string
  adminEmail: string
  createdAt: string
}

/** The name of a role per language (nl, en, fr, de); a language may be left out */
export type Names = Partial<Record<'nl' | 'en' | 'fr' | 'de', string>>
const LANGUAGES = ['nl', 'en', 'fr', 'de'] as const

export interface Role {
  id: string
  companyId: string
  name: string
  /** The name in the other languages: the seller part shows it in the language of the person */
  names: Names | null
  permissions: string[]
  /** The administrator role of a company: all rights, cannot be changed or archived */
  locked: boolean
  /** Soft delete: an archived role is kept and can be restored */
  archivedAt: string | null
}

export type ModelKind = 'FOOD' | 'PARCEL'

export type LidState = 'LOCKED' | 'UNLOCKED' | 'OPEN'

/** What a technician wants to know about a robot besides its battery: food inside, tilt, lid, error, place */
export interface Condition {
  tilted: boolean
  tiltDegrees: number | null
  hasCargo: boolean
  cargoSummary: string | null
  /** Since when the cargo is inside (ISO date) */
  cargoSince: string | null
  compartmentTemp: number | null
  lid: LidState
  errorCode: string | null
  errorText: string | null
  location: { country: string; address: string; longitude: number; latitude: number } | null
}

const LIDS: readonly string[] = ['LOCKED', 'UNLOCKED', 'OPEN']

export interface Robot {
  id: string
  companyId: string
  modelKind: ModelKind
  name: string
  apiKeyPrefix: string
  /** SHA-256 of the key: how the robot is recognised when it talks to /graphql */
  keyHash: string
  /** What was last reported (or set by hand, see `pinned`) */
  online: boolean
  battery: number | null
  lastSeenAt: string | null
  /** Set by hand (a demo of "the robot goes offline") until the robot reports itself again */
  pinned: boolean
  retired: boolean
  /** The condition the robot reported (or that was set by hand); null while nothing is known */
  condition: Condition | null
  createdAt: string
}

export interface SeedCompany {
  id: string
  name: string
  subdomain: string
  adminEmail: string
  createdAt: string
}

export interface Snapshot {
  companies: Company[]
  roles: Role[]
  robots: Robot[]
}

export interface SimulatorOptions {
  /** The shared secret the seller API sends as `Authorization: Bearer <token>` */
  token: string
  companies?: SeedCompany[]
  now?: () => Date
  /** A saved state to start from (the seed companies are then ignored) */
  restoreFrom?: Snapshot | null
  /** Called after every change, so a program can save the state */
  onChange?: (snapshot: Snapshot) => void
}

/** Subdomains the platform keeps for itself (same list as the real API) */
const RESERVED = new Set(['www', 'api', 'app', 'admin', 'platform', 'localhost', 'mail', 'static'])
const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const KEY_PREFIX_LENGTH = 11
/** A robot that reported less than this long ago is online */
export const ONLINE_WINDOW_MS = 20_000

export function hashKey(apiKey: string): string {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex')
}

/** Same shape as the keys of the real platform: `rb_` + 32 random bytes (base64url) */
function generateApiKey(): string {
  return `rb_${randomBytes(32).toString('base64url')}`
}

function sameToken(presented: string, expected: string): boolean {
  const a = Buffer.from(presented)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The platform of the companies, played by a small program: companies, their roles and the robots
 * with a key. It keeps everything in memory (a restart starts from the seed), so the seller part
 * of Lukas never holds real company data. The contract is described in Lukas/CONTRACT.md.
 */
export class PlatformState {
  readonly companies = new Map<string, Company>()
  readonly roles = new Map<string, Role>()
  readonly robots = new Map<string, Robot>()
  private readonly now: () => Date

  constructor(seed: SeedCompany[] = [], now: () => Date = () => new Date()) {
    this.now = now
    for (const company of seed) {
      this.companies.set(company.id, { ...company })
      this.addDefaultRoles(company.id)
    }
  }

  /** Every company starts with an administrator and a staff role, like the real platform */
  private addDefaultRoles(companyId: string): void {
    const defaults: [string, Names | null, string[], boolean][] = [
      ['TENANT_ADMIN', null, [...PERMISSIONS], true],
      ['Personeel', { nl: 'Personeel', en: 'Staff', fr: 'Personnel', de: 'Personal' }, ['orders:read'], false],
    ]
    for (const [name, names, permissions, locked] of defaults) {
      const role: Role = { id: randomUUID(), companyId, name, names, permissions, locked, archivedAt: null }
      this.roles.set(role.id, role)
    }
  }

  createCompany(input: Record<string, unknown>): Company {
    const name = text(input.name, 'name', 2, 60)
    const subdomain = text(input.subdomain, 'subdomain', 2, 30).toLowerCase()
    const adminEmail = text(input.adminEmail, 'adminEmail', 3, 120).toLowerCase()
    if (!SUBDOMAIN.test(subdomain)) {
      throw new HttpError(400, 'invalid_subdomain', 'A subdomain has letters, digits and hyphens, not at the start or end')
    }
    if (RESERVED.has(subdomain)) throw new HttpError(400, 'reserved_subdomain', `"${subdomain}" is reserved`)
    if (!EMAIL.test(adminEmail)) throw new HttpError(400, 'invalid_email', 'adminEmail is not an email address')
    for (const company of this.companies.values()) {
      if (company.subdomain === subdomain) {
        throw new HttpError(409, 'subdomain_taken', `The subdomain "${subdomain}" is taken`)
      }
    }
    const company: Company = { id: randomUUID(), name, subdomain, adminEmail, createdAt: this.now().toISOString() }
    this.companies.set(company.id, company)
    this.addDefaultRoles(company.id)
    return company
  }

  company(id: string): Company {
    const company = this.companies.get(id)
    if (!company) throw new HttpError(404, 'company_not_found', 'This company does not exist')
    return company
  }

  /** The permission list of a request: known keys only, each once */
  private permissionsOf(value: unknown): string[] {
    if (!Array.isArray(value) || value.some((key) => typeof key !== 'string')) {
      throw new HttpError(400, 'invalid_input', 'permissions is a list of permission keys')
    }
    const unknown = (value as string[]).filter((key) => !isPermission(key))
    if (unknown.length > 0) {
      throw new HttpError(400, 'unknown_permission', `Unknown permission: ${unknown.join(', ')}`)
    }
    return [...new Set(value as string[])]
  }

  /** The names per language: only the languages that have a text (1-40 characters) */
  private namesOf(value: unknown): Names | null {
    if (value === undefined || value === null) return null
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new HttpError(400, 'invalid_input', 'names is an object with nl, en, fr and de')
    }
    const names: Names = {}
    for (const language of LANGUAGES) {
      const given = (value as Record<string, unknown>)[language]
      if (given === undefined || given === null || given === '') continue
      names[language] = text(given, `names.${language}`, 1, 40)
    }
    return Object.keys(names).length > 0 ? names : null
  }

  createRole(companyId: string, input: Record<string, unknown>): Role {
    this.company(companyId)
    const name = text(input.name, 'name', 2, 40)
    const permissions = this.permissionsOf(input.permissions)
    const names = this.namesOf(input.names)
    // A name stays taken by an archived role too: bring that one back instead of making a second
    for (const role of this.roles.values()) {
      if (role.companyId === companyId && role.name.toLowerCase() === name.toLowerCase()) {
        throw new HttpError(409, 'role_exists', `The role "${name}" already exists`)
      }
    }
    const role: Role = { id: randomUUID(), companyId, name, names, permissions, locked: false, archivedAt: null }
    this.roles.set(role.id, role)
    return role
  }

  private role(companyId: string, roleId: string): Role {
    const role = this.roles.get(roleId)
    if (!role || role.companyId !== companyId) throw new HttpError(404, 'role_not_found', 'This role does not exist')
    return role
  }

  /** Changes the name, the names per language and/or the rights; the administrator role cannot be changed */
  updateRole(companyId: string, roleId: string, input: Record<string, unknown>): Role {
    const role = this.role(companyId, roleId)
    if (role.locked) throw new HttpError(409, 'role_locked', 'The administrator role cannot be changed')
    if (input.name !== undefined) {
      const name = text(input.name, 'name', 2, 40)
      const taken = [...this.roles.values()].some(
        (other) => other.id !== role.id && other.companyId === companyId && other.name.toLowerCase() === name.toLowerCase(),
      )
      if (taken) throw new HttpError(409, 'role_exists', `The role "${name}" already exists`)
      role.name = name
    }
    if (input.names !== undefined) role.names = this.namesOf(input.names)
    if (input.permissions !== undefined) role.permissions = this.permissionsOf(input.permissions)
    return role
  }

  /** Soft delete: the role is kept and can be restored. Calling it twice is fine. */
  archiveRole(companyId: string, roleId: string): Role {
    const role = this.role(companyId, roleId)
    if (role.locked) throw new HttpError(409, 'role_locked', 'The administrator role cannot be archived')
    role.archivedAt ??= this.now().toISOString()
    return role
  }

  restoreRole(companyId: string, roleId: string): Role {
    const role = this.role(companyId, roleId)
    role.archivedAt = null
    return role
  }

  /** The roles of a company; archived ones only when asked for */
  rolesOf(companyId: string, withArchived = false): Role[] {
    this.company(companyId)
    return [...this.roles.values()].filter((role) => role.companyId === companyId && (withArchived || !role.archivedAt))
  }

  /** Registers a robot and hands out its key: the only time the key is visible */
  registerRobot(input: Record<string, unknown>): { robot: Robot; apiKey: string } {
    const company = this.company(String(input.companyId ?? ''))
    const name = text(input.name, 'name', 2, 120)
    const modelKind = input.modelKind
    if (modelKind !== 'FOOD' && modelKind !== 'PARCEL') {
      throw new HttpError(400, 'invalid_input', 'modelKind is FOOD or PARCEL')
    }
    // One kind of food robot: insulated. There is no warm, cold or neutral to choose.
    const apiKey = generateApiKey()
    const robot: Robot = {
      id: randomUUID(),
      companyId: company.id,
      modelKind,
      name,
      apiKeyPrefix: apiKey.slice(0, KEY_PREFIX_LENGTH),
      keyHash: hashKey(apiKey),
      online: false,
      battery: null,
      lastSeenAt: null,
      pinned: false,
      retired: false,
      condition: null,
      createdAt: this.now().toISOString(),
    }
    this.robots.set(robot.id, robot)
    return { robot, apiKey }
  }

  robot(id: string): Robot {
    const robot = this.robots.get(id)
    if (!robot) throw new HttpError(404, 'robot_not_found', 'This robot does not exist')
    return robot
  }

  /** The key stops working and the robot goes offline. Calling it twice is fine. */
  retire(id: string): Robot {
    const robot = this.robot(id)
    robot.retired = true
    robot.online = false
    return robot
  }

  /** Takes a retired robot back into service: its key works again (the robot reports itself to come online) */
  reinstate(id: string): Robot {
    const robot = this.robot(id)
    robot.retired = false
    return robot
  }

  /**
   * What the robot reports about itself besides its battery (or what a demo sets by hand): tilt, food inside, lid,
   * temperature, error and place. Only the fields that are given change; the rest stays as it was.
   */
  setCondition(id: string, input: Record<string, unknown>): Condition {
    const robot = this.robot(id)
    const before: Condition = robot.condition ?? {
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
    }
    const next: Condition = { ...before }
    const has = (key: string) => input[key] !== undefined
    const flag = (key: string): boolean => {
      if (typeof input[key] !== 'boolean') throw new HttpError(400, 'invalid_input', `${key} is true or false`)
      return input[key]
    }
    const number = (key: string, min: number, max: number): number | null => {
      if (input[key] === null) return null
      const value = input[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw new HttpError(400, 'invalid_input', `${key} is a number from ${min} to ${max}`)
      }
      return value
    }
    const words = (key: string, max: number): string | null => (input[key] === null ? null : text(input[key], key, 1, max))

    if (has('tilted')) next.tilted = flag('tilted')
    if (has('tiltDegrees')) next.tiltDegrees = number('tiltDegrees', 0, 180)
    if (has('hasCargo')) next.hasCargo = flag('hasCargo')
    if (has('cargoSummary')) next.cargoSummary = words('cargoSummary', 200)
    if (has('compartmentTemp')) next.compartmentTemp = number('compartmentTemp', -40, 100)
    if (has('errorCode')) next.errorCode = words('errorCode', 20)
    if (has('errorText')) next.errorText = words('errorText', 200)
    if (has('lid')) {
      if (typeof input.lid !== 'string' || !LIDS.includes(input.lid)) {
        throw new HttpError(400, 'invalid_input', 'lid is LOCKED, UNLOCKED or OPEN')
      }
      next.lid = input.lid as LidState
    }
    if (has('location')) {
      const place = input.location as Record<string, unknown> | null
      if (place === null) next.location = null
      else {
        if (typeof place !== 'object' || Array.isArray(place)) {
          throw new HttpError(400, 'invalid_input', 'location is an object or null')
        }
        const longitude = place.longitude
        const latitude = place.latitude
        const valid =
          typeof longitude === 'number' && longitude >= -180 && longitude <= 180 &&
          typeof latitude === 'number' && latitude >= -90 && latitude <= 90
        if (!valid) {
          throw new HttpError(400, 'invalid_input', 'location needs a longitude (-180 to 180) and a latitude (-90 to 90)')
        }
        next.location = {
          country: text(place.country ?? 'BE', 'location.country', 2, 2).toUpperCase(),
          address: text(place.address ?? '', 'location.address', 1, 200),
          longitude,
          latitude,
        }
      }
    }
    // Since when the food is inside: kept while it stays, set when it arrives, gone when it is taken out
    if (has('cargoSince')) next.cargoSince = input.cargoSince === null ? null : text(input.cargoSince, 'cargoSince', 10, 40)
    else if (next.hasCargo && !before.hasCargo) next.cargoSince = this.now().toISOString()
    if (!next.hasCargo) next.cargoSince = null
    if (!next.tilted) next.tiltDegrees = null
    robot.condition = next
    return next
  }

  /** The condition of the robots that have one (a robot that never reported one is left out) */
  conditions(ids: string[]): ({ id: string } & Condition)[] {
    return ids.flatMap((id) => {
      const robot = this.robots.get(id)
      return robot?.condition ? [{ id, ...robot.condition }] : []
    })
  }

  /** What a robot reports itself: used by a demo to play "the robot goes offline" */
  telemetry(id: string, input: Record<string, unknown>): Robot {
    const robot = this.robot(id)
    if (robot.retired) throw new HttpError(409, 'robot_retired', 'This robot is retired')
    if (typeof input.online === 'boolean') robot.online = input.online
    robot.pinned = true
    if (input.battery !== undefined) {
      const battery = Number(input.battery)
      if (!Number.isFinite(battery) || battery < 0 || battery > 100) {
        throw new HttpError(400, 'invalid_input', 'battery is a number from 0 to 100')
      }
      robot.battery = Math.round(battery)
    }
    return robot
  }

  snapshot(): Snapshot {
    return {
      companies: [...this.companies.values()],
      roles: [...this.roles.values()],
      robots: [...this.robots.values()],
    }
  }

  restore(snapshot: Snapshot): void {
    for (const company of snapshot.companies) this.companies.set(company.id, company)
    for (const role of snapshot.roles) {
      this.roles.set(role.id, { ...role, names: role.names ?? null, archivedAt: role.archivedAt ?? null })
    }
    for (const robot of snapshot.robots) {
      this.robots.set(robot.id, {
        ...robot,
        keyHash: robot.keyHash ?? '',
        lastSeenAt: robot.lastSeenAt ?? null,
        pinned: robot.pinned ?? false,
        condition: robot.condition ?? null,
      })
    }
  }

  /** The robot behind an API key (a retired robot has no working key) */
  robotByKey(apiKey: string): Robot | undefined {
    if (!apiKey) return undefined
    const hash = hashKey(apiKey)
    for (const robot of this.robots.values()) {
      if (!robot.retired && sameToken(hash, robot.keyHash)) return robot
    }
    return undefined
  }

  /** What the robot itself says: it is online and has this battery */
  report(robot: Robot, battery: number): void {
    robot.lastSeenAt = this.now().toISOString()
    robot.online = true
    robot.pinned = false
    robot.battery = Math.min(100, Math.max(0, Math.round(battery)))
  }

  /** A robot that reported itself is online while it keeps reporting; otherwise what was set */
  private liveOf(robot: Robot): { online: boolean; battery: number | null } {
    if (robot.retired) return { online: false, battery: robot.battery }
    if (robot.lastSeenAt !== null && !robot.pinned) {
      const age = this.now().getTime() - new Date(robot.lastSeenAt).getTime()
      return { online: age <= ONLINE_WINDOW_MS, battery: robot.battery }
    }
    return { online: robot.online, battery: robot.battery }
  }

  live(ids: string[]): { id: string; online: boolean; battery: number | null }[] {
    return ids
      .map((id) => this.robots.get(id))
      .filter((robot): robot is Robot => robot !== undefined)
      .map((robot) => ({ id: robot.id, ...this.liveOf(robot) }))
  }
}

type Handler = (match: RegExpMatchArray, body: Record<string, unknown>, url: URL) => { status: number; body: unknown }

/** The HTTP server: health without a token, everything else with `Authorization: Bearer <token>` */
export function createPlatformSimulator(options: SimulatorOptions): { server: Server; state: PlatformState } {
  const state = new PlatformState(options.restoreFrom ? [] : options.companies, options.now)
  if (options.restoreFrom) state.restore(options.restoreFrom)

  const routes: { method: string; pattern: RegExp; handler: Handler }[] = [
    { method: 'GET', pattern: /^\/companies$/, handler: () => ({ status: 200, body: [...state.companies.values()] }) },
    { method: 'POST', pattern: /^\/companies$/, handler: (_m, body) => ({ status: 201, body: state.createCompany(body) }) },
    {
      method: 'GET',
      pattern: /^\/companies\/([^/]+)\/roles$/,
      handler: (m, _b, url) => ({
        status: 200,
        body: state.rolesOf(m[1] ?? '', url.searchParams.get('withArchived') === 'true'),
      }),
    },
    {
      method: 'POST',
      pattern: /^\/companies\/([^/]+)\/roles$/,
      handler: (m, body) => ({ status: 201, body: state.createRole(m[1] ?? '', body) }),
    },
    {
      method: 'PATCH',
      pattern: /^\/companies\/([^/]+)\/roles\/([^/]+)$/,
      handler: (m, body) => ({ status: 200, body: state.updateRole(m[1] ?? '', m[2] ?? '', body) }),
    },
    {
      method: 'POST',
      pattern: /^\/companies\/([^/]+)\/roles\/([^/]+)\/archive$/,
      handler: (m) => ({ status: 200, body: state.archiveRole(m[1] ?? '', m[2] ?? '') }),
    },
    {
      method: 'POST',
      pattern: /^\/companies\/([^/]+)\/roles\/([^/]+)\/restore$/,
      handler: (m) => ({ status: 200, body: state.restoreRole(m[1] ?? '', m[2] ?? '') }),
    },
    {
      method: 'POST',
      pattern: /^\/robots\/([^/]+)\/reinstate$/,
      handler: (m) => {
        const robot = state.reinstate(m[1] ?? '')
        return { status: 200, body: { id: robot.id, retired: false } }
      },
    },
    {
      method: 'GET',
      pattern: /^\/robots\/conditions$/,
      handler: (_m, _b, url) => {
        const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean)
        return { status: 200, body: state.conditions(ids) }
      },
    },
    {
      method: 'PUT',
      pattern: /^\/robots\/([^/]+)\/condition$/,
      handler: (m, body) => ({ status: 200, body: state.setCondition(m[1] ?? '', body) }),
    },
    {
      method: 'POST',
      pattern: /^\/robots\/([^/]+)\/retire$/,
      handler: (m) => {
        const robot = state.retire(m[1] ?? '')
        return { status: 200, body: { id: robot.id, retired: true } }
      },
    },
    {
      method: 'POST',
      pattern: /^\/robots$/,
      handler: (_m, body) => {
        const { robot, apiKey } = state.registerRobot(body)
        return { status: 201, body: { id: robot.id, apiKey, apiKeyPrefix: robot.apiKeyPrefix } }
      },
    },
    {
      method: 'GET',
      pattern: /^\/robots\/live$/,
      handler: (_m, _b, url) => {
        const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean)
        return { status: 200, body: state.live(ids) }
      },
    },
    {
      method: 'POST',
      pattern: /^\/robots\/([^/]+)\/telemetry$/,
      handler: (m, body) => {
        const robot = state.telemetry(m[1] ?? '', body)
        return { status: 200, body: { id: robot.id, online: robot.online, battery: robot.battery } }
      },
    },
  ]

  /** The robot side: the robot app sends its API key in `x-api-key` (and may run in a browser, so CORS is open) */
  async function handleGraphql(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', 'content-type, x-api-key')
    res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST a GraphQL document here')
    const key = req.headers['x-api-key']
    const body = await readJson(req)
    // Like a GraphQL server: errors travel in a 200 answer
    sendJson(res, 200, handleRobotGraphql(state, typeof key === 'string' ? key : '', body))
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { status: 'ok', service: 'platform-simulator' })
      return
    }
    if (url.pathname === '/graphql') {
      await handleGraphql(req, res)
      return
    }
    const header = req.headers.authorization ?? ''
    const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
    if (!presented || !sameToken(presented, options.token)) {
      throw new HttpError(401, 'unauthorized', 'The platform token is missing or wrong')
    }
    const path = url.pathname.replace(/\/+$/, '') || '/'
    let pathMatched = false
    for (const route of routes) {
      const match = path.match(route.pattern)
      if (!match) continue
      pathMatched = true
      if (route.method !== req.method) continue
      const hasBody = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
      const body = hasBody ? await readJson(req) : {}
      const result = route.handler(match, body, url)
      if (req.method !== 'GET') options.onChange?.(state.snapshot())
      if (result.status === 204) {
        res.writeHead(204)
        res.end()
      } else {
        sendJson(res, result.status, result.body)
      }
      return
    }
    throw pathMatched
      ? new HttpError(405, 'method_not_allowed', 'This method is not allowed here')
      : new HttpError(404, 'not_found', 'Unknown route')
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { code: error.code, message: error.message })
        return
      }
      console.error(error)
      sendJson(res, 500, { code: 'internal', message: 'Something went wrong in the platform simulator' })
    })
  })
  return { server, state }
}
