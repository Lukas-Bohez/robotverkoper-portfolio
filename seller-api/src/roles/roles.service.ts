import { Injectable } from '@nestjs/common'
import { AuditService } from '../audit/audit.service.js'
import { COMPANY_PERMISSIONS } from '../authentication/permissions.js'
import { DomainException } from '../common/domain-exception.js'
import { CompaniesService } from '../companies/companies.service.js'
import {
  LANGUAGES,
  type Language,
  type LocalizedNames,
} from '../entities/localized-names.entity.js'
import type { PlatformRole, RoleInput } from '../platform/platform.gateway.js'
import { PlatformGateway } from '../platform/platform.gateway.js'
import type { CompanyRole, RoleCopyResult } from './company-role.model.js'
import type {
  CreateCompanyRoleInput,
  UpdateCompanyRoleInput,
} from './dto/create-company-role.input.js'

/** What a role of a company looks like to the screens: the dates are real dates, the names a complete object */
function toModel(role: PlatformRole): CompanyRole {
  return {
    id: role.id,
    name: role.name,
    names: role.names,
    permissions: role.permissions,
    locked: role.locked,
    archivedAt: role.archivedAt ? new Date(role.archivedAt) : null,
  }
}

/** The roles of a company are kept by the platform: we set them up when a company starts */
@Injectable()
export class RolesService {
  constructor(
    private readonly companies: CompaniesService,
    private readonly platform: PlatformGateway,
    private readonly audit: AuditService,
  ) {}

  permissions(): readonly string[] {
    return COMPANY_PERMISSIONS
  }

  async findAll(companyId: string, withDeleted = false): Promise<CompanyRole[]> {
    await this.companies.findOne(companyId, true)
    return (await this.platform.listRoles(companyId, withDeleted)).map(toModel)
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

  /** Only the languages that have a name; the Dutch name is always there (it is the name of the role) */
  private checkNames(name: string, names: LocalizedNames | undefined): LocalizedNames {
    const given: Partial<Record<Language, string>> = Object.fromEntries(
      LANGUAGES.flatMap((code) => {
        const value = names?.[code]
        return typeof value === 'string' && value.trim() !== '' ? [[code, value.trim()]] : []
      }),
    )
    return { ...given, nl: given.nl ?? name }
  }

  async create(
    actor: string,
    companyId: string,
    input: CreateCompanyRoleInput,
  ): Promise<CompanyRole> {
    const company = await this.companies.findOne(companyId)
    const role = await this.platform.createRole(companyId, {
      name: input.name,
      names: this.checkNames(input.name, input.names),
      permissions: this.checkPermissions(input.permissions),
    })
    await this.audit.record(
      actor,
      'company-role.created',
      companyId,
      `${company.name}: ${role.name}`,
    )
    return toModel(role)
  }

  async update(
    actor: string,
    companyId: string,
    roleId: string,
    input: UpdateCompanyRoleInput,
  ): Promise<CompanyRole> {
    const company = await this.companies.findOne(companyId)
    const existing = await this.find(companyId, roleId)
    if (existing.locked) {
      throw new DomainException(409, 'role_locked', 'The administrator role cannot be changed')
    }
    const patch: Partial<RoleInput> = {}
    if (input.name) patch.name = input.name
    if (input.names || input.name) {
      patch.names = this.checkNames(
        input.name ?? existing.name,
        input.names ?? existing.names ?? undefined,
      )
    }
    if (input.permissions) patch.permissions = this.checkPermissions(input.permissions)
    const role = await this.platform.updateRole(companyId, roleId, patch)
    await this.audit.record(
      actor,
      'company-role.updated',
      companyId,
      `${company.name}: ${role.name}`,
    )
    return toModel(role)
  }

  private async find(
    companyId: string,
    roleId: string,
    withArchived = false,
  ): Promise<PlatformRole> {
    const role = (await this.platform.listRoles(companyId, withArchived)).find(
      (item) => item.id === roleId,
    )
    if (!role) throw new DomainException(404, 'role_not_found', 'This role does not exist')
    return role
  }

  /** Soft delete: the platform keeps the role and can bring it back (never the locked administrator role) */
  async remove(actor: string, companyId: string, roleId: string): Promise<CompanyRole> {
    const company = await this.companies.findOne(companyId, true)
    const role = await this.find(companyId, roleId)
    if (role.locked) {
      throw new DomainException(409, 'role_locked', 'The administrator role cannot be archived')
    }
    const archived = await this.platform.archiveRole(companyId, roleId)
    await this.audit.record(
      actor,
      'company-role.archived',
      companyId,
      `${company.name}: ${role.name}`,
    )
    return toModel(archived)
  }

  async restore(actor: string, companyId: string, roleId: string): Promise<CompanyRole> {
    const company = await this.companies.findOne(companyId, true)
    const role = await this.find(companyId, roleId, true)
    if (!role.archivedAt) {
      throw new DomainException(409, 'not_archived', 'This role is not archived')
    }
    const restored = await this.platform.restoreRole(companyId, roleId)
    await this.audit.record(
      actor,
      'company-role.restored',
      companyId,
      `${company.name}: ${role.name}`,
    )
    return toModel(restored)
  }

  /**
   * Makes the same role at other companies: with all its rights and its name in every language. A company that
   * already has a role with that name keeps its own (nothing is overwritten) and is reported as skipped.
   */
  async copyTo(
    actor: string,
    source: { name: string; names: LocalizedNames | null; permissions: string[] },
    targetCompanyIds: string[],
  ): Promise<RoleCopyResult> {
    const result: RoleCopyResult = { copied: 0, skipped: [] }
    for (const targetId of new Set(targetCompanyIds)) {
      const company = await this.companies.findOne(targetId)
      const existing = await this.platform.listRoles(targetId, true)
      if (existing.some((role) => role.name.toLowerCase() === source.name.toLowerCase())) {
        result.skipped.push(`${company.name}: ${source.name}`)
        continue
      }
      await this.platform.createRole(targetId, {
        name: source.name,
        names: source.names ?? undefined,
        permissions: this.checkPermissions(source.permissions),
      })
      result.copied++
      await this.audit.record(
        actor,
        'company-role.copied',
        targetId,
        `${company.name}: ${source.name}`,
      )
    }
    return result
  }

  async copyRole(
    actor: string,
    companyId: string,
    roleId: string,
    targetCompanyIds: string[],
  ): Promise<RoleCopyResult> {
    await this.companies.findOne(companyId, true)
    const role = await this.find(companyId, roleId)
    return this.copyTo(
      actor,
      role,
      targetCompanyIds.filter((id) => id !== companyId),
    )
  }
}
