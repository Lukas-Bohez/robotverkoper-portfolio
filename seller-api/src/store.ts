import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import type { ModelKind, PlatformCompany, TemperatureType } from './platform.ts'
import type { SellerRole } from './permissions.ts'

export type DefectSeverity = 'low' | 'medium' | 'high'
export type DefectStatus = 'open' | 'replaced' | 'closed'

export interface RobotModel {
  id: string
  name: string
  kind: ModelKind
  description: string
}

export interface CompanyRow {
  id: string
  name: string
  subdomain: string
  createdAt: string
  robotCount: number
  openDefects: number
}

export interface RobotRow {
  id: string
  companyId: string
  modelId: string
  name: string
  temperatureType: TemperatureType | null
  apiKeyPrefix: string
  createdBy: string
  createdAt: string
  retiredAt: string | null
  lastOnline: boolean | null
  lastBattery: number | null
  lastSeenAt: string | null
}

export interface DefectRow {
  id: string
  robotId: string
  robotName: string
  companyId: string
  summary: string
  severity: DefectSeverity
  status: DefectStatus
  reportedBy: string
  createdAt: string
  resolvedAt: string | null
  replacementRobotId: string | null
}

export interface AccountRow {
  email: string
  role: SellerRole
  createdBy: string
  createdAt: string
}

export interface AuditRow {
  id: number
  at: string
  actor: string
  action: string
  target: string | null
  detail: string | null
}

type Raw = Record<string, unknown>

function robot(row: Raw): RobotRow {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    modelId: row.model_id as string,
    name: row.name as string,
    temperatureType: row.temperature_type as TemperatureType | null,
    apiKeyPrefix: row.api_key_prefix as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    retiredAt: row.retired_at as string | null,
    lastOnline: row.last_online === null ? null : row.last_online === 1,
    lastBattery: row.last_battery as number | null,
    lastSeenAt: row.last_seen_at as string | null,
  }
}

function defect(row: Raw): DefectRow {
  return {
    id: row.id as string,
    robotId: row.robot_id as string,
    robotName: row.robot_name as string,
    companyId: row.company_id as string,
    summary: row.summary as string,
    severity: row.severity as DefectSeverity,
    status: row.status as DefectStatus,
    reportedBy: row.reported_by as string,
    createdAt: row.created_at as string,
    resolvedAt: row.resolved_at as string | null,
    replacementRobotId: row.replacement_robot_id as string | null,
  }
}

const DEFECT_SELECT = `
  SELECT d.*, r.name AS robot_name, r.company_id AS company_id
  FROM defects d JOIN robots r ON r.id = d.robot_id`

/** All SQL of the seller side, in one place. Nothing else touches the database. */
export class SellerStore {
  private readonly db: DatabaseSync
  private readonly now: () => Date

  constructor(db: DatabaseSync, now: () => Date = () => new Date()) {
    this.db = db
    this.now = now
  }

  private all(sql: string, ...params: SQLInputValue[]): Raw[] {
    return this.db.prepare(sql).all(...params) as Raw[]
  }

  private one(sql: string, ...params: SQLInputValue[]): Raw | undefined {
    return this.db.prepare(sql).get(...params) as Raw | undefined
  }

  private run(sql: string, ...params: SQLInputValue[]): void {
    this.db.prepare(sql).run(...params)
  }

  /** Everything inside succeeds, or nothing of it is kept */
  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN')
    try {
      const result = work()
      this.db.exec('COMMIT')
      return result
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  // ---- robot models: the catalogue of what we build ----

  upsertModels(models: RobotModel[]): void {
    for (const model of models) {
      this.run(
        `INSERT INTO robot_models (id, name, kind, description) VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, kind = excluded.kind, description = excluded.description`,
        model.id,
        model.name,
        model.kind,
        model.description,
      )
    }
  }

  listModels(): RobotModel[] {
    return this.all('SELECT * FROM robot_models ORDER BY kind, name') as unknown as RobotModel[]
  }

  model(id: string): RobotModel | undefined {
    return this.one('SELECT * FROM robot_models WHERE id = ?', id) as unknown as RobotModel | undefined
  }

  // ---- the small copy of the platform's companies ----

  /** Makes the copy equal to what the platform says (a company that is gone there is gone here) */
  replaceCompanies(companies: PlatformCompany[]): void {
    const syncedAt = this.now().toISOString()
    this.transaction(() => {
      for (const company of companies) this.upsertCompany(company, syncedAt)
      const keep = companies.map((company) => company.id)
      const marks = keep.map(() => '?').join(', ')
      this.run(`DELETE FROM companies WHERE id NOT IN (${marks || "''"})`, ...keep)
    })
  }

  upsertCompany(company: PlatformCompany, syncedAt: string = this.now().toISOString()): void {
    this.run(
      `INSERT INTO companies (id, name, subdomain, created_at, synced_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, subdomain = excluded.subdomain,
         created_at = excluded.created_at, synced_at = excluded.synced_at`,
      company.id,
      company.name,
      company.subdomain,
      company.createdAt,
      syncedAt,
    )
  }

  listCompanies(): CompanyRow[] {
    return this.all(
      `SELECT c.id, c.name, c.subdomain, c.created_at,
         (SELECT COUNT(*) FROM robots r WHERE r.company_id = c.id AND r.retired_at IS NULL) AS robot_count,
         (SELECT COUNT(*) FROM defects d JOIN robots r ON r.id = d.robot_id
            WHERE r.company_id = c.id AND d.status = 'open') AS open_defects
       FROM companies c ORDER BY c.name COLLATE NOCASE`,
    ).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      subdomain: row.subdomain as string,
      createdAt: row.created_at as string,
      robotCount: row.robot_count as number,
      openDefects: row.open_defects as number,
    }))
  }

  company(id: string): CompanyRow | undefined {
    return this.listCompanies().find((company) => company.id === id)
  }

  // ---- robots ----

  countRobots(): number {
    return (this.one('SELECT COUNT(*) AS n FROM robots') as { n: number }).n
  }

  insertRobot(input: {
    id: string
    companyId: string
    modelId: string
    name: string
    temperatureType: TemperatureType | null
    apiKeyPrefix: string
    createdBy: string
  }): void {
    this.run(
      `INSERT INTO robots (id, company_id, model_id, name, temperature_type, api_key_prefix, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id,
      input.companyId,
      input.modelId,
      input.name,
      input.temperatureType,
      input.apiKeyPrefix,
      input.createdBy,
      this.now().toISOString(),
    )
  }

  robot(id: string): RobotRow | undefined {
    const row = this.one('SELECT * FROM robots WHERE id = ?', id)
    return row ? robot(row) : undefined
  }

  robotsOfCompany(companyId: string): RobotRow[] {
    return this.all(
      'SELECT * FROM robots WHERE company_id = ? AND retired_at IS NULL ORDER BY created_at, name',
      companyId,
    ).map(robot)
  }

  retireRobot(id: string): void {
    this.run('UPDATE robots SET retired_at = ? WHERE id = ? AND retired_at IS NULL', this.now().toISOString(), id)
  }

  saveLive(id: string, online: boolean, battery: number | null): void {
    this.run(
      'UPDATE robots SET last_online = ?, last_battery = ?, last_seen_at = ? WHERE id = ?',
      online ? 1 : 0,
      battery,
      this.now().toISOString(),
      id,
    )
  }

  // ---- defects ----

  insertDefect(input: { id: string; robotId: string; summary: string; severity: DefectSeverity; reportedBy: string }): void {
    this.run(
      `INSERT INTO defects (id, robot_id, summary, severity, status, reported_by, created_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?)`,
      input.id,
      input.robotId,
      input.summary,
      input.severity,
      input.reportedBy,
      this.now().toISOString(),
    )
  }

  defect(id: string): DefectRow | undefined {
    const row = this.one(`${DEFECT_SELECT} WHERE d.id = ?`, id)
    return row ? defect(row) : undefined
  }

  openDefectOfRobot(robotId: string): DefectRow | undefined {
    const row = this.one(`${DEFECT_SELECT} WHERE d.robot_id = ? AND d.status = 'open' ORDER BY d.created_at LIMIT 1`, robotId)
    return row ? defect(row) : undefined
  }

  openDefectRobotIds(companyId: string): Set<string> {
    return new Set(
      this.all(
        `SELECT d.robot_id FROM defects d JOIN robots r ON r.id = d.robot_id
         WHERE r.company_id = ? AND d.status = 'open'`,
        companyId,
      ).map((row) => row.robot_id as string),
    )
  }

  listDefects(onlyOpen: boolean): DefectRow[] {
    const where = onlyOpen ? "WHERE d.status = 'open'" : ''
    return this.all(`${DEFECT_SELECT} ${where} ORDER BY d.created_at DESC`).map(defect)
  }

  resolveDefect(id: string, status: 'replaced' | 'closed', replacementRobotId: string | null): void {
    this.run(
      'UPDATE defects SET status = ?, resolved_at = ?, replacement_robot_id = ? WHERE id = ?',
      status,
      this.now().toISOString(),
      replacementRobotId,
      id,
    )
  }

  // ---- our own staff ----

  listAccounts(): AccountRow[] {
    return this.all('SELECT * FROM accounts ORDER BY email').map((row) => ({
      email: row.email as string,
      role: row.role as SellerRole,
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
    }))
  }

  account(email: string): AccountRow | undefined {
    return this.listAccounts().find((account) => account.email === email)
  }

  upsertAccount(email: string, role: SellerRole, createdBy: string): void {
    this.run(
      `INSERT INTO accounts (email, role, created_by, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET role = excluded.role`,
      email,
      role,
      createdBy,
      this.now().toISOString(),
    )
  }

  removeAccount(email: string): boolean {
    const before = this.listAccounts().length
    this.run('DELETE FROM accounts WHERE email = ?', email)
    return this.listAccounts().length < before
  }

  // ---- audit trail ----

  record(actor: string, action: string, target: string | null = null, detail: string | null = null): void {
    this.run(
      'INSERT INTO audit (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)',
      this.now().toISOString(),
      actor,
      action,
      target,
      detail,
    )
  }

  listAudit(limit: number): AuditRow[] {
    return this.all('SELECT * FROM audit ORDER BY id DESC LIMIT ?', limit) as unknown as AuditRow[]
  }
}
