import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditModule } from '../audit/audit.module.js'
import { SellerRolesModule } from '../seller-roles/seller-roles.module.js'
import { AccountsResolver } from './accounts.resolver.js'
import { AccountsService } from './accounts.service.js'
import { Account } from './entities/account.entity.js'

@Module({
  imports: [TypeOrmModule.forFeature([Account]), AuditModule, SellerRolesModule],
  providers: [AccountsService, AccountsResolver],
  exports: [AccountsService],
})
export class AccountsModule {}
