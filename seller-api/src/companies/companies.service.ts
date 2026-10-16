import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MongoRepository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { DomainException, isPlatformUnavailable } from '../common/domain-exception.js'
import { PlatformSource } from '../common/graphql/platform-source.js'
import { Defect } from '../defects/entities/defect.entity.js'
import { PlatformGateway } from '../platform/platform.gateway.js'
import { Robot } from '../robots/entities/robot.entity.js'
import type { CreateCompanyInput } from './dto/create-company.input.js'
import { Company, CompanyList } from './entities/company.entity.js'

interface Counted {
  _id: string
  n: number
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly repository: MongoRepository<Company>,
    @InjectRepository(Robot) private readonly robots: MongoRepository<Robot>,
    @InjectRepository(Defect) private readonly defects: MongoRepository<Defect>,
    private readonly platform: PlatformGateway,
    private readonly audit: AuditService,
  ) {}

  private async upsert(company: {
    id: string
    name: string
    subdomain: string
    createdAt: string
  }) {
    await this.repository.updateOne(
      { platformId: company.id },
      {
        $set: {
          platformId: company.id,
          name: company.name,
          subdomain: company.subdomain,
          createdAt: new Date(company.createdAt),
          syncedAt: new Date(),
        },
      },
      { upsert: true },
    )
  }

  /** Makes the copy equal to what the platform says (a company that is gone there is gone here) */
  async sync(): Promise<PlatformSource> {
    try {
      const companies = await this.platform.listCompanies()
      for (const company of companies) await this.upsert(company)
      await this.repository.deleteMany({
        platformId: { $nin: companies.map(company => company.id) },
      })
      return PlatformSource.PLATFORM
    } catch (error) {
      if (!isPlatformUnavailable(error)) throw error
      return PlatformSource.CACHE
    }
  }

  /** The robots and open defects per company, in one query each (not one per company) */
  private async withCounts(companies: Company[]): Promise<Company[]> {
    const [robots, defects] = await Promise.all([
      this.robots
        .aggregate<Counted>([
          { $match: { retiredAt: null, deletedAt: null, companyId: { $ne: null } } },
          { $group: { _id: '$companyId', n: { $sum: 1 } } },
        ])
        .toArray(),
      this.defects
        .aggregate<Counted>([
          { $match: { resolvedAt: null, replacementRobotId: null, deletedAt: null } },
          { $group: { _id: '$companyId', n: { $sum: 1 } } },
        ])
        .toArray(),
    ])
    const robotCount = new Map(robots.map(row => [row._id, row.n]))
    const openDefects = new Map(defects.map(row => [row._id, row.n]))
    for (const company of companies) {
      company.robotCount = robotCount.get(company.platformId) ?? 0
      company.openDefects = openDefects.get(company.platformId) ?? 0
    }
    return companies
  }

  /** The companies, archived ones only when asked for (`withDeleted`) */
  async findAll(withDeleted = false): Promise<CompanyList> {
    const source = await this.sync()
    const companies = (await this.repository.find({ withDeleted })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    return { items: await this.withCounts(companies), source }
  }

  /** One company by the id of the platform; asks the platform when we do not know it (yet) */
  async findOne(id: string, withDeleted = false): Promise<Company> {
    let company = await this.repository.findOne({ where: { platformId: id }, withDeleted })
    if (!company) {
      await this.sync()
      company = await this.repository.findOne({ where: { platformId: id }, withDeleted })
    }
    if (!company) {
      throw new DomainException(404, 'company_not_found', 'This company does not exist')
    }
    return (await this.withCounts([company]))[0]!
  }

  async create(actor: string, input: CreateCompanyInput): Promise<Company> {
    const created = await this.platform.createCompany(input)
    await this.upsert(created)
    // The address of the first administrator belongs to the company: it is not kept here
    await this.audit.record(
      actor,
      'company.created',
      created.id,
      `${created.name} (${created.subdomain})`,
    )
    return this.findOne(created.id)
  }

  /** Soft delete: the company leaves the lists, but it is kept (and its robots stay as they are) */
  async remove(actor: string, id: string): Promise<Company> {
    const company = await this.findOne(id)
    company.deletedBy = actor
    await this.repository.save(company)
    await this.repository.softRemove(company)
    await this.audit.record(actor, 'company.archived', id, company.name)
    return this.findOne(id, true)
  }

  async restore(actor: string, id: string): Promise<Company> {
    const company = await this.findOne(id, true)
    if (!company.deletedAt) {
      throw new DomainException(409, 'not_archived', 'This company is not archived')
    }
    company.deletedBy = null
    await this.repository.save(company)
    await this.repository.recover(company)
    await this.audit.record(actor, 'company.restored', id, company.name)
    return this.findOne(id)
  }

  /** The archived companies (for the archive screen) */
  async archived(): Promise<Company[]> {
    return this.repository.find({
      where: { deletedAt: { $ne: null } } as never,
      withDeleted: true,
    })
  }
}
