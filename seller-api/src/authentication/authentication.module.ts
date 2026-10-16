import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AccountsModule } from '../accounts/accounts.module.js'
import { SellerRolesModule } from '../seller-roles/seller-roles.module.js'
import { AuthGuard } from './auth.guard.js'
import { FirebaseService } from './firebase.service.js'
import { IdentityService } from './identity.service.js'
import { MeResolver } from './me.resolver.js'

/**
 * Protects the whole API: AuthGuard runs for every request.
 * Use the decorators from ./decorators.ts in resolvers and controllers.
 */
@Module({
  imports: [AccountsModule, SellerRolesModule],
  providers: [FirebaseService, IdentityService, MeResolver, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [IdentityService],
})
export class AuthenticationModule {}
