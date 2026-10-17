import type { Defect, GeoPointInput, Robot, RobotCondition } from '@/api/types'
import { CHECKLIST_ITEMS } from '@/api/types'
import { isOpenStatus } from './status'

/** How long food stays safe in the insulated robot after it was put in (the design says: 14:12 → 14:45) */
export const FOOD_SAFE_MINUTES = 33

/** A rough walking speed, to say how long it takes to get to a robot ("aankomst over 8 minuten") */
const WALKING_METERS_PER_MINUTE = 80

/** A very rough estimate of the battery: 3 minutes per percent (41% is about 2 hours) */
const BATTERY_MINUTES_PER_PERCENT = 3

export function foodSafeUntil(cargoSince: string): Date {
  return new Date(new Date(cargoSince).getTime() + FOOD_SAFE_MINUTES * 60_000)
}

/** Hours left in the battery, rounded to half hours ("nog ± 2 uur") */
export function batteryHoursLeft(percent: number): number {
  return Math.round((percent * BATTERY_MINUTES_PER_PERCENT) / 30) / 2
}

export function walkingMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / WALKING_METERS_PER_MINUTE))
}

/** The robot has to be emptied first: the food comes out before anything else (the rule of the API too) */
export function hasCargo(defect: Pick<Defect, 'condition'>): boolean {
  return defect.condition?.hasCargo === true
}

/** Whether the safety check allows the next step: the food is out of the robot (or there never was any) */
export function cargoCleared(defect: Pick<Defect, 'condition' | 'checklistDone'>): boolean {
  return !hasCargo(defect) || defect.checklistDone.includes('cargo_removed')
}

/** How many items of the check are done, out of the total */
export function checklistProgress(done: readonly string[]): { done: number; total: number } {
  return { done: CHECKLIST_ITEMS.filter(item => done.includes(item)).length, total: CHECKLIST_ITEMS.length }
}

/** A defect is mine when I took it and it still needs work */
export function isMine(defect: Pick<Defect, 'assignedTo' | 'status'>, email: string): boolean {
  return defect.assignedTo === email && isOpenStatus(defect.status)
}

/** The distance in meters to the technician, when we know where the technician is */
export function distanceOf(defect: Pick<Defect, 'distanceMeters'>): number | null {
  return defect.distanceMeters ?? null
}

/** Nearest first; a defect without a distance goes last, and ties keep the oldest first */
export function byDistance<T extends Pick<Defect, 'distanceMeters' | 'createdAt'>>(defects: readonly T[]): T[] {
  return [...defects].sort((a, b) => {
    const da = a.distanceMeters ?? Number.POSITIVE_INFINITY
    const db = b.distanceMeters ?? Number.POSITIVE_INFINITY
    if (da !== db) return da - db
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
  })
}

/** The most urgent first: food on board, then how bad, then how long it has been open */
export function byUrgency<T extends Pick<Defect, 'condition' | 'severity' | 'createdAt'>>(defects: readonly T[]): T[] {
  const weight = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const
  return [...defects].sort((a, b) => {
    const cargo = Number(b.condition?.hasCargo === true) - Number(a.condition?.hasCargo === true)
    if (cargo !== 0) return cargo
    const severity = weight[a.severity] - weight[b.severity]
    if (severity !== 0) return severity
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
  })
}

/** "Route openen": the address in the maps app of the phone */
export function routeUrl(location: NonNullable<Robot['location'] | Defect['location']>): string {
  const [longitude, latitude] = location.geometry.coordinates
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
}

export function toGeoPoint(longitude: number, latitude: number): GeoPointInput {
  return { type: 'Point', coordinates: [longitude, latitude] }
}

export interface TimelineEvent {
  key: 'reported' | 'condition' | 'claimed' | 'enroute' | 'onsite' | 'resolved' | 'next'
  at: string | null
  /** True for a step that has not happened yet (shown lighter) */
  pending: boolean
  values: Record<string, string | number>
}

/**
 * The story of a defect for the screen "Verloop": reported, what the robot said, taken, on the way, arrived,
 * resolved. Steps that have not happened yet are shown lighter as the next step.
 */
export function timeline(defect: Defect): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const condition: RobotCondition | null | undefined = defect.condition
  events.push({ key: 'reported', at: defect.createdAt ?? null, pending: false, values: { by: defect.reportedBy } })
  if (condition && (condition.hasCargo || condition.tilted)) {
    events.push({
      key: 'condition',
      at: condition.capturedAt,
      pending: false,
      values: { cargo: Number(condition.hasCargo), tilted: Number(condition.tilted) },
    })
  }
  if (defect.claimedAt) {
    events.push({ key: 'claimed', at: defect.claimedAt, pending: false, values: { by: defect.assignedTo ?? '' } })
    if (!defect.onSiteAt && isOpenStatus(defect.status)) {
      const meters = defect.distanceMeters
      events.push({
        key: 'enroute',
        at: null,
        pending: false,
        values: meters == null ? {} : { minutes: walkingMinutes(meters) },
      })
    }
  }
  if (defect.onSiteAt) events.push({ key: 'onsite', at: defect.onSiteAt, pending: false, values: {} })
  if (defect.resolvedAt) {
    events.push({ key: 'resolved', at: defect.resolvedAt, pending: false, values: { resolution: defect.resolution ?? '' } })
  } else {
    events.push({ key: 'next', at: null, pending: true, values: {} })
  }
  return events
}
