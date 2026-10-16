import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { MongoRepository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { CompaniesService } from '../companies/companies.service.js'
import { DomainException, isPlatformUnavailable } from '../common/domain-exception.js'
import { PlatformSource } from '../common/graphql/platform-source.js'
import { Defect } from '../defects/entities/defect.entity.js'
import { PlatformGateway, type RobotLive } from '../platform/platform.gateway.js'
import type { CreateRobotInput } from './dto/create-robot.input.js'
import { RobotModel } from './entities/robot-model.entity.js'
import { CreatedRobot, Robot, RobotList, RobotStatus } from './entities/robot.entity.js'

@Injectable()
export class RobotsService {
  constructor(
    @InjectRepository(Robot) private readonly repository: MongoRepository<Robot>,
    @InjectRepository(RobotModel) private readonly models: MongoRepository<RobotModel>,
    @InjectRepository(Defect) private readonly defects: MongoRepository<Defect>,
    private readonly companies: CompaniesService,
    private readonly platform: PlatformGateway,
    private readonly audit: AuditService,
  ) {}

  // ---- the catalogue of what we build ----

  async listModels(): Promise<RobotModel[]> {
    return (await this.models.find()).sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
    )
  }

  async model(id: string): Promise<RobotModel | null> {
    return this.models.findOneBy({ id })
  }

  /** Puts the models of the catalogue in the database (and keeps them up to date) */
  async upsertModels(models: Pick<RobotModel, 'id' | 'name' | 'kind' | 'description'>[]): Promise<void> {
    for (const model of models) {
      await this.models.updateOne({ id: model.id }, { $set: { ...model } }, { upsert: true })
    }
  }

  // ---- robots ----

  async countAll(): Promise<number> {
    return this.repository.count()
  }

  /** A robot that is not replaced (any company) */
  async find(id: string): Promise<Robot | null> {
    const robot = await this.repository.findOneBy({ id })
    return robot && !robot.retiredAt ? robot : null
  }

  async robotsOfCompany(companyId: string): Promise<RobotList> {
    await this.companies.get(companyId)
    const rows = (await this.repository.find({ where: { companyId, retiredAt: null } })).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.name.localeCompare(b.name),
    )
    const { live, source } = await this.liveState(rows)
    const openDefects = new Map(
      (await this.defects.find({ where: { companyId, status: 'open' } })).map(defect => [defect.robotId, defect.id]),
    )
    const models = new Map((await this.models.find()).map(model => [model.id, model]))
    return {
      items: rows.map(row =>
        this.view(row, live.get(row.id) ?? null, models.get(row.modelId) ?? null, openDefects.get(row.id) ?? null),
      ),
      source,
    }
  }

  /** What the platform says right now; when it does not answer, what we knew last */
  private async liveState(rows: Robot[]): Promise<{ live: Map<string, RobotLive>; source: PlatformSource }> {
    const live = new Map<string, RobotLive>()
    if (rows.length === 0) return { live, source: PlatformSource.PLATFORM }
    try {
      const seenAt = new Date()
      for (const item of await this.platform.robotsLive(rows.map(row => row.id))) {
        live.set(item.id, item)
        await this.repository.updateOne(
          { id: item.id },
          { $set: { online: item.online, battery: item.battery, lastSeenAt: seenAt } },
        )
      }
      return { live, source: PlatformSource.PLATFORM }
    } catch (error) {
      if (!isPlatformUnavailable(error)) throw error
      return { live, source: PlatformSource.CACHE }
    }
  }

  view(row: Robot, live: RobotLive | null, model: RobotModel | null, openDefectId: string | null): Robot {
    const online = live ? live.online : row.online
    const battery = live ? live.battery : row.battery
    const status =
      openDefectId !== null
        ? RobotStatus.DEFECT
        : online === null || online === undefined
          ? RobotStatus.UNKNOWN
          : online
            ? RobotStatus.ONLINE
            : RobotStatus.OFFLINE
    return Object.assign(row, {
      online: online ?? null,
      battery: battery ?? null,
      lastSeenAt: row.lastSeenAt ?? null,
      model,
      status,
      openDefectId,
    })
  }

  /** Makes a robot and hands out its key. The key is shown once: only its first characters are kept. */
  async create(actor: string, companyId: string, input: CreateRobotInput): Promise<CreatedRobot> {
    await this.companies.get(companyId)
    const model = await this.model(input.modelId)
    if (!model) throw new DomainException(404, 'model_not_found', 'This robot model does not exist')
    // The client wants one kind of food robot: insulated, so no warm, cold or neutral to choose from
    const registered = await this.platform.registerRobot({
      companyId,
      modelKind: model.kind,
      name: input.name,
    })
    let saved: Robot
    try {
      saved = await this.repository.save(
        this.repository.create({
          id: registered.id,
          companyId,
          modelId: model.id,
          name: input.name,
          apiKeyPrefix: registered.apiKeyPrefix,
          createdBy: actor,
          createdAt: new Date(),
          retiredAt: null,
          online: null,
          battery: null,
          lastSeenAt: null,
        }),
      )
    } catch (error) {
      // No record here: the key must not stay valid for a robot nobody knows
      await this.platform.retireRobot(registered.id).catch(() => undefined)
      throw error
    }
    await this.audit.record(actor, 'robot.created', registered.id, `${input.name}, ${model.name}, key ${registered.apiKeyPrefix}…`)
    return { robot: this.view(saved, null, model, null), apiKey: registered.apiKey }
  }

  /**
   * Gives a defective robot a successor at the same company. Its key stops working first (a robot with a defect
   * may be lost or stolen), then a new robot with a new key takes its place.
   */
  async replace(actor: string, old: Robot, name: string): Promise<CreatedRobot> {
    const model = await this.model(old.modelId)
    if (!model) throw new DomainException(404, 'model_not_found', 'This robot model does not exist')
    await this.platform.retireRobot(old.id)
    const registered = await this.platform.registerRobot({
      companyId: old.companyId,
      modelKind: model.kind,
      name,
    })
    const saved = await this.repository.save(
      this.repository.create({
        id: registered.id,
        companyId: old.companyId,
        modelId: old.modelId,
        name,
        apiKeyPrefix: registered.apiKeyPrefix,
        createdBy: actor,
        createdAt: new Date(),
        retiredAt: null,
        online: null,
        battery: null,
        lastSeenAt: null,
      }),
    )
    await this.repository.updateOne({ id: old.id, retiredAt: null }, { $set: { retiredAt: new Date() } })
    await this.audit.record(actor, 'robot.replaced', old.id, `${old.name} → ${name}, key ${registered.apiKeyPrefix}…`)
    return { robot: this.view(saved, null, model, null), apiKey: registered.apiKey }
  }
}
