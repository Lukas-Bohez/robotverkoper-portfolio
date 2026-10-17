import type { DefectSeverity, DefectStatusType, RobotStatus } from '@/api/types'

export type BadgeColor = 'success' | 'error' | 'warning' | 'neutral' | 'primary'

/** The colour of the status badge of a robot (never colour alone: the badge also has a word) */
export function robotStatusColor(status: RobotStatus): BadgeColor {
  switch (status) {
    case 'ONLINE':
      return 'success'
    case 'DEFECT':
      return 'error'
    case 'STOCK':
      return 'primary'
    case 'OUT_OF_SERVICE':
      return 'warning'
    default:
      return 'neutral'
  }
}

/** The colour of the status badge of a defect: open is red, someone is on it blue, resolved green */
export function defectStatusColor(status: DefectStatusType): BadgeColor {
  switch (status) {
    case 'OPEN':
      return 'error'
    case 'EN_ROUTE':
    case 'ON_SITE':
      return 'primary'
    case 'CLOSED':
    case 'REPLACED':
      return 'success'
    case 'UNKNOWN':
      return 'warning'
    default:
      return 'neutral'
  }
}

export function severityColor(severity: DefectSeverity): BadgeColor {
  return severity === 'HIGH' ? 'error' : severity === 'MEDIUM' ? 'warning' : 'neutral'
}

/**
 * The enums of the GraphQL schema are uppercase (ONLINE, FOOD, HIGH, EN_ROUTE); the translations use lowercase keys
 * (`robots.states.online`, `defects.states.en_route`), so a label is looked up with this.
 */
export function enumKey(value: string): string {
  return value.toLowerCase()
}

/** The statuses in which a defect still needs work */
export const OPEN_STATUSES: readonly DefectStatusType[] = ['OPEN', 'EN_ROUTE', 'ON_SITE']

export function isOpenStatus(status: DefectStatusType): boolean {
  return OPEN_STATUSES.includes(status)
}
