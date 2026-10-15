import type { DefectSeverity, RobotStatus } from '@/api/types'

type BadgeColor = 'success' | 'error' | 'warning' | 'neutral'

/** The colour of the status badge of a robot (never colour alone: the badge also has a word) */
export function statusColor(status: RobotStatus): BadgeColor {
  switch (status) {
    case 'online':
      return 'success'
    case 'defect':
      return 'error'
    default:
      return 'neutral'
  }
}

export function severityColor(severity: DefectSeverity): BadgeColor {
  return severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'neutral'
}
