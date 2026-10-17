import { describe, expect, it } from 'vitest'
import type { Defect } from '@/api/types'
import {
  batteryHoursLeft,
  byDistance,
  byUrgency,
  cargoCleared,
  checklistProgress,
  foodSafeUntil,
  isMine,
  timeline,
  walkingMinutes,
} from '../defects'

const defect = (changes: Partial<Defect> = {}): Defect =>
  ({
    id: 'd1',
    summary: 'Robot staat scheef',
    severity: 'MEDIUM',
    status: 'OPEN',
    reportedBy: 'docent@howest.be',
    assignedTo: null,
    createdAt: '2026-10-16T12:12:00.000Z',
    checklistDone: [],
    condition: null,
    distanceMeters: null,
    ...changes,
  }) as Defect

describe('food in the robot', () => {
  it('stays safe for 33 minutes after it went in', () => {
    expect(foodSafeUntil('2026-10-16T12:12:00.000Z').toISOString()).toBe('2026-10-16T12:45:00.000Z')
  })

  it('has to come out before the work goes on, but only when there is food', () => {
    const withFood = { condition: { hasCargo: true } } as Defect
    expect(cargoCleared({ ...withFood, checklistDone: [] })).toBe(false)
    expect(cargoCleared({ ...withFood, checklistDone: ['cargo_removed'] })).toBe(true)
    expect(cargoCleared(defect())).toBe(true)
  })
})

describe('estimates', () => {
  it('turns a battery percentage into half hours', () => {
    expect(batteryHoursLeft(41)).toBe(2)
    expect(batteryHoursLeft(12)).toBe(0.5)
    expect(batteryHoursLeft(0)).toBe(0)
  })

  it('walks at about 80 meters a minute, never less than a minute', () => {
    expect(walkingMinutes(640)).toBe(8)
    expect(walkingMinutes(5)).toBe(1)
  })
})

describe('the safety check', () => {
  it('counts the items that are done', () => {
    expect(checklistProgress(['robot_stable', 'cargo_removed', 'iets-anders'])).toEqual({ done: 2, total: 4 })
  })
})

describe('whose defect is it', () => {
  it('is mine when I took it and it still needs work', () => {
    expect(isMine(defect({ assignedTo: 'tech@x.be', status: 'EN_ROUTE' }), 'tech@x.be')).toBe(true)
    expect(isMine(defect({ assignedTo: 'tech@x.be', status: 'CLOSED' }), 'tech@x.be')).toBe(false)
    expect(isMine(defect({ assignedTo: 'andere@x.be', status: 'EN_ROUTE' }), 'tech@x.be')).toBe(false)
  })
})

describe('sorting', () => {
  it('puts the nearest first and the ones without a distance last', () => {
    const list = [defect({ id: 'a', distanceMeters: 340 }), defect({ id: 'b', distanceMeters: null }), defect({ id: 'c', distanceMeters: 120 })]
    expect(byDistance(list).map(d => d.id)).toEqual(['c', 'a', 'b'])
  })

  it('puts food on board first, then how bad it is, then the oldest', () => {
    const list = [
      defect({ id: 'low', severity: 'LOW' }),
      defect({ id: 'cargo', severity: 'LOW', condition: { hasCargo: true } as Defect['condition'] }),
      defect({ id: 'high', severity: 'HIGH' }),
    ]
    expect(byUrgency(list).map(d => d.id)).toEqual(['cargo', 'high', 'low'])
  })
})

describe('timeline', () => {
  it('tells the story of a defect and shows the next step lighter', () => {
    const events = timeline(
      defect({
        status: 'EN_ROUTE',
        assignedTo: 'tech@x.be',
        claimedAt: '2026-10-16T12:20:00.000Z',
        distanceMeters: 640,
        condition: { hasCargo: true, tilted: true, capturedAt: '2026-10-16T12:14:00.000Z' } as Defect['condition'],
      }),
    )
    expect(events.map(e => e.key)).toEqual(['reported', 'condition', 'claimed', 'enroute', 'next'])
    expect(events.find(e => e.key === 'enroute')?.values).toEqual({ minutes: 8 })
    expect(events.at(-1)?.pending).toBe(true)
  })

  it('ends with how it was resolved', () => {
    const events = timeline(
      defect({ status: 'CLOSED', claimedAt: '2026-10-16T12:20:00.000Z', onSiteAt: '2026-10-16T12:30:00.000Z', resolvedAt: '2026-10-16T13:00:00.000Z', resolution: 'REPAIRED' }),
    )
    expect(events.map(e => e.key)).toEqual(['reported', 'claimed', 'onsite', 'resolved'])
  })
})
