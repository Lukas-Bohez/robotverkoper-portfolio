import { Module } from '@nestjs/common'
import { AuditModule } from '../audit/audit.module.js'
import { CompaniesModule } from '../companies/companies.module.js'
import { RolesResolver } from './roles.resolver.js'
import { RolesService } from './roles.service.js'

@Module({
  imports: [CompaniesModule, AuditModule],
  providers: [RolesService, RolesResolver],
  exports: [RolesService],
})
export class RolesModule {}
