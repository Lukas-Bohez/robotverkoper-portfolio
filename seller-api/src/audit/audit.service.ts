import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MongoRepository } from 'typeorm'
import { AuditEntry } from './entities/audit-entry.entity.js'

export const MAX_AUDIT_ENTRIES = 200

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
        this.repository.create({ at: new Date(), actor, action, target, detail }),
      )
    } catch (error) {
      this.logger.error(
        `Could not write the audit entry ${action}`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  /** The newest entries first */
  async latest(limit = 50): Promise<AuditEntry[]> {
    const take = Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_AUDIT_ENTRIES)
    return this.repository.find({ order: { at: 'DESC' }, take })
  }
}
