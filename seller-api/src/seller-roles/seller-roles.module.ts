import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Account } from '../accounts/entities/account.entity.js'
import { AuditModule } from '../audit/audit.module.js'
import { SellerRole } from './entities/seller-role.entity.js'
import { SellerRolesLoader } from './seller-roles.loader.js'
import { SellerRolesResolver } from './seller-roles.resolver.js'
import { SellerRolesService } from './seller-roles.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([SellerRole, Account]), AuditModule],
  providers: [SellerRolesService, SellerRolesResolver, SellerRolesLoader],
  exports: [SellerRolesService, SellerRolesLoader],
})
export class SellerRolesModule {}
