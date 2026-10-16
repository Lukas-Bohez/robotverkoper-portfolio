import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MongoRepository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { ADMIN_ROLE_KEY } from '../authentication/permissions.js'
import { DomainException } from '../common/domain-exception.js'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { SellerRolesService } from '../seller-roles/seller-roles.service.js'
import type { AddAccountInput } from './dto/add-account.input.js'
import { Account } from './entities/account.entity.js'

/** Our own staff: the accounts in the database, plus the administrators of SELLER_ADMIN_EMAILS */
@Injectable()
export class AccountsService {
  private readonly configuredAdmins: ReadonlySet<string>

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @InjectRepository(Account)
    private readonly repository: MongoRepository<Account>,
    private readonly roles: SellerRolesService,
    private readonly audit: AuditService,
  ) {
    this.configuredAdmins = new Set(config.sellerAdminEmails)
  }

  /** An address in SELLER_ADMIN_EMAILS is always an administrator; others need an account */
  async roleKeyOf(email: string): Promise<string | null> {
    if (this.configuredAdmins.has(email)) return ADMIN_ROLE_KEY
    return (await this.repository.findOneBy({ email }))?.roleKey ?? null
  }

  /** The administrators of the settings are not in the database: they are shown as accounts all the same */
  private configured(known: Account[]): Account[] {
    return [...this.configuredAdmins]
      .filter((email) => !known.some((account) => account.email === email))
      .map((email) =>
        Object.assign(new Account(), {
          _id: `settings-${email}`,
          email,
          roleKey: ADMIN_ROLE_KEY,
          createdBy: null,
          createdAt: null,
          deletedAt: null,
        }),
      )
  }

  /** The accounts of the database and, above them, the administrators of the settings */
  async findAll(withDeleted = false): Promise<Account[]> {
    const stored = await this.repository.find({ withDeleted })
    return [...this.configured(stored), ...stored].sort((a, b) => a.email.localeCompare(b.email))
  }

  async add(actor: string, input: AddAccountInput): Promise<Account> {
    if (this.configuredAdmins.has(input.email)) {
      throw new DomainException(
        409,
        'managed_by_config',
        'This administrator is set in SELLER_ADMIN_EMAILS',
      )
    }
    if (!(await this.roles.findByKey(input.roleKey))) {
      throw new DomainException(404, 'role_not_found', 'This role does not exist')
    }
    // An archived account that gets a role again is restored, not made twice
    const existing = await this.repository.findOne({
      where: { email: input.email },
      withDeleted: true,
    })
    if (existing) {
      existing.roleKey = input.roleKey
      existing.deletedBy = null
      await this.repository.save(existing)
      if (existing.deletedAt) await this.repository.recover(existing)
      await this.audit.record(actor, 'account.saved', input.email, input.roleKey)
      return (await this.repository.findOneBy({ email: input.email }))!
    }
    const saved = await this.repository.save(
      this.repository.create({
        email: input.email,
        roleKey: input.roleKey,
        createdBy: actor,
      }),
    )
    await this.audit.record(actor, 'account.saved', input.email, input.roleKey)
    return saved
  }

  /** Soft delete: the account can no longer log in, but it is kept and can be restored */
  async remove(actor: string, email: string): Promise<Account> {
    if (this.configuredAdmins.has(email)) {
      throw new DomainException(
        409,
        'managed_by_config',
        'This administrator is set in SELLER_ADMIN_EMAILS',
      )
    }
    if (email === actor) {
      throw new DomainException(409, 'cannot_remove_self', 'You cannot remove your own account')
    }
    const account = await this.repository.findOneBy({ email })
    if (!account) {
      throw new DomainException(404, 'account_not_found', 'This account does not exist')
    }
    account.deletedBy = actor
    await this.repository.save(account)
    await this.repository.softRemove(account)
    await this.audit.record(actor, 'account.archived', email)
    return (await this.repository.findOne({ where: { email }, withDeleted: true }))!
  }

  async restore(actor: string, email: string): Promise<Account> {
    const account = await this.repository.findOne({ where: { email }, withDeleted: true })
    if (!account) {
      throw new DomainException(404, 'account_not_found', 'This account does not exist')
    }
    if (!account.deletedAt) {
      throw new DomainException(409, 'not_archived', 'This account is not archived')
    }
    account.deletedBy = null
    await this.repository.save(account)
    await this.repository.recover(account)
    await this.audit.record(actor, 'account.restored', email)
    return (await this.repository.findOneBy({ email }))!
  }

  /** The archived accounts (for the archive screen) */
  async archived(): Promise<Account[]> {
    return this.repository.find({
      where: { deletedAt: { $ne: null } } as never,
      withDeleted: true,
    })
  }
}
