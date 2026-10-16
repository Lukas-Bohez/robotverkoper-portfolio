import { Injectable } from '@nestjs/common'
import { AccountsService } from '../accounts/accounts.service.js'
import { DomainException } from '../common/domain-exception.js'
import { CompaniesService } from '../companies/companies.service.js'
import { DefectsService } from '../defects/defects.service.js'
import { localizedName } from '../entities/localized-names.entity.js'
import { ArchiveKind } from '../enums/archive-kind.enum.js'
import { RobotsService } from '../robots/robots.service.js'
import { RolePresetsService } from '../role-presets/role-presets.service.js'
import { SellerRolesService } from '../seller-roles/seller-roles.service.js'
import { ArchivedItem } from './archive.models.js'

/**
 * The archive: everything that was "deleted" with a soft delete, in one place. Nothing is really deleted, so
 * everything here can be restored. The services of each kind do the real work.
 */
@Injectable()
export class ArchiveService {
  constructor(
    private readonly accounts: AccountsService,
    private readonly sellerRoles: SellerRolesService,
    private readonly presets: RolePresetsService,
    private readonly companies: CompaniesService,
    private readonly robots: RobotsService,
    private readonly defects: DefectsService,
  ) {}

  /** The archived items of one kind (or of all kinds), newest first; `year` limits them to the year they were archived */
  async list(kind?: ArchiveKind | null, year?: number | null): Promise<ArchivedItem[]> {
    const wants = (wanted: ArchiveKind) => !kind || kind === wanted
    const items: ArchivedItem[] = []

    if (wants(ArchiveKind.ACCOUNT)) {
      for (const account of await this.accounts.archived()) {
        items.push({
          id: account.email,
          kind: ArchiveKind.ACCOUNT,
          label: account.email,
          detail: account.roleKey,
          archivedAt: account.deletedAt!,
          archivedBy: account.deletedBy ?? null,
        })
      }
    }
    if (wants(ArchiveKind.SELLER_ROLE)) {
      for (const role of await this.sellerRoles.archived()) {
        items.push({
          id: role.id,
          kind: ArchiveKind.SELLER_ROLE,
          label: localizedName(role.names, 'nl', role.key),
          detail: role.key,
          archivedAt: role.deletedAt!,
          archivedBy: role.deletedBy ?? null,
        })
      }
    }
    if (wants(ArchiveKind.ROLE_PRESET)) {
      for (const preset of await this.presets.archived()) {
        items.push({
          id: preset.id,
          kind: ArchiveKind.ROLE_PRESET,
          label: localizedName(preset.names, 'nl', preset.id),
          detail: null,
          archivedAt: preset.deletedAt!,
          archivedBy: preset.deletedBy ?? null,
        })
      }
    }
    if (wants(ArchiveKind.COMPANY)) {
      for (const company of await this.companies.archived()) {
        items.push({
          id: company.id,
          kind: ArchiveKind.COMPANY,
          label: company.name,
          detail: company.subdomain,
          archivedAt: company.deletedAt!,
          archivedBy: company.deletedBy ?? null,
        })
      }
    }
    if (wants(ArchiveKind.ROBOT)) {
      for (const robot of await this.robots.archived()) {
        items.push({
          id: robot.id,
          kind: ArchiveKind.ROBOT,
          label: robot.name,
          detail: robot.serial,
          archivedAt: robot.deletedAt!,
          archivedBy: robot.deletedBy ?? null,
        })
      }
    }
    if (wants(ArchiveKind.DEFECT)) {
      for (const defect of await this.defects.archived()) {
        items.push({
          id: defect.id,
          kind: ArchiveKind.DEFECT,
          label: defect.summary,
          detail: defect.robotId,
          archivedAt: defect.deletedAt!,
          archivedBy: defect.deletedBy ?? null,
        })
      }
    }

    return items
      .filter(item => !year || item.archivedAt.getUTCFullYear() === year)
      .sort((a, b) => b.archivedAt.getTime() - a.archivedAt.getTime())
  }

  /** Brings something back from the archive, whatever it is */
  async restore(actor: string, kind: ArchiveKind, id: string): Promise<ArchivedItem> {
    const before = (await this.list(kind)).find(item => item.id === id)
    if (!before) throw new DomainException(404, 'archived_not_found', 'This is not in the archive')
    switch (kind) {
      case ArchiveKind.ACCOUNT:
        await this.accounts.restore(actor, id)
        break
      case ArchiveKind.SELLER_ROLE:
        await this.sellerRoles.restore(actor, id)
        break
      case ArchiveKind.ROLE_PRESET:
        await this.presets.restore(actor, id)
        break
      case ArchiveKind.COMPANY:
        await this.companies.restore(actor, id)
        break
      case ArchiveKind.ROBOT:
        await this.robots.restore(actor, id)
        break
      case ArchiveKind.DEFECT:
        await this.defects.restore(actor, id)
        break
    }
    return before
  }
}
