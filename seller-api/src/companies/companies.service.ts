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
    @InjectRepository(Company) private readonly repository: MongoRepository<Company>,
    @InjectRepository(Robot) private readonly robots: MongoRepository<Robot>,
    @InjectRepository(Defect) private readonly defects: MongoRepository<Defect>,
    private readonly platform: PlatformGateway,
    private readonly audit: AuditService,
  ) {}

  private async upsert(company: { id: string; name: string; subdomain: string; createdAt: string }) {
    await this.repository.updateOne(
      { id: company.id },
      {
        $set: {
          id: company.id,
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
      await this.repository.deleteMany({ id: { $nin: companies.map(company => company.id) } })
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
          { $match: { retiredAt: null } },
          { $group: { _id: '$companyId', n: { $sum: 1 } } },
        ])
        .toArray(),
      this.defects
        .aggregate<Counted>([
          { $match: { status: 'open' } },
          { $group: { _id: '$companyId', n: { $sum: 1 } } },
        ])
        .toArray(),
    ])
    const robotCount = new Map(robots.map(row => [row._id, row.n]))
    const openDefects = new Map(defects.map(row => [row._id, row.n]))
    for (const company of companies) {
      company.robotCount = robotCount.get(company.id) ?? 0
      company.openDefects = openDefects.get(company.id) ?? 0
    }
    return companies
  }

  async list(): Promise<CompanyList> {
    const source = await this.sync()
    const companies = (await this.repository.find()).sort((a, b) => a.name.localeCompare(b.name))
    return { items: await this.withCounts(companies), source }
  }

  /** One company; asks the platform when we do not know it (yet) */
  async get(id: string): Promise<Company> {
    let company = await this.repository.findOneBy({ id })
    if (!company) {
      await this.sync()
      company = await this.repository.findOneBy({ id })
    }
    if (!company) throw new DomainException(404, 'company_not_found', 'This company does not exist')
    return (await this.withCounts([company]))[0]!
  }

  async create(actor: string, input: CreateCompanyInput): Promise<Company> {
    const created = await this.platform.createCompany(input)
    await this.upsert(created)
    // The address of the first administrator belongs to the company: it is not kept here
    await this.audit.record(actor, 'company.created', created.id, `${created.name} (${created.subdomain})`)
    return this.get(created.id)
  }
}
