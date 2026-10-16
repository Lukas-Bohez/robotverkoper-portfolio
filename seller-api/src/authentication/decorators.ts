import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common'
import type { SellerPermission } from './permissions.js'
import { isLoopback, requestOf, type Caller } from './request.js'

export const IS_PUBLIC = 'auth:isPublic'
export const ANY_LOGIN = 'auth:anyLogin'
export const REQUIRED_PERMISSIONS = 'auth:requiredPermissions'
export const REQUIRED_ANY_PERMISSION = 'auth:requiredAnyPermission'

/** No login needed (health, and the simulator that waits for its key) */
export const Public = () => SetMetadata(IS_PUBLIC, true)

/** Any login is enough, also from someone who has no role (`me` tells them so) */
export const AnyLogin = () => SetMetadata(ANY_LOGIN, true)

/**
 * Needs a login with a role that holds all of these permissions. Without this decorator (and without
 * @Public() or @AnyLogin()) an operation still needs a role: nothing is open by accident.
 */
export const RequirePermissions = (...permissions: SellerPermission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions)

/** Needs a login with a role that holds at least one of these permissions */
export const RequireAnyPermission = (...permissions: SellerPermission[]) =>
  SetMetadata(REQUIRED_ANY_PERMISSION, permissions)

/** The e-mail address and role of the logged-in person */
export const CurrentCaller = createParamDecorator(
  (_: unknown, context: ExecutionContext): Caller => {
    const caller = requestOf(context)?.caller
    if (!caller) throw new UnauthorizedException('Log in first')
    return caller
  },
)

/** The request comes from this very computer */
export const FromThisComputer = createParamDecorator(
  (_: unknown, context: ExecutionContext): boolean => isLoopback(requestOf(context)),
)
