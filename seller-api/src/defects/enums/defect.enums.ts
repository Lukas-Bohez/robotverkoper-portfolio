import { registerEnumType } from '@nestjs/graphql'

export enum DefectSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
registerEnumType(DefectSeverity, { name: 'DefectSeverity' })

/**
 * Where a defect is in its life. It is not stored: it follows from what happened to the defect (who took it,
 * whether the technician arrived, whether it was resolved or archived). See `DefectsService.getStatus`.
 */
export enum DefectStatusType {
  /** Nobody took it yet */
  OPEN = 'open',
  /** A technician took it and is on the way */
  EN_ROUTE = 'en_route',
  /** The technician is at the robot */
  ON_SITE = 'on_site',
  /** Resolved: repaired, or a false alarm */
  CLOSED = 'closed',
  /** Resolved by putting another robot in its place */
  REPLACED = 'replaced',
  /** Archived (soft delete) */
  ARCHIVED = 'archived',
  /** The data does not add up (for example an arrival without a technician) */
  UNKNOWN = 'unknown',
}
registerEnumType(DefectStatusType, {
  name: 'DefectStatusType',
  description: 'OPEN, EN_ROUTE and ON_SITE are not resolved yet; CLOSED, REPLACED and ARCHIVED are',
})

/** How a defect was resolved */
export enum DefectResolution {
  REPAIRED = 'repaired',
  FALSE_ALARM = 'false_alarm',
  REPLACED = 'replaced',
}
registerEnumType(DefectResolution, { name: 'DefectResolution' })

/** The statuses in which a defect still needs work */
export const OPEN_STATUSES: readonly DefectStatusType[] = [
  DefectStatusType.OPEN,
  DefectStatusType.EN_ROUTE,
  DefectStatusType.ON_SITE,
]

/** The safety check of a technician who arrives at a robot (the keys of the checklist) */
export const CHECKLIST_ITEMS = [
  'cargo_removed',
  'robot_stable',
  'lid_checked',
  'battery_measured',
] as const
export type ChecklistItem = (typeof CHECKLIST_ITEMS)[number]
