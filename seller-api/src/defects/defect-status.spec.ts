import { describe, expect, it } from 'vitest'
import { defectStatus } from './defects.service.js'
import { DefectStatusType, OPEN_STATUSES } from './enums/defect.enums.js'

const t = (iso: string) => new Date(iso)
const REPORTED = t('2026-10-12T09:00:00.000Z')
const LATER = t('2026-10-12T10:00:00.000Z')
const EVEN_LATER = t('2026-10-12T11:00:00.000Z')

type Fields = Parameters<typeof defectStatus>[0]

/** A defect that was just reported: nothing happened to it yet */
const fresh = (changes: Partial<Fields> = {}): Fields => ({
  createdAt: REPORTED,
  claimedAt: null,
  onSiteAt: null,
  resolvedAt: null,
  replacementRobotId: null,
  deletedAt: null,
  ...changes,
})

describe('defectStatus: the status follows from what happened (the first matching row of the table wins)', () => {
  const rows: [string, Fields, DefectStatusType][] = [
    ['nothing happened', fresh(), DefectStatusType.OPEN],
    ['a technician took it', fresh({ claimedAt: LATER }), DefectStatusType.EN_ROUTE],
    ['the technician arrived', fresh({ claimedAt: LATER, onSiteAt: EVEN_LATER }), DefectStatusType.ON_SITE],
    ['resolved', fresh({ claimedAt: LATER, onSiteAt: LATER, resolvedAt: EVEN_LATER }), DefectStatusType.CLOSED],
    ['resolved without ever being taken', fresh({ resolvedAt: LATER }), DefectStatusType.CLOSED],
    [
      'resolved by a replacement',
      fresh({ claimedAt: LATER, resolvedAt: EVEN_LATER, replacementRobotId: 'robot-2' }),
      DefectStatusType.REPLACED,
    ],
    ['archived (open)', fresh({ deletedAt: EVEN_LATER }), DefectStatusType.ARCHIVED],
    ['archived (resolved)', fresh({ resolvedAt: LATER, deletedAt: EVEN_LATER }), DefectStatusType.ARCHIVED],
    ['arrived without a technician', fresh({ onSiteAt: LATER }), DefectStatusType.UNKNOWN],
    ['resolved before it was reported', fresh({ resolvedAt: t('2026-10-12T08:00:00.000Z') }), DefectStatusType.UNKNOWN],
    ['a replacement that is not resolved', fresh({ replacementRobotId: 'robot-2' }), DefectStatusType.UNKNOWN],
  ]

  it.each(rows)('%s', (_name, defect, expected) => {
    expect(defectStatus(defect)).toBe(expected)
  })

  it('archived beats everything else, also data that does not add up', () => {
    expect(defectStatus(fresh({ deletedAt: LATER, onSiteAt: LATER }))).toBe(DefectStatusType.ARCHIVED)
  })

  it('resolved at the very moment it was reported is fine (the boundary is strict)', () => {
    expect(defectStatus(fresh({ resolvedAt: REPORTED }))).toBe(DefectStatusType.CLOSED)
    expect(defectStatus(fresh({ resolvedAt: new Date(REPORTED.getTime() - 1) }))).toBe(DefectStatusType.UNKNOWN)
  })

  it('a replaced defect needs the moment it was resolved too, not only the new robot', () => {
    expect(defectStatus(fresh({ replacementRobotId: 'robot-2', resolvedAt: LATER }))).toBe(DefectStatusType.REPLACED)
  })

  it('only OPEN, EN_ROUTE and ON_SITE still need work', () => {
    const needsWork = [DefectStatusType.OPEN, DefectStatusType.EN_ROUTE, DefectStatusType.ON_SITE]
    expect([...OPEN_STATUSES]).toEqual(needsWork)
    for (const [name, defect, expected] of rows) {
      expect(OPEN_STATUSES.includes(defectStatus(defect)), name).toBe(needsWork.includes(expected))
    }
  })

  it('a defect without a known report date does not crash (an old document)', () => {
    expect(defectStatus(fresh({ createdAt: undefined as never, resolvedAt: LATER }))).toBe(DefectStatusType.CLOSED)
  })
})
