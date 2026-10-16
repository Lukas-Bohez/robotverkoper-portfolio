import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { CompaniesModule } from '../companies/companies.module.js'
import { RolesModule } from '../roles/roles.module.js'
import { RolePreset } from './entities/role-preset.entity.js'
import { RolePresetsResolver } from './role-presets.resolver.js'
import { RolePresetsService } from './role-presets.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([RolePreset]), RolesModule, CompaniesModule, AuditModule],
  providers: [RolePresetsService, RolePresetsResolver],
  exports: [RolePresetsService],
})
export class RolePresetsModule {}
