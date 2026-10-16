import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql'
import { SellerRole } from '../seller-roles/entities/seller-role.entity.js'
import { SellerRolesService } from '../seller-roles/seller-roles.service.js'
import { AnyLogin, CurrentCaller } from './decorators.js'
import type { Caller } from './request.js'

@ObjectType({ description: 'Who you are at the robot seller, and what your role allows' })
export class Me {
  @Field(() => String)
  email: string

  @Field(() => SellerRole, {
    nullable: true,
    description: 'Null when this account has no working role: it then has no access',
  })
  role: SellerRole | null

  @Field(() => [String])
  permissions: string[]
}

@Resolver(() => Me)
export class MeResolver {
  constructor(private readonly roles: SellerRolesService) {}

  /** Any login may ask: an account without a role gets an empty answer, and the PWA tells them so */
  @AnyLogin()
  @Query(() => Me)
  async me(@CurrentCaller() caller: Caller): Promise<Me> {
    return {
      email: caller.email,
      role: caller.role ? await this.roles.findByKey(caller.role) : null,
      permissions: caller.permissions,
    }
  }
}
