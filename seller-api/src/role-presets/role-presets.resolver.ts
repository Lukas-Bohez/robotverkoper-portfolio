import { Args, ID, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { localizedName, missingLanguages } from '../entities/localized-names.entity.js'
import { RoleCopyResult } from '../roles/company-role.model.js'
import {
  ApplyRolePresetInput,
  CreateRolePresetInput,
  UpdateRolePresetInput,
} from './dto/role-preset.inputs.js'
import { RolePreset } from './entities/role-preset.entity.js'
import { RolePresetsService } from './role-presets.service.js'

@Resolver(() => RolePreset)
export class RolePresetsResolver {
  constructor(private readonly presets: RolePresetsService) {}

  @RequirePermissions('company-roles:manage')
  @Query(() => [RolePreset], {
    name: 'rolePresets',
    description:
      'The roles that can be reused at other companies. Archived ones only when asked for.',
  })
  findAll(
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
  ): Promise<RolePreset[]> {
    return this.presets.findAll(withDeleted)
  }

  @RequirePermissions('company-roles:manage')
  @Mutation(() => RolePreset)
  createRolePreset(
    @CurrentCaller() caller: Caller,
    @Args('input') input: CreateRolePresetInput,
  ): Promise<RolePreset> {
    return this.presets.create(caller.email, input)
  }

  @RequirePermissions('company-roles:manage')
  @Mutation(() => RolePreset, { description: 'Saves a role of a company as a preset' })
  saveRoleAsPreset(
    @CurrentCaller() caller: Caller,
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('roleId', { type: () => ID }) roleId: string,
  ): Promise<RolePreset> {
    return this.presets.saveFromRole(caller.email, companyId, roleId)
  }

  @RequirePermissions('company-roles:manage')
  @Mutation(() => RolePreset)
  updateRolePreset(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateRolePresetInput,
  ): Promise<RolePreset> {
    return this.presets.update(caller.email, id, input)
  }

  @RequirePermissions('company-roles:manage')
  @Mutation(() => RoleCopyResult, { description: 'Gives the role of a preset to companies' })
  applyRolePreset(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: ApplyRolePresetInput,
  ): Promise<RoleCopyResult> {
    return this.presets.apply(caller.email, id, input.companyIds)
  }

  @RequirePermissions('company-roles:manage')
  @Mutation(() => RolePreset, {
    description: 'Archives a preset (soft delete): it can be restored',
  })
  removeRolePreset(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<RolePreset> {
    return this.presets.remove(caller.email, id)
  }

  @RequirePermissions('archive:restore')
  @Mutation(() => RolePreset)
  restoreRolePreset(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<RolePreset> {
    return this.presets.restore(caller.email, id)
  }

  @ResolveField(() => String, {
    description: 'The name in the language that is asked for (falls back to English)',
  })
  name(
    @Parent() preset: RolePreset,
    @Args('language', { type: () => String, nullable: true }) language?: string,
  ): string {
    return localizedName(preset.names, language, preset.id)
  }

  @ResolveField(() => [String], { description: 'The languages that still miss a name' })
  missingLanguages(@Parent() preset: RolePreset): string[] {
    return missingLanguages(preset.names)
  }
}
