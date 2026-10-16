import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MongoRepository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { COMPANY_PERMISSIONS } from '../authentication/permissions.js'
import { DomainException } from '../common/domain-exception.js'
import { toObjectId } from '../common/utils/mongo.util.js'
import { CompaniesService } from '../companies/companies.service.js'
import {
  LANGUAGES,
  localizedName,
  type LocalizedNames,
} from '../entities/localized-names.entity.js'
import { PlatformGateway } from '../platform/platform.gateway.js'
import type { RoleCopyResult } from '../roles/company-role.model.js'
import { RolesService } from '../roles/roles.service.js'
import type { CreateRolePresetInput, UpdateRolePresetInput } from './dto/role-preset.inputs.js'
import { RolePreset } from './entities/role-preset.entity.js'

/** Roles to reuse: made once, copied to as many companies as you like */
@Injectable()
export class RolePresetsService {
  constructor(
    @InjectRepository(RolePreset)
    private readonly repository: MongoRepository<RolePreset>,
    private readonly roles: RolesService,
    private readonly companies: CompaniesService,
    private readonly platform: PlatformGateway,
    private readonly audit: AuditService,
  ) {}

  async findAll(withDeleted = false): Promise<RolePreset[]> {
    const presets = await this.repository.find({ withDeleted })
    return presets.sort((a, b) =>
      localizedName(a.names, 'nl', '').localeCompare(localizedName(b.names, 'nl', '')),
    )
  }

  async findOne(id: string, withDeleted = false): Promise<RolePreset> {
    const preset = await this.repository.findOne({ where: { _id: toObjectId(id) }, withDeleted })
    if (!preset) throw new DomainException(404, 'preset_not_found', 'This preset does not exist')
    return preset
  }

  private checkPermissions(permissions: string[]): string[] {
    const unknown = permissions.filter(
      (key) => !(COMPANY_PERMISSIONS as readonly string[]).includes(key),
    )
    if (unknown.length > 0) {
      throw new DomainException(
        400,
        'unknown_permission',
        `Unknown permission: ${unknown.join(', ')}`,
      )
    }
    return [...new Set(permissions)]
  }

  /** At least one language needs a name */
  private checkNames(names: LocalizedNames): LocalizedNames {
    const given = LANGUAGES.filter(
      (code) => typeof names[code] === 'string' && names[code]!.trim() !== '',
    )
    if (given.length === 0) {
      throw new DomainException(
        400,
        'invalid_names',
        'Give the preset a name in at least one language',
      )
    }
    return Object.fromEntries(given.map((code) => [code, names[code]!.trim()])) as LocalizedNames
  }

  async create(actor: string, input: CreateRolePresetInput): Promise<RolePreset> {
    const saved = await this.repository.save(
      this.repository.create({
        names: this.checkNames(input.names),
        permissions: this.checkPermissions(input.permissions),
        createdBy: actor,
      }),
    )
    await this.audit.record(
      actor,
      'role-preset.created',
      saved.id,
      localizedName(saved.names, 'nl', saved.id),
    )
    return saved
  }

  /** Makes a preset of a role that a company has: "save as preset" */
  async saveFromRole(actor: string, companyId: string, roleId: string): Promise<RolePreset> {
    await this.companies.findOne(companyId, true)
    const role = (await this.platform.listRoles(companyId)).find((item) => item.id === roleId)
    if (!role) throw new DomainException(404, 'role_not_found', 'This role does not exist')
    return this.create(actor, {
      names: { ...role.names, nl: role.names?.nl ?? role.name },
      permissions: role.permissions,
    })
  }

  async update(actor: string, id: string, input: UpdateRolePresetInput): Promise<RolePreset> {
    const preset = await this.findOne(id)
    if (input.names) preset.names = this.checkNames(input.names)
    if (input.permissions) preset.permissions = this.checkPermissions(input.permissions)
    const saved = await this.repository.save(preset)
    await this.audit.record(actor, 'role-preset.updated', id, localizedName(saved.names, 'nl', id))
    return saved
  }

  /** Gives the role of the preset to these companies (a company that has a role with that name keeps its own) */
  async apply(actor: string, id: string, companyIds: string[]): Promise<RoleCopyResult> {
    const preset = await this.findOne(id)
    const name = localizedName(preset.names, 'nl', preset.id)
    return this.roles.copyTo(
      actor,
      { name, names: preset.names, permissions: preset.permissions },
      companyIds,
    )
  }

  /** Soft delete: the preset is kept and can be restored */
  async remove(actor: string, id: string): Promise<RolePreset> {
    const preset = await this.findOne(id)
    preset.deletedBy = actor
    await this.repository.save(preset)
    await this.repository.softRemove(preset)
    await this.audit.record(
      actor,
      'role-preset.archived',
      id,
      localizedName(preset.names, 'nl', id),
    )
    return this.findOne(id, true)
  }

  async restore(actor: string, id: string): Promise<RolePreset> {
    const preset = await this.findOne(id, true)
    if (!preset.deletedAt)
      throw new DomainException(409, 'not_archived', 'This preset is not archived')
    preset.deletedBy = null
    await this.repository.save(preset)
    await this.repository.recover(preset)
    await this.audit.record(
      actor,
      'role-preset.restored',
      id,
      localizedName(preset.names, 'nl', id),
    )
    return this.findOne(id)
  }

  /** The archived presets (for the archive screen) */
  async archived(): Promise<RolePreset[]> {
    return this.repository.find({ where: { deletedAt: { $ne: null } } as never, withDeleted: true })
  }

  /** Puts the presets of the demo in an empty database */
  async ensureDefaults(
    presets: { names: LocalizedNames; permissions: string[] }[],
    actor: string,
  ): Promise<void> {
    if ((await this.repository.count()) > 0) return
    for (const preset of presets) {
      await this.repository.save(
        this.repository.create({
          names: preset.names,
          permissions: preset.permissions,
          createdBy: actor,
        }),
      )
    }
  }
}
