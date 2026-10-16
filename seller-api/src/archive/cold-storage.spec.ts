import { describe, expect, it } from 'vitest'
import { yearRange } from '../audit/audit.service.js'
import { COLD_AFTER_MONTHS, coldCutoff } from './cold-storage.service.js'

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

describe('coldCutoff: the moment before which data is old', () => {
  it('is twelve months back by default', () => {
    expect(COLD_AFTER_MONTHS).toBe(12)
    expect(coldCutoff(day('2026-10-16')).toISOString()).toBe('2025-10-16T12:00:00.000Z')
  })

  it('takes another number of months', () => {
    expect(coldCutoff(day('2026-10-16'), 6).toISOString()).toBe('2026-04-16T12:00:00.000Z')
    expect(coldCutoff(day('2026-01-15'), 2).toISOString()).toBe('2025-11-15T12:00:00.000Z')
  })

  it('does not move the day in the middle of a month', () => {
    expect(coldCutoff(day('2026-03-15'), 1).toISOString()).toBe('2026-02-15T12:00:00.000Z')
  })

  it('31 March minus one month is the end of February, not 3 March', () => {
    expect(coldCutoff(day('2026-03-31'), 1).toISOString()).toBe('2026-02-28T12:00:00.000Z')
    expect(coldCutoff(day('2028-03-31'), 1).toISOString()).toBe('2028-02-29T12:00:00.000Z')
  })

  it('29 February minus a year is 28 February', () => {
    expect(coldCutoff(day('2028-02-29')).toISOString()).toBe('2027-02-28T12:00:00.000Z')
  })

  it('does not change the date it was given', () => {
    const now = day('2026-10-16')
    coldCutoff(now)
    expect(now.toISOString()).toBe('2026-10-16T12:00:00.000Z')
  })
})

describe('yearRange: the filter per calendar year', () => {
  it('runs from 1 January up to, not including, 1 January of the next year (UTC)', () => {
    const { from, to } = yearRange(2025)
    expect(from.toISOString()).toBe('2025-01-01T00:00:00.000Z')
    expect(to.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('a moment in the last second of the year is in, the first moment of the next year is out', () => {
    const { from, to } = yearRange(2024)
    const lastSecond = new Date('2024-12-31T23:59:59.999Z')
    const nextYear = new Date('2025-01-01T00:00:00.000Z')
    expect(lastSecond >= from && lastSecond < to).toBe(true)
    expect(nextYear >= from && nextYear < to).toBe(false)
  })
})
