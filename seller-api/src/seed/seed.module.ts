import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module.js'
import { ArchiveModule } from '../archive/archive.module.js'
import { DatabaseModule } from '../database/database.module.js'
import { DefectsModule } from '../defects/defects.module.js'
import { RobotsModule } from '../robots/robots.module.js'
import { RolePresetsModule } from '../role-presets/role-presets.module.js'
import { SellerRolesModule } from '../seller-roles/seller-roles.module.js'
import { CommandModule } from './nestjs-command.js'
import { SeedCommand } from './seed.command.js'
import { SeedService } from './seed.service.js'

@Module({
  imports: [
    CommandModule,
    DatabaseModule,
    RobotsModule,
    DefectsModule,
    AccountsModule,
    SellerRolesModule,
    RolePresetsModule,
    ArchiveModule,
  ],
  providers: [SeedService, SeedCommand],
  exports: [SeedService],
})
export class SeedModule {}
