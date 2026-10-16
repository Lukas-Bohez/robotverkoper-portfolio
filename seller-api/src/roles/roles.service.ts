import { Injectable } from '@nestjs/common'
import { AuditService } from '../audit/audit.service.js'
import { COMPANY_PERMISSIONS } from '../authentication/permissions.js'
import { DomainException } from '../common/domain-exception.js'
import { CompaniesService } from '../companies/companies.service.js'
import { PlatformGateway } from '../platform/platform.gateway.js'
import type { CreateCompanyRoleInput } from './dto/create-company-role.input.js'
import type { CompanyRole } from './company-role.model.js'

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

  async list(companyId: string): Promise<CompanyRole[]> {
    await this.companies.get(companyId)
    return this.platform.listRoles(companyId)
  }

  async create(actor: string, companyId: string, input: CreateCompanyRoleInput): Promise<CompanyRole> {
    const company = await this.companies.get(companyId)
    const unknown = input.permissions.filter(key => !(COMPANY_PERMISSIONS as readonly string[]).includes(key))
    if (unknown.length > 0) {
      throw new DomainException(400, 'unknown_permission', `Unknown permission: ${unknown.join(', ')}`)
    }
    const role = await this.platform.createRole(companyId, {
      name: input.name,
      permissions: input.permissions,
    })
    await this.audit.record(actor, 'company-role.created', companyId, `${company.name}: ${role.name}`)
    return role
  }

  async remove(actor: string, companyId: string, roleId: string): Promise<void> {
    const company = await this.companies.get(companyId)
    const role = (await this.platform.listRoles(companyId)).find(item => item.id === roleId)
    if (!role) throw new DomainException(404, 'role_not_found', 'This role does not exist')
    if (role.locked) throw new DomainException(409, 'role_locked', 'The administrator role cannot be removed')
    await this.platform.deleteRole(companyId, roleId)
    await this.audit.record(actor, 'company-role.deleted', companyId, `${company.name}: ${role.name}`)
  }
}
