import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql'
import {
  CurrentCaller,
  RequireAnyPermission,
  RequirePermissions,
} from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { localizedName } from '../entities/localized-names.entity.js'
import {
  CreateSellerRoleInput,
  UpdateSellerRoleInput,
} from './dto/seller-role.inputs.js'
import { PermissionInfo, SellerRole } from './entities/seller-role.entity.js'
import { SellerRolesService } from './seller-roles.service.js'

@Resolver(() => SellerRole)
export class SellerRolesResolver {
  constructor(private readonly roles: SellerRolesService) {}

  @RequireAnyPermission('roles:manage', 'accounts:manage')
  @Query(() => [SellerRole], {
    name: 'sellerRoles',
    description: 'The roles of our own staff',
  })
  findAll(
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
  ): Promise<SellerRole[]> {
    return this.roles.findAll(withDeleted)
  }

  @RequirePermissions('roles:manage')
  @Query(() => [PermissionInfo], {
    name: 'sellerPermissions',
    description: 'The standard rights, in groups: the rows of the table of rights',
  })
  permissions(): PermissionInfo[] {
    return this.roles.catalog()
  }

  @RequirePermissions('roles:manage')
  @Mutation(() => SellerRole)
  createSellerRole(
    @CurrentCaller() caller: Caller,
    @Args('input') input: CreateSellerRoleInput,
  ): Promise<SellerRole> {
    return this.roles.create(caller.email, input)
  }

  @RequirePermissions('roles:manage')
  @Mutation(() => SellerRole, {
    description: 'Changes the names (per language) and the rights of a role',
  })
  updateSellerRole(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSellerRoleInput,
  ): Promise<SellerRole> {
    return this.roles.update(caller.email, id, input)
  }

  @RequirePermissions('roles:manage')
  @Mutation(() => SellerRole, {
    description: 'Archives a role (soft delete): it is kept and can be restored',
  })
  removeSellerRole(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<SellerRole> {
    return this.roles.remove(caller.email, id)
  }

  @RequirePermissions('archive:restore')
  @Mutation(() => SellerRole)
  restoreSellerRole(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<SellerRole> {
    return this.roles.restore(caller.email, id)
  }

  /** The name in the language that is asked for (falls back to English, then to the key) */
  @ResolveField(() => String)
  name(
    @Parent() role: SellerRole,
    @Args('language', { type: () => String, nullable: true }) language?: string,
  ): string {
    return localizedName(role.names, language, role.key)
  }
}
