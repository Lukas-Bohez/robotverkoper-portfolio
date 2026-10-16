import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MongoRepository } from 'typeorm'
import { SellerRole } from '../authentication/permissions.js'
import { AuditService } from '../audit/audit.service.js'
import { DomainException } from '../common/domain-exception.js'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import type { AddAccountInput } from './dto/add-account.input.js'
import { Account } from './entities/account.entity.js'

/** Our own staff: the accounts in the database, plus the administrators of SELLER_ADMIN_EMAILS */
@Injectable()
export class AccountsService {
  private readonly configuredAdmins: ReadonlySet<string>

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @InjectRepository(Account) private readonly repository: MongoRepository<Account>,
    private readonly audit: AuditService,
  ) {
    this.configuredAdmins = new Set(config.sellerAdminEmails)
  }

  /** An address in SELLER_ADMIN_EMAILS is always an administrator; others need an account */
  async roleOf(email: string): Promise<SellerRole | null> {
    if (this.configuredAdmins.has(email)) return SellerRole.ADMIN
    return (await this.repository.findOneBy({ email }))?.role ?? null
  }

  /** The accounts of the database and, above them, the administrators of the settings */
  async list(): Promise<Account[]> {
    const stored = await this.repository.find()
    const configured = [...this.configuredAdmins]
      .filter(email => !stored.some(account => account.email === email))
      .map(email =>
        Object.assign(new Account(), {
          email,
          role: SellerRole.ADMIN,
          createdBy: null,
          createdAt: null,
        }),
      )
    return [...configured, ...stored].sort((a, b) => a.email.localeCompare(b.email))
  }

  async add(actor: string, input: AddAccountInput): Promise<Account> {
    if (this.configuredAdmins.has(input.email)) {
      throw new DomainException(409, 'managed_by_config', 'This administrator is set in SELLER_ADMIN_EMAILS')
    }
    const existing = await this.repository.findOneBy({ email: input.email })
    const saved = await this.repository.save(
      existing
        ? Object.assign(existing, { role: input.role })
        : this.repository.create({
            email: input.email,
            role: input.role,
            createdBy: actor,
            createdAt: new Date(),
          }),
    )
    await this.audit.record(actor, 'account.saved', input.email, input.role)
    return saved
  }

  async remove(actor: string, email: string): Promise<void> {
    if (this.configuredAdmins.has(email)) {
      throw new DomainException(409, 'managed_by_config', 'This administrator is set in SELLER_ADMIN_EMAILS')
    }
    if (email === actor) {
      throw new DomainException(409, 'cannot_remove_self', 'You cannot remove your own account')
    }
    const result = await this.repository.deleteOne({ email })
    if (!result.deletedCount) {
      throw new DomainException(404, 'account_not_found', 'This account does not exist')
    }
    await this.audit.record(actor, 'account.removed', email)
  }
}
