import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { CompanyRole } from './company-role.model.js'
import { CreateCompanyRoleInput } from './dto/create-company-role.input.js'
import { RolesService } from './roles.service.js'

@Resolver(() => CompanyRole)
export class RolesResolver {
  constructor(private readonly roles: RolesService) {}

  @RequirePermissions('company-roles:manage')
  @Query(() => [String], { description: 'The permission keys a role of a company can hold' })
  companyPermissions(): readonly string[] {
    return this.roles.permissions()
  }

  @RequirePermissions('company-roles:manage')
  @Query(() => [CompanyRole], { description: 'The roles of a company, with the permissions of each' })
  companyRoles(@Args('companyId', { type: () => ID }) companyId: string): Promise<CompanyRole[]> {
    return this.roles.list(companyId)
  }

  @RequirePermissions('company-roles:manage')
  @Mutation(() => CompanyRole, { description: 'Makes a role for a company, for example "kok"' })
  createCompanyRole(
    @CurrentCaller() caller: Caller,
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('input') input: CreateCompanyRoleInput,
  ): Promise<CompanyRole> {
    return this.roles.create(caller.email, companyId, input)
  }

  @RequirePermissions('company-roles:manage')
  @Mutation(() => Boolean, { description: 'Removes a role of a company (never the locked administrator role)' })
  async deleteCompanyRole(
    @CurrentCaller() caller: Caller,
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('roleId', { type: () => ID }) roleId: string,
  ): Promise<boolean> {
    await this.roles.remove(caller.email, companyId, roleId)
    return true
  }
}
