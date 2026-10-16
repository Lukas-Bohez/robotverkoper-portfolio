import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MongoRepository } from 'typeorm'
import { AuditEntry } from '../audit/entities/audit-entry.entity.js'
import { Defect } from '../defects/entities/defect.entity.js'

/** Data that is older than this many months goes to cold storage */
export const COLD_AFTER_MONTHS = 12

export interface ColdStorageMoved {
  defects: number
  auditEntries: number
}

/** The moment before which data is "old": a number of months back from now */
export function coldCutoff(now: Date, months: number = COLD_AFTER_MONTHS): Date {
  const cutoff = new Date(now)
  const day = cutoff.getUTCDate()
  // Day 1 first: 31 March minus one month must be the end of February, not 3 March (JavaScript carries over)
  cutoff.setUTCDate(1)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  const lastDay = new Date(
    Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0),
  ).getUTCDate()
  cutoff.setUTCDate(Math.min(day, lastDay))
  return cutoff
}

/**
 * Cold storage for old data. A defect that was resolved long ago and an old line of the log are not needed day to
 * day: they leave the normal lists (and the heavy parts of a defect, like the condition of the robot, are dropped),
 * but they are kept and can be read per year on request.
 */
@Injectable()
export class ColdStorageService {
  constructor(
    @InjectRepository(Defect) private readonly defects: MongoRepository<Defect>,
    @InjectRepository(AuditEntry) private readonly audit: MongoRepository<AuditEntry>,
  ) {}

  /** Moves what is older than `months` months to cold storage. Safe to run again: it only moves what is still warm. */
  async moveOldData(
    now = new Date(),
    months: number = COLD_AFTER_MONTHS,
  ): Promise<ColdStorageMoved> {
    const cutoff = coldCutoff(now, months)
    const defects = await this.defects.updateMany(
      { resolvedAt: { $lt: cutoff }, coldAt: null },
      { $set: { coldAt: now, condition: null, checklistDone: [] } },
    )
    const auditEntries = await this.audit.updateMany(
      { createdAt: { $lt: cutoff }, coldAt: null },
      { $set: { coldAt: now } },
    )
    return { defects: defects.modifiedCount, auditEntries: auditEntries.modifiedCount }
  }

  /** The calendar years that have data in cold storage, newest first */
  async years(): Promise<number[]> {
    const [defects, entries] = await Promise.all([
      this.defects.find({ where: { coldAt: { $ne: null } } as never, withDeleted: true }),
      this.audit.find({ where: { coldAt: { $ne: null } } as never }),
    ])
    const years = new Set<number>()
    for (const defect of defects) if (defect.createdAt) years.add(defect.createdAt.getUTCFullYear())
    for (const entry of entries) years.add(entry.createdAt.getUTCFullYear())
    return [...years].sort((a, b) => b - a)
  }
}
