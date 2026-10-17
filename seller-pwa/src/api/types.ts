/**
 * What the seller API (Lukas/seller-api) sends. The types come from its GraphQL schema: `npm run generate` in
 * Lukas/seller-types turns the schema into `@robotverkoper/seller-types`. Here only the things the schema cannot
 * say: the standard permission keys (a list of strings in GraphQL) and a few handy names.
 */
export type {
  Account,
  ArchiveKind,
  ArchivedItem,
  AuditEntry,
  ColdStorageResult,
  Company,
  CompanyList,
  CompanyRole,
  CreatedRobot,
  Defect,
  DefectResolution,
  DefectSeverity,
  DefectStatusType,
  DefectsChanged,
  GeoPointInput,
  LidState,
  LocalizedNames,
  Location,
  Me,
  ModelKind,
  NearbyDefect,
  PairingCollection,
  PermissionInfo,
  PlatformSource,
  ReplacedRobot,
  Robot,
  RobotCondition,
  RobotList,
  RobotModel,
  RobotStatus,
  RoleCopyResult,
  RolePreset,
  SellerRole,
  TechnicianCall,
  WaitingPairing,
} from '@robotverkoper/seller-types'

/** The standard rights of our own staff (a copy of SELLER_PERMISSIONS of the API; a role may hold more: extra claims) */
export const PERMISSIONS = [
  'companies:read',
  'companies:create',
  'companies:archive',
  'company-roles:manage',
  'robots:read',
  'robots:create',
  'robots:replace',
  'robots:archive',
  'defects:read',
  'defects:report',
  'defects:claim',
  'defects:close',
  'defects:call',
  'accounts:manage',
  'roles:manage',
  'audit:read',
  'archive:read',
  'archive:restore',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/** The languages of the app */
export const LANGUAGES = ['nl', 'en', 'fr', 'de'] as const
export type Language = (typeof LANGUAGES)[number]

/** The checks of a technician who arrives at a robot, in the order of the screen (the keys of the API) */
export const CHECKLIST_ITEMS = ['cargo_removed', 'robot_stable', 'lid_checked', 'battery_measured'] as const
export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number]
