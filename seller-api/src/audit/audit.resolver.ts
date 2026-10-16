import { Args, Int, Query, Resolver } from '@nestjs/graphql'
import { RequirePermissions } from '../authentication/decorators.js'
import { AuditService } from './audit.service.js'
import { AuditEntry } from './entities/audit-entry.entity.js'

@Resolver(() => AuditEntry)
export class AuditResolver {
  constructor(private readonly audit: AuditService) {}

  @RequirePermissions('audit:read')
  @Query(() => [AuditEntry], {
    description:
      'The latest changes at the robot seller (newest first). Filter per year; cold storage only on request.',
  })
  auditLog(
    @Args('limit', { type: () => Int, defaultValue: 50 }) limit: number,
    @Args('year', { type: () => Int, nullable: true }) year?: number,
    @Args('includeCold', { defaultValue: false }) includeCold?: boolean,
  ): Promise<AuditEntry[]> {
    return this.audit.latest(limit, year, includeCold)
  }
}
