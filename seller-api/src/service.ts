import { randomUUID } from 'node:crypto'
import { HttpError, email, oneOf, text } from './http.ts'
import {
  COMPANY_PERMISSIONS,
  SELLER_ROLES,
  permissionsOf,
  type SellerPermission,
  type SellerRole,
} from './permissions.ts'
import { PairingBook, type WaitingPairing } from './pairings.ts'
import { isPlatformUnavailable, type PlatformGateway, type PlatformRole, type RobotLive } from './platform.ts'
import type { AccountRow, AuditRow, CompanyRow, DefectRow, RobotModel, RobotRow, SellerStore } from './store.ts'

type Body = Record<string, unknown>
export type Source = 'platform' | 'cache'

export interface RobotView {
  id: string
  companyId: string
  name: string
  model: { id: string; name: string; kind: string } | null
  temperatureType: string | null
  apiKeyPrefix: string
  online: boolean | null
  battery: number | null
  status: 'online' | 'offline' | 'defect' | 'unknown'
  openDefectId: string | null
  lastSeenAt: string | null
}

export interface DefectView {
  id: string
  robot: { id: string; name: string }
  company: { id: string; name: string }
  summary: string
  severity: string
  status: string
  reportedBy: string
  createdAt: string
  resolvedAt: string | null
  replacementRobotId: string | null
}

const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/

/**
 * What the seller side does. It owns the robots, defects, staff and audit trail in its own
 * database, and asks the platform only for companies, roles, keys and live state.
 */
export class SellerService {
  private readonly store: SellerStore
  private readonly gateway: PlatformGateway
  private readonly configuredAdmins: ReadonlySet<string>
  private readonly robotApiUrl: string
  private readonly pairings: PairingBook

  constructor(
    store: SellerStore,
    gateway: PlatformGateway,
    options: { sellerAdminEmails: string[]; robotApiUrl?: string; pairings?: PairingBook },
  ) {
    this.store = store
    this.gateway = gateway
    this.configuredAdmins = new Set(options.sellerAdminEmails)
    this.robotApiUrl = options.robotApiUrl ?? ''
    this.pairings = options.pairings ?? new PairingBook()
  }

  // ---- who is who ----

  /** An address in SELLER_ADMIN_EMAILS is always an administrator; others need an account */
  roleOf(address: string): SellerRole | null {
    if (this.configuredAdmins.has(address)) return 'admin'
    return this.store.account(address)?.role ?? null
  }

  me(address: string): { email: string; role: SellerRole | null; permissions: readonly SellerPermission[] } {
    const role = this.roleOf(address)
    return { email: address, role, permissions: role ? permissionsOf(role) : [] }
  }

  // ---- catalogue ----

  models(): RobotModel[] {
    return this.store.listModels()
  }

  companyPermissions(): readonly string[] {
    return COMPANY_PERMISSIONS
  }

  // ---- companies ----

  async companies(): Promise<{ items: CompanyRow[]; source: Source }> {
    const source = await this.syncCompanies()
    return { items: this.store.listCompanies(), source }
  }

  private async syncCompanies(): Promise<Source> {
    try {
      this.store.replaceCompanies(await this.gateway.listCompanies())
      return 'platform'
    } catch (error) {
      if (!isPlatformUnavailable(error)) throw error
      return 'cache'
    }
  }

  async company(id: string): Promise<CompanyRow> {
    const known = this.store.company(id)
    if (known) return known
    await this.syncCompanies()
    const found = this.store.company(id)
    if (!found) throw new HttpError(404, 'company_not_found', 'This company does not exist')
    return found
  }

  async createCompany(actor: string, body: Body): Promise<CompanyRow> {
    const name = text(body.name, 'name', 2, 60)
    const subdomain = text(body.subdomain, 'subdomain', 2, 30).toLowerCase()
    if (!SUBDOMAIN.test(subdomain)) {
      throw new HttpError(400, 'invalid_subdomain', 'A subdomain has letters, digits and hyphens, not at the start or end')
    }
    const adminEmail = email(body.adminEmail, 'adminEmail')
    const created = await this.gateway.createCompany({ name, subdomain, adminEmail })
    this.store.upsertCompany(created)
    // The address of the first administrator belongs to the company: it is not kept here
    this.store.record(actor, 'company.created', created.id, `${created.name} (${created.subdomain})`)
    return this.store.company(created.id)!
  }

  // ---- robots ----

  async robots(companyId: string): Promise<{ items: RobotView[]; source: Source }> {
    await this.company(companyId)
    const rows = this.store.robotsOfCompany(companyId)
    const { live, source } = await this.liveState(rows)
    const openDefects = this.store.openDefectRobotIds(companyId)
    const models = new Map(this.store.listModels().map((model) => [model.id, model]))
    return {
      items: rows.map((row) => this.view(row, live.get(row.id) ?? null, models.get(row.modelId), openDefects.has(row.id))),
      source,
    }
  }

  private async liveState(rows: RobotRow[]): Promise<{ live: Map<string, RobotLive>; source: Source }> {
    const live = new Map<string, RobotLive>()
    if (rows.length === 0) return { live, source: 'platform' }
    try {
      for (const item of await this.gateway.robotsLive(rows.map((row) => row.id))) {
        live.set(item.id, item)
        this.store.saveLive(item.id, item.online, item.battery)
      }
      return { live, source: 'platform' }
    } catch (error) {
      if (!isPlatformUnavailable(error)) throw error
      return { live, source: 'cache' }
    }
  }

  private view(row: RobotRow, live: RobotLive | null, model: RobotModel | undefined, hasOpenDefect: boolean): RobotView {
    const known = live ?? (row.lastOnline === null ? null : { id: row.id, online: row.lastOnline, battery: row.lastBattery })
    const status = hasOpenDefect ? 'defect' : known === null ? 'unknown' : known.online ? 'online' : 'offline'
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      model: model ? { id: model.id, name: model.name, kind: model.kind } : null,
      temperatureType: row.temperatureType,
      apiKeyPrefix: row.apiKeyPrefix,
      online: known?.online ?? null,
      battery: known?.battery ?? null,
      status,
      openDefectId: hasOpenDefect ? (this.store.openDefectOfRobot(row.id)?.id ?? null) : null,
      lastSeenAt: row.lastSeenAt,
    }
  }

  /** Makes a robot and hands out its key. The key is shown once: only its first characters are kept. */
  async createRobot(actor: string, companyId: string, body: Body): Promise<{ robot: RobotView; apiKey: string }> {
    await this.company(companyId)
    const name = text(body.name, 'name', 2, 120)
    const model = this.store.model(text(body.modelId, 'modelId', 1, 60))
    if (!model) throw new HttpError(404, 'model_not_found', 'This robot model does not exist')
    const temperatureType = this.temperatureFor(model, body.temperatureType)

    const registered = await this.gateway.registerRobot({ companyId, modelKind: model.kind, name, temperatureType })
    try {
      this.store.transaction(() => {
        this.store.insertRobot({
          id: registered.id,
          companyId,
          modelId: model.id,
          name,
          temperatureType,
          apiKeyPrefix: registered.apiKeyPrefix,
          createdBy: actor,
        })
        this.store.record(actor, 'robot.created', registered.id, `${name}, ${model.name}, key ${registered.apiKeyPrefix}…`)
      })
    } catch (error) {
      // No record here: the key must not stay valid for a robot nobody knows
      await this.gateway.retireRobot(registered.id).catch(() => undefined)
      throw error
    }
    const row = this.store.robot(registered.id)!
    return { robot: this.view(row, null, model, false), apiKey: registered.apiKey }
  }

  private temperatureFor(model: RobotModel, value: unknown): 'WARM' | 'COLD' | 'NEUTRAL' | null {
    if (model.kind === 'PARCEL') {
      if (value !== undefined && value !== null) {
        throw new HttpError(400, 'temperature_not_allowed', 'A parcel robot has no temperature type')
      }
      return null
    }
    if (value === undefined || value === null) {
      throw new HttpError(400, 'temperature_required', 'A food robot needs a temperature type')
    }
    return oneOf(value, 'temperatureType', ['WARM', 'COLD', 'NEUTRAL'] as const)
  }

  // ---- roles of a company (kept by the platform, set up by us when a company starts) ----

  async roles(companyId: string): Promise<PlatformRole[]> {
    await this.company(companyId)
    return this.gateway.listRoles(companyId)
  }

  async createRole(actor: string, companyId: string, body: Body): Promise<PlatformRole> {
    const company = await this.company(companyId)
    const name = text(body.name, 'name', 2, 40)
    const permissions = body.permissions
    if (!Array.isArray(permissions) || permissions.some((key) => typeof key !== 'string')) {
      throw new HttpError(400, 'invalid_input', 'permissions is a list of permission keys')
    }
    const unknown = (permissions as string[]).filter((key) => !(COMPANY_PERMISSIONS as readonly string[]).includes(key))
    if (unknown.length > 0) throw new HttpError(400, 'unknown_permission', `Unknown permission: ${unknown.join(', ')}`)
    const role = await this.gateway.createRole(companyId, { name, permissions: permissions as string[] })
    this.store.record(actor, 'company-role.created', companyId, `${company.name}: ${role.name}`)
    return role
  }

  async deleteRole(actor: string, companyId: string, roleId: string): Promise<void> {
    const company = await this.company(companyId)
    const role = (await this.gateway.listRoles(companyId)).find((item) => item.id === roleId)
    if (!role) throw new HttpError(404, 'role_not_found', 'This role does not exist')
    if (role.locked) throw new HttpError(409, 'role_locked', 'The administrator role cannot be removed')
    await this.gateway.deleteRole(companyId, roleId)
    this.store.record(actor, 'company-role.deleted', companyId, `${company.name}: ${role.name}`)
  }

  // ---- defects ----

  reportDefect(actor: string, robotId: string, body: Body): DefectView {
    const robot = this.store.robot(robotId)
    if (!robot || robot.retiredAt) throw new HttpError(404, 'robot_not_found', 'This robot does not exist')
    const summary = text(body.summary, 'summary', 3, 200)
    const severity = oneOf(body.severity ?? 'medium', 'severity', ['low', 'medium', 'high'] as const)
    const id = randomUUID()
    this.store.transaction(() => {
      this.store.insertDefect({ id, robotId, summary, severity, reportedBy: actor })
      this.store.record(actor, 'defect.reported', robotId, `${robot.name}: ${summary}`)
    })
    return this.defectView(this.store.defect(id)!)
  }

  defects(onlyOpen: boolean): DefectView[] {
    return this.store.listDefects(onlyOpen).map((row) => this.defectView(row))
  }

  closeDefect(actor: string, defectId: string): DefectView {
    const defect = this.openDefect(defectId)
    this.store.transaction(() => {
      this.store.resolveDefect(defect.id, 'closed', null)
      this.store.record(actor, 'defect.closed', defect.robotId, defect.robotName)
    })
    return this.defectView(this.store.defect(defectId)!)
  }

  /**
   * Replaces a defective robot: its key stops working first (a robot with a defect may be lost
   * or stolen), then a new robot with a new key takes its place at the same company.
   */
  async replaceRobot(actor: string, defectId: string, body: Body): Promise<{ defect: DefectView; robot: RobotView; apiKey: string }> {
    const defect = this.openDefect(defectId)
    const old = this.store.robot(defect.robotId)!
    const model = this.store.model(old.modelId)!
    const name = body.name === undefined ? `${old.name} (vervanger)` : text(body.name, 'name', 2, 120)

    await this.gateway.retireRobot(old.id)
    const registered = await this.gateway.registerRobot({
      companyId: old.companyId,
      modelKind: model.kind,
      name,
      temperatureType: old.temperatureType,
    })
    this.store.transaction(() => {
      this.store.insertRobot({
        id: registered.id,
        companyId: old.companyId,
        modelId: old.modelId,
        name,
        temperatureType: old.temperatureType,
        apiKeyPrefix: registered.apiKeyPrefix,
        createdBy: actor,
      })
      this.store.retireRobot(old.id)
      this.store.resolveDefect(defect.id, 'replaced', registered.id)
      this.store.record(actor, 'robot.replaced', old.id, `${old.name} → ${name}, key ${registered.apiKeyPrefix}…`)
    })
    return {
      defect: this.defectView(this.store.defect(defectId)!),
      robot: this.view(this.store.robot(registered.id)!, null, model, false),
      apiKey: registered.apiKey,
    }
  }

  private openDefect(defectId: string): DefectRow {
    const defect = this.store.defect(defectId)
    if (!defect) throw new HttpError(404, 'defect_not_found', 'This defect does not exist')
    if (defect.status !== 'open') throw new HttpError(409, 'defect_not_open', 'This defect is already resolved')
    return defect
  }

  private defectView(row: DefectRow): DefectView {
    const company = this.store.company(row.companyId)
    return {
      id: row.id,
      robot: { id: row.robotId, name: row.robotName },
      company: { id: row.companyId, name: company?.name ?? '' },
      summary: row.summary,
      severity: row.severity,
      status: row.status,
      reportedBy: row.reportedBy,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
      replacementRobotId: row.replacementRobotId,
    }
  }

  // ---- the key goes straight to the simulator ----

  /** A simulator announces itself and waits for the key of a robot */
  createPairing(body: Body, loopback: boolean): { id: string; secret: string; code: string } {
    const device = text(body.device ?? 'Simulator', 'device', 1, 60)
    return this.pairings.create(device, loopback)
  }

  collectPairing(id: string, secret: string) {
    return this.pairings.collect(id, secret)
  }

  cancelPairing(id: string, secret: string): void {
    this.pairings.cancel(id, secret)
  }

  waitingPairings(): WaitingPairing[] {
    return this.pairings.waiting()
  }

  /**
   * Gives the key of a robot to a waiting simulator. Only the key of a robot we know is accepted
   * (its first characters must match what we stored), and nothing of it is written down here.
   */
  deliverToSimulator(actor: string, pairingId: string, body: Body): void {
    const robot = this.store.robot(text(body.robotId, 'robotId', 1, 80))
    const apiKey = text(body.apiKey, 'apiKey', 12, 200)
    if (!robot || robot.retiredAt) throw new HttpError(404, 'robot_not_found', 'This robot does not exist')
    if (apiKey.slice(0, robot.apiKeyPrefix.length) !== robot.apiKeyPrefix) {
      throw new HttpError(400, 'key_mismatch', 'This key does not belong to this robot')
    }
    const pairing = this.pairings.deliver(pairingId, { apiKey, robotName: robot.name, platformUrl: this.robotApiUrl })
    this.store.record(actor, 'robot.key-sent', robot.id, `${robot.name} → ${pairing.device} (${pairing.code}), key ${robot.apiKeyPrefix}…`)
  }

  // ---- our own staff ----

  accounts(): (AccountRow | { email: string; role: SellerRole; createdBy: null; createdAt: null })[] {
    const stored = this.store.listAccounts()
    const configured = [...this.configuredAdmins]
      .filter((address) => !stored.some((account) => account.email === address))
      .map((address) => ({ email: address, role: 'admin' as const, createdBy: null, createdAt: null }))
    return [...configured, ...stored].sort((a, b) => a.email.localeCompare(b.email))
  }

  addAccount(actor: string, body: Body): AccountRow {
    const address = email(body.email, 'email')
    const role = oneOf(body.role, 'role', SELLER_ROLES)
    if (this.configuredAdmins.has(address)) {
      throw new HttpError(409, 'managed_by_config', 'This administrator is set in SELLER_ADMIN_EMAILS')
    }
    this.store.upsertAccount(address, role, actor)
    this.store.record(actor, 'account.saved', address, role)
    return this.store.account(address)!
  }

  removeAccount(actor: string, address: string): void {
    if (this.configuredAdmins.has(address)) {
      throw new HttpError(409, 'managed_by_config', 'This administrator is set in SELLER_ADMIN_EMAILS')
    }
    if (address === actor) throw new HttpError(409, 'cannot_remove_self', 'You cannot remove your own account')
    if (!this.store.removeAccount(address)) throw new HttpError(404, 'account_not_found', 'This account does not exist')
    this.store.record(actor, 'account.removed', address)
  }

  audit(limit: number): AuditRow[] {
    return this.store.listAudit(limit)
  }
}
