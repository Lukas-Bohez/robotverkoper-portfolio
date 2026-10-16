import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditResolver } from './audit.resolver.js'
import { AuditService } from './audit.service.js'
import { AuditEntry } from './entities/audit-entry.entity.js'

@Module({
  imports: [TypeOrmModule.forFeature([AuditEntry])],
  providers: [AuditService, AuditResolver],
  exports: [AuditService],
})
export class AuditModule {}
