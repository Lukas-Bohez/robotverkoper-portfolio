import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AccountsService } from '../accounts/accounts.service.js'
import { ANY_LOGIN, IS_PUBLIC, REQUIRED_PERMISSIONS } from './decorators.js'
import { IdentityService } from './identity.service.js'
import { permissionsOf, type SellerPermission } from './permissions.js'
import { headerValue, requestOf } from './request.js'

/**
 * Global guard (APP_GUARD) for every query, mutation, subscription and controller:
 * 1. @Public(): no login needed
 * 2. otherwise a Bearer token → an e-mail address → the role of that person
 * 3. @AnyLogin(): a login is enough; without it a role is needed (nothing is open by accident)
 * 4. @RequirePermissions(): the role must hold all of them
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly identity: IdentityService,
    private readonly accounts: AccountsService,
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
    const role = await this.accounts.roleOf(email)
    req.caller = { email, role }

    if (this.reflector.getAllAndOverride<boolean>(ANY_LOGIN, targets)) return true
    if (role === null) throw new ForbiddenException('You have no access to this')

    const required = this.reflector.getAllAndOverride<SellerPermission[] | undefined>(
      REQUIRED_PERMISSIONS,
      targets,
    )
    if (required?.some(permission => !permissionsOf(role).includes(permission))) {
      throw new ForbiddenException('You have no access to this')
    }
    return true
  }
}
