import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AccountsService } from '../accounts/accounts.service.js'
import { SellerRolesService } from '../seller-roles/seller-roles.service.js'
import {
  ANY_LOGIN,
  IS_PUBLIC,
  REQUIRED_ANY_PERMISSION,
  REQUIRED_PERMISSIONS,
} from './decorators.js'
import { IdentityService } from './identity.service.js'
import type { SellerPermission } from './permissions.js'
import { headerValue, requestOf } from './request.js'

/**
 * Global guard (APP_GUARD) for every query, mutation, subscription and controller:
 * 1. @Public(): no login needed
 * 2. otherwise a Bearer token → an e-mail address → the role of that person → what that role allows
 * 3. @AnyLogin(): a login is enough; without it a role is needed (nothing is open by accident)
 * 4. @RequirePermissions(): the role must hold all of them
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly identity: IdentityService,
    private readonly accounts: AccountsService,
    private readonly roles: SellerRolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = requestOf(context)
    if (!req) return true

    const targets = [context.getHandler(), context.getClass()]
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true

    const [scheme, token] = headerValue(req.headers.authorization)?.split(' ') ?? []
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Log in first')
    }
    const { email } = await this.identity.verify(token)
    const roleKey = await this.accounts.roleKeyOf(email)
    const permissions = await this.roles.permissionsOf(roleKey)
    // A role that holds nothing (or that was archived) is no role: the person has no access
    const role = permissions.length > 0 ? roleKey : null
    req.caller = { email, role, permissions }

    if (this.reflector.getAllAndOverride<boolean>(ANY_LOGIN, targets)) return true
    if (role === null) throw new ForbiddenException('You have no access to this')

    const required = this.reflector.getAllAndOverride<SellerPermission[] | undefined>(
      REQUIRED_PERMISSIONS,
      targets,
    )
    if (required?.some((permission) => !permissions.includes(permission))) {
      throw new ForbiddenException('You have no access to this')
    }
    const anyOf = this.reflector.getAllAndOverride<SellerPermission[] | undefined>(
      REQUIRED_ANY_PERMISSION,
      targets,
    )
    if (anyOf && !anyOf.some((permission) => permissions.includes(permission))) {
      throw new ForbiddenException('You have no access to this')
    }
    return true
  }
}
