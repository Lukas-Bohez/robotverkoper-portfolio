import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MongoRepository } from 'typeorm'
import { Account } from '../accounts/entities/account.entity.js'
import { AuditService } from '../audit/audit.service.js'
import {
  ADMIN_ROLE_KEY,
  DEFAULT_ROLES,
  EXTRA_CLAIM,
  groupOf,
  isStandardPermission,
  SELLER_PERMISSIONS,
} from '../authentication/permissions.js'
import { DomainException } from '../common/domain-exception.js'
import { toObjectId } from '../common/utils/mongo.util.js'
import { LANGUAGES, type LocalizedNames } from '../entities/localized-names.entity.js'
import type { CreateSellerRoleInput, UpdateSellerRoleInput } from './dto/seller-role.inputs.js'
import { PermissionInfo, SellerRole } from './entities/seller-role.entity.js'

/** The roles of our own staff. Roles are data: the administrator changes what a technician may do. */
@Injectable()
export class SellerRolesService {
  constructor(
    @InjectRepository(SellerRole)
    private readonly repository: MongoRepository<SellerRole>,
    @InjectRepository(Account)
    private readonly accounts: MongoRepository<Account>,
    private readonly audit: AuditService,
  ) {}

  /** The standard permissions with their group (the rows of the table) */
  catalog(): PermissionInfo[] {
    return SELLER_PERMISSIONS.map((key) => ({ key, group: groupOf(key) }))
  }

  async findAll(withDeleted = false): Promise<SellerRole[]> {
    const roles = await this.repository.find({ withDeleted })
    return roles.sort((a, b) => Number(b.locked) - Number(a.locked) || a.key.localeCompare(b.key))
  }

  /** One role by its id; an archived role only when asked for */
  async findOne(id: string, withDeleted = false): Promise<SellerRole> {
    const role = await this.repository.findOne({
      where: { _id: toObjectId(id) },
      withDeleted,
    })
    if (!role) throw new DomainException(404, 'role_not_found', 'This role does not exist')
    return role
  }

  async findByKey(key: string, withDeleted = false): Promise<SellerRole | null> {
    return this.repository.findOne({ where: { key }, withDeleted })
  }

  /**
   * What a person with this role may do. The locked administrator role always holds every standard right, also
   * the ones that were added to the code after the role was stored, and even when the roles were emptied: the
   * administrator is never locked out. An unknown or archived role holds nothing.
   */
  async permissionsOf(key: string | null): Promise<string[]> {
    if (!key) return []
    const role = await this.findByKey(key)
    if (!role) return key === ADMIN_ROLE_KEY ? [...SELLER_PERMISSIONS] : []
    return role.locked
      ? [...new Set([...SELLER_PERMISSIONS, ...role.permissions])]
      : [...role.permissions]
  }

  /** Puts the roles that always exist in a database that has none yet (and leaves changed ones alone) */
  async ensureDefaults(): Promise<void> {
    for (const role of DEFAULT_ROLES) {
      const exists = await this.repository.findOne({
        where: { key: role.key },
        withDeleted: true,
      })
      if (exists) continue
      await this.repository.save(
        this.repository.create({
          key: role.key,
          names: role.names,
          permissions: [...role.permissions],
          locked: role.locked,
        }),
      )
    }
  }

  /** A standard permission or an extra claim (area:action); anything else is a mistake */
  checkPermissions(permissions: string[]): string[] {
    const unknown = permissions.filter(
      (key) => !isStandardPermission(key) && !EXTRA_CLAIM.test(key),
    )
    if (unknown.length > 0) {
      throw new DomainException(
        400,
        'invalid_claim',
        `Not a permission or an extra claim (area:action): ${unknown.join(', ')}`,
      )
    }
    return [...new Set(permissions)]
  }

  /** At least one language needs a name; empty languages are left out (they fall back) */
  checkNames(names: LocalizedNames): LocalizedNames {
    const given = LANGUAGES.filter(
      (code) => typeof names[code] === 'string' && names[code]!.trim() !== '',
    )
    if (given.length === 0) {
      throw new DomainException(
        400,
        'invalid_names',
        'Give the role a name in at least one language',
      )
    }
    return Object.fromEntries(given.map((code) => [code, names[code]!.trim()])) as LocalizedNames
  }

  async create(actor: string, input: CreateSellerRoleInput): Promise<SellerRole> {
    const exists = await this.repository.findOne({
      where: { key: input.key },
      withDeleted: true,
    })
    if (exists) {
      throw new DomainException(409, 'role_exists', `The role "${input.key}" already exists`)
    }
    const saved = await this.repository.save(
      this.repository.create({
        key: input.key,
        names: this.checkNames(input.names),
        permissions: this.checkPermissions(input.permissions),
        locked: false,
      }),
    )
    await this.audit.record(actor, 'seller-role.created', saved.key, saved.permissions.join(', '))
    return saved
  }

  async update(actor: string, id: string, input: UpdateSellerRoleInput): Promise<SellerRole> {
    const role = await this.findOne(id)
    if (input.permissions && role.locked) {
      throw new DomainException(
        409,
        'role_locked',
        'The administrator role always holds every right',
      )
    }
    if (input.names) role.names = this.checkNames(input.names)
    if (input.permissions) role.permissions = this.checkPermissions(input.permissions)
    const saved = await this.repository.save(role)
    await this.audit.record(actor, 'seller-role.updated', role.key, role.permissions.join(', '))
    return saved
  }

  /** Soft delete: the role is kept for history and can be restored. Someone who still has it blocks it. */
  async remove(actor: string, id: string): Promise<SellerRole> {
    const role = await this.findOne(id)
    if (role.locked) {
      throw new DomainException(409, 'role_locked', 'The administrator role cannot be archived')
    }
    const inUse = await this.accounts.count({ roleKey: role.key, deletedAt: null })
    if (inUse > 0) {
      throw new DomainException(
        409,
        'role_in_use',
        'Someone still has this role: give them another role first',
      )
    }
    role.deletedBy = actor
    await this.repository.save(role)
    await this.repository.softRemove(role)
    await this.audit.record(actor, 'seller-role.archived', role.key)
    return this.findOne(id, true)
  }

  async restore(actor: string, id: string): Promise<SellerRole> {
    const role = await this.findOne(id, true)
    if (!role.deletedAt) {
      throw new DomainException(409, 'not_archived', 'This role is not archived')
    }
    role.deletedBy = null
    await this.repository.save(role)
    await this.repository.recover(role)
    await this.audit.record(actor, 'seller-role.restored', role.key)
    return this.findOne(id)
  }

  /** The archived roles (for the archive screen) */
  async archived(): Promise<SellerRole[]> {
    return this.repository.find({
      where: { deletedAt: { $ne: null } } as never,
      withDeleted: true,
    })
  }
}
