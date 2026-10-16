import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { CompanyRole, RoleCopyResult } from './company-role.model.js'
import {
  CopyCompanyRoleInput,
  CreateCompanyRoleInput,
  UpdateCompanyRoleInput,
} from './dto/create-company-role.input.js'
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
  @Query(() => [CompanyRole], {
    name: 'companyRoles',
    description:
      'The roles of a company, with the permissions of each. Archived roles only when asked for.',
  })
  findAll(
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
  ): Promise<CompanyRole[]> {
    return this.roles.findAll(companyId, withDeleted)
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
  @Mutation(() => CompanyRole, {
    description: 'Changes the name (per language) and the rights of a role',
  })
  updateCompanyRole(
    @CurrentCaller() caller: Caller,
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('roleId', { type: () => ID }) roleId: string,
    @Args('input') input: UpdateCompanyRoleInput,
  ): Promise<CompanyRole> {
    return this.roles.update(caller.email, companyId, roleId, input)
  }

  @RequirePermissions('company-roles:manage')
  @Mutation(() => CompanyRole, {
    description: 'Archives a role of a company (soft delete, never the locked administrator role)',
  })
  removeCompanyRole(
    @CurrentCaller() caller: Caller,
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('roleId', { type: () => ID }) roleId: string,
  ): Promise<CompanyRole> {
    return this.roles.remove(caller.email, companyId, roleId)
  }

  @RequirePermissions('archive:restore')
  @Mutation(() => CompanyRole)
  restoreCompanyRole(
    @CurrentCaller() caller: Caller,
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('roleId', { type: () => ID }) roleId: string,
  ): Promise<CompanyRole> {
    return this.roles.restore(caller.email, companyId, roleId)
  }

  @RequirePermissions('company-roles:manage')
  @Mutation(() => RoleCopyResult, {
    description: 'Copies a role of a company to other companies, with all its rights and its names',
  })
  copyCompanyRole(
    @CurrentCaller() caller: Caller,
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('roleId', { type: () => ID }) roleId: string,
    @Args('input') input: CopyCompanyRoleInput,
  ): Promise<RoleCopyResult> {
    return this.roles.copyRole(caller.email, companyId, roleId, input.targetCompanyIds)
  }
}
