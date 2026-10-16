import type { DefectSeverity, RobotStatus } from '@/api/types'

type BadgeColor = 'success' | 'error' | 'warning' | 'neutral'

/** The colour of the status badge of a robot (never colour alone: the badge also has a word) */
export function statusColor(status: RobotStatus): BadgeColor {
  switch (status) {
    case 'ONLINE':
      return 'success'
    case 'DEFECT':
      return 'error'
    default:
      return 'neutral'
  }
}

export function severityColor(severity: DefectSeverity): BadgeColor {
  return severity === 'HIGH' ? 'error' : severity === 'MEDIUM' ? 'warning' : 'neutral'
}

/**
 * The enums of the GraphQL schema are uppercase (ONLINE, FOOD, HIGH); the translations use lowercase keys
 * (`robots.states.online`), so a label is looked up with this.
 */
export function enumKey(value: string): string {
  return value.toLowerCase()
}
