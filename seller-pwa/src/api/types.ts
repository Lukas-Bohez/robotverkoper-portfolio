/**
 * What the seller API (Lukas/seller-api) sends. The types come from its GraphQL schema: `npm run generate` in
 * Lukas/seller-types turns the schema into `@robotverkoper/seller-types`. Here only the things the schema cannot
 * say: the permission keys (a list of strings in GraphQL) and a few handy names.
 */
export type {
  Account,
  AuditEntry,
  Company,
  CompanyList,
  CompanyRole,
  CreatedRobot,
  Defect,
  DefectSeverity,
  DefectStatus,
  DefectsChanged,
  Me,
  ModelKind,
  PairingCollection,
  PlatformSource,
  ReplacedRobot,
  Robot,
  RobotList,
  RobotModel,
  RobotStatus,
  SellerRole,
  WaitingPairing,
} from '@robotverkoper/seller-types'

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
