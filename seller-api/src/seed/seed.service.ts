import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { AccountsService } from '../accounts/accounts.service.js'
import { ColdStorageService } from '../archive/cold-storage.service.js'
import { AuditEntry } from '../audit/entities/audit-entry.entity.js'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { DefectsService } from '../defects/defects.service.js'
import { Defect } from '../defects/entities/defect.entity.js'
import { DefectSeverity } from '../defects/enums/defect.enums.js'
import { localizedName } from '../entities/localized-names.entity.js'
import { PlatformGateway } from '../platform/platform.gateway.js'
import { RobotsService } from '../robots/robots.service.js'
import { RolePresetsService } from '../role-presets/role-presets.service.js'
import { SellerRolesService } from '../seller-roles/seller-roles.service.js'
import {
  DEMO_ACCOUNTS,
  DEMO_CLAIM,
  DEMO_COMPANY_PRESETS,
  DEMO_CONDITIONS,
  DEMO_DEFECTS,
  DEMO_ROBOTS,
  EXTRA_SELLER_ROLES,
  OLD_DEFECTS,
  ROBOT_MODELS,
  ROLE_PRESETS,
  STOCK_ROBOTS,
} from './demo-data.js'

const ACTOR = 'demo-seed'

/**
 * Collections we own. The companies are a copy of the platform: they are filled again by themselves.
 * The migrations of the database (`_migrations`) are not emptied: the structure stays, only the data goes.
 */
const COLLECTIONS = [
  'robots',
  'defects',
  'accounts',
  'audit',
  'companies',
  'seller_roles',
  'role_presets',
]

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name)

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly robots: RobotsService,
    private readonly defects: DefectsService,
    private readonly accounts: AccountsService,
    private readonly sellerRoles: SellerRolesService,
    private readonly presets: RolePresetsService,
    private readonly cold: ColdStorageService,
    private readonly platform: PlatformGateway,
  ) {}

  /** The catalogue of robot models: always, it is what we sell */
  async seedModels(): Promise<void> {
    await this.robots.upsertModels(ROBOT_MODELS)
  }

  /** The roles that always exist (administrator and technician): without them nobody can do anything */
  async seedRoles(): Promise<void> {
    await this.sellerRoles.ensureDefaults()
  }

  /**
   * Fills an empty database for the demo: staff and roles, presets, robots for the made-up companies of the
   * platform simulator, robots in the warehouse, three defects (one with food inside), and old defects in cold
   * storage. It goes through the services, so keys and records are made the normal way.
   */
  async seedDemo(): Promise<void> {
    if ((await this.robots.countAll()) > 0) {
      this.logger.log('Demo seed skipped: there are robots already')
      return
    }
    await this.seedStaff()
    await this.presets.ensureDefaults(ROLE_PRESETS, ACTOR)

    const companies = await this.platform.listCompanies()
    const robotIds = new Map<string, string>()
    for (const demo of DEMO_ROBOTS) {
      const company = companies.find((item) => item.subdomain === demo.company)
      if (!company) {
        this.logger.warn(
          `The platform has no company "${demo.company}", robot "${demo.name}" skipped`,
        )
        continue
      }
      const { robot } = await this.robots.create(
        ACTOR,
        company.id,
        { name: demo.name, modelId: demo.model },
        { serial: demo.serial },
      )
      robotIds.set(demo.name, robot.id)
      await this.platform.simulateTelemetry?.(robot.id, {
        online: demo.online,
        battery: demo.battery,
      })
      const condition = DEMO_CONDITIONS[demo.name]
      if (condition) {
        await this.platform.simulateCondition?.(robot.id, {
          ...condition,
          cargoSince: condition.hasCargo ? new Date(Date.now() - 24 * 60_000).toISOString() : null,
        })
      }
    }
    for (const stock of STOCK_ROBOTS) {
      await this.robots.addToStock(ACTOR, {
        name: stock.name,
        modelId: stock.model,
        serial: stock.serial,
      })
    }
    await this.seedDefects(robotIds)
    await this.seedCompanyRoles(
      companies.map((company) => ({ id: company.id, subdomain: company.subdomain })),
    )
    await this.seedHistory(robotIds)
    this.logger.log(
      'Demo seed: staff, presets, robots, stock, three defects and old defects in cold storage',
    )
  }

  private async seedStaff(): Promise<void> {
    for (const role of EXTRA_SELLER_ROLES) {
      if (await this.sellerRoles.findByKey(role.key, true)) continue
      await this.sellerRoles.create(ACTOR, role)
    }
    for (const account of DEMO_ACCOUNTS) {
      await this.accounts.add(ACTOR, { email: account.email, roleKey: account.roleKey })
      if (account.archived) await this.accounts.remove(ACTOR, account.email)
    }
  }

  private async seedDefects(robotIds: Map<string, string>): Promise<void> {
    const reported = new Map<string, string>()
    for (const demo of DEMO_DEFECTS) {
      const robotId = robotIds.get(demo.robot)
      if (!robotId) continue
      const defect = await this.defects.report(ACTOR, robotId, {
        summary: demo.summary,
        severity: demo.severity as DefectSeverity,
      })
      reported.set(demo.robot, defect.id)
    }
    const claimed = reported.get(DEMO_CLAIM.robot)
    if (claimed) await this.defects.claim(DEMO_CLAIM.technician, claimed)
  }

  /** The first company gets the roles Kok, Lader and Ober from the presets */
  private async seedCompanyRoles(companies: { id: string; subdomain: string }[]): Promise<void> {
    const demo = companies.find((company) => company.subdomain === 'demo')
    if (!demo) return
    for (const preset of await this.presets.findAll()) {
      if (DEMO_COMPANY_PRESETS.includes(localizedName(preset.names, 'nl', ''))) {
        await this.presets.apply(ACTOR, preset.id, [demo.id])
      }
    }
  }

  /** Defects of earlier years, written with their old dates, then moved to cold storage */
  private async seedHistory(robotIds: Map<string, string>): Promise<void> {
    const defects = this.dataSource.getMongoRepository(Defect)
    const audit = this.dataSource.getMongoRepository(AuditEntry)
    for (const old of OLD_DEFECTS) {
      const robot = await this.robots.findById(robotIds.get(old.robot) ?? '')
      if (!robot?.platformId || !robot.companyId) continue
      await defects.insertOne({
        robotId: robot.platformId,
        companyId: robot.companyId,
        summary: old.summary,
        severity: old.severity,
        reportedBy: 'docent@howest.be',
        assignedTo: 'technieker@fabrikant.be',
        claimedAt: new Date(old.createdAt),
        onSiteAt: new Date(old.createdAt),
        checklistDone: ['robot_stable'],
        resolution: old.resolution,
        resolvedAt: new Date(old.resolvedAt),
        resolvedBy: 'technieker@fabrikant.be',
        resolutionNote: old.note,
        replacementRobotId: null,
        condition: null,
        location: null,
        callRequestedAt: null,
        calledBy: null,
        helpRequestedAt: null,
        coldAt: null,
        createdAt: new Date(old.createdAt),
        updatedAt: new Date(old.resolvedAt),
        deletedAt: null,
      } as never)
      await audit.insertOne({
        createdAt: new Date(old.createdAt),
        actor: 'docent@howest.be',
        action: 'defect.reported',
        target: robot.platformId,
        detail: `${robot.name}: ${old.summary}`,
        coldAt: null,
      } as never)
    }
    const moved = await this.cold.moveOldData()
    this.logger.log(
      `Cold storage: ${moved.defects} defects and ${moved.auditEntries} log lines moved`,
    )
  }

  /** What `seed` does, and what the API does when it starts */
  async seedAll(): Promise<void> {
    await this.seedModels()
    await this.seedRoles()
    if (this.config.seedDemo) await this.seedDemo()
  }

  /** Empties what we own (never the platform). Development only. */
  async clearAll(): Promise<void> {
    if (this.config.production) throw new Error('clear never runs in production')
    for (const name of COLLECTIONS) {
      await this.dataSource.mongoManager.getMongoRepository(name).deleteMany({})
    }
    this.logger.log(`Emptied: ${COLLECTIONS.join(', ')}`)
  }
}
