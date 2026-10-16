import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AccountsModule } from '../accounts/accounts.module.js'
import { AuditEntry } from '../audit/entities/audit-entry.entity.js'
import { CompaniesModule } from '../companies/companies.module.js'
import { DefectsModule } from '../defects/defects.module.js'
import { Defect } from '../defects/entities/defect.entity.js'
import { RobotsModule } from '../robots/robots.module.js'
import { RolePresetsModule } from '../role-presets/role-presets.module.js'
import { SellerRolesModule } from '../seller-roles/seller-roles.module.js'
import { ArchiveResolver } from './archive.resolver.js'
import { ArchiveService } from './archive.service.js'
import { ColdStorageService } from './cold-storage.service.js'

@Module({
  imports: [
    TypeOrmModule.forFeature([Defect, AuditEntry]),
    AccountsModule,
    SellerRolesModule,
    RolePresetsModule,
    CompaniesModule,
    RobotsModule,
    DefectsModule,
  ],
  providers: [ArchiveService, ArchiveResolver, ColdStorageService],
  exports: [ColdStorageService],
})
export class ArchiveModule {}
