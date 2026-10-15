/** What the seller API (Lukas/seller-api) sends. The contract is in Lukas/CONTRACT.md. */

export type SellerRole = 'admin' | 'technician'

export type Permission =
  | 'companies:read'
  | 'companies:create'
  | 'company-roles:manage'
  | 'robots:read'
  | 'robots:create'
  | 'defects:read'
  | 'defects:manage'
  | 'accounts:manage'
  | 'audit:read'

export type RobotKind = 'FOOD' | 'PARCEL'
export type TemperatureType = 'WARM' | 'COLD' | 'NEUTRAL'
export type RobotStatus = 'online' | 'offline' | 'defect' | 'unknown'
export type DefectSeverity = 'low' | 'medium' | 'high'

/** Where a list comes from: the platform itself, or our last known copy when it does not answer */
export type Source = 'platform' | 'cache'

export interface Me {
  email: string
  role: SellerRole | null
  permissions: Permission[]
}

export interface Company {
  id: string
  name: string
  subdomain: string
  createdAt: string
  robotCount: number
  openDefects: number
}

export interface RobotModel {
  id: string
  name: string
  kind: RobotKind
  description: string
}

export interface Robot {
  id: string
  companyId: string
  name: string
  model: { id: string; name: string; kind: RobotKind } | null
  temperatureType: TemperatureType | null
  apiKeyPrefix: string
  online: boolean | null
  battery: number | null
  status: RobotStatus
  openDefectId: string | null
  lastSeenAt: string | null
}

export interface Defect {
  id: string
  robot: { id: string; name: string }
  company: { id: string; name: string }
  summary: string
  severity: DefectSeverity
  status: 'open' | 'replaced' | 'closed'
  reportedBy: string
  createdAt: string
  resolvedAt: string | null
  replacementRobotId: string | null
}

export interface CompanyRole {
  id: string
  name: string
  permissions: string[]
  locked: boolean
}

export interface Account {
  email: string
  role: SellerRole
  createdBy: string | null
  createdAt: string | null
}

export interface AuditEntry {
  id: number
  at: string
  actor: string
  action: string
  target: string | null
  detail: string | null
}

export interface List<T> {
  items: T[]
  source?: Source
}
