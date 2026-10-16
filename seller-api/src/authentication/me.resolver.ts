import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql'
import { AnyLogin, CurrentCaller } from './decorators.js'
import { permissionsOf, SellerRole } from './permissions.js'
import type { Caller } from './request.js'

@ObjectType({ description: 'Who you are at the robot seller, and what your role allows' })
export class Me {
  @Field(() => String)
  email: string

  @Field(() => SellerRole, { nullable: true, description: 'Null when this account has no role: it then has no access' })
  role: SellerRole | null

  @Field(() => [String])
  permissions: string[]
}

@Resolver(() => Me)
export class MeResolver {
  /** Any login may ask: an account without a role gets an empty answer, and the PWA tells them so */
  @AnyLogin()
  @Query(() => Me)
  me(@CurrentCaller() caller: Caller): Me {
    return {
      email: caller.email,
      role: caller.role,
      permissions: caller.role ? [...permissionsOf(caller.role)] : [],
    }
  }
}
