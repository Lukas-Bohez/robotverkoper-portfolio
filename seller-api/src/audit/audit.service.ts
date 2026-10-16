import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MongoRepository } from 'typeorm'
import { AuditEntry } from './entities/audit-entry.entity.js'

export const MAX_AUDIT_ENTRIES = 200

/** The first and the last moment of a calendar year (UTC), for the filter per year */
export function yearRange(year: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year + 1, 0, 1)),
  }
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(
    @InjectRepository(AuditEntry)
    private readonly repository: MongoRepository<AuditEntry>,
  ) {}

  /**
   * Writes one entry. A failing log must not undo the change that was just made, so a failure is logged
   * instead of thrown.
   */
  async record(
    actor: string,
    action: string,
    target: string | null = null,
    detail: string | null = null,
  ): Promise<void> {
    try {
      await this.repository.save(
        this.repository.create({ actor, action, target, detail, coldAt: null }),
      )
    } catch (error) {
      this.logger.error(
        `Could not write the audit entry ${action}`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  /**
   * The newest entries first. Entries in cold storage (older than a year) are only returned when asked for
   * (`includeCold`), and `year` limits the list to one calendar year.
   */
  async latest(limit = 50, year?: number | null, includeCold = false): Promise<AuditEntry[]> {
    const take = Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_AUDIT_ENTRIES)
    const where: Record<string, unknown> = {}
    if (!includeCold) where.coldAt = null
    if (year) {
      const { from, to } = yearRange(year)
      where.createdAt = { $gte: from, $lt: to }
    }
    return this.repository.find({ where: where as never, order: { createdAt: 'DESC' }, take })
  }
}
