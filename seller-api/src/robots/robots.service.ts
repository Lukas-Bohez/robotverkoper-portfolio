import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ObjectId } from 'mongodb'
import type { MongoRepository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { CompaniesService } from '../companies/companies.service.js'
import { DomainException, isPlatformUnavailable } from '../common/domain-exception.js'
import { PlatformSource } from '../common/graphql/platform-source.js'
import { Defect } from '../defects/entities/defect.entity.js'
import { RobotCondition } from '../entities/robot-condition.entity.js'
import { LidState } from '../enums/lid-state.enum.js'
import {
  PlatformGateway,
  type PlatformCondition,
  type RobotLive,
} from '../platform/platform.gateway.js'
import type { CreateRobotInput } from './dto/create-robot.input.js'
import { RobotModel } from './entities/robot-model.entity.js'
import { CreatedRobot, Robot, RobotList } from './entities/robot.entity.js'
import { RobotStatus } from './enums/robot-status.enum.js'
import { nextSerial, parseRobotCode } from './robot-serial.js'

@Injectable()
export class RobotsService {
  constructor(
    @InjectRepository(Robot) private readonly repository: MongoRepository<Robot>,
    @InjectRepository(RobotModel)
    private readonly models: MongoRepository<RobotModel>,
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

  async model(key: string): Promise<RobotModel | null> {
    return this.models.findOneBy({ key })
  }

  /** Puts the models of the catalogue in the database (and keeps them up to date) */
  async upsertModels(
    models: Pick<RobotModel, 'key' | 'name' | 'kind' | 'description'>[],
  ): Promise<void> {
    for (const model of models) {
      await this.models.updateOne({ key: model.key }, { $set: { ...model } }, { upsert: true })
    }
  }

  // ---- robots ----

  async countAll(): Promise<number> {
    return this.repository.count({ deletedAt: null })
  }

  /** A robot that is not replaced, by the id of the platform or by our own id (a robot in the warehouse) */
  async findById(id: string, withDeleted = false): Promise<Robot | null> {
    let robot = await this.repository.findOne({
      where: { platformId: id },
      withDeleted,
    })
    if (!robot && ObjectId.isValid(id)) {
      robot = await this.repository.findOne({
        where: { _id: new ObjectId(id) },
        withDeleted,
      })
    }
    return robot && !robot.retiredAt ? robot : null
  }

  /** A robot by the number on its QR code (see robot-serial.ts) */
  async findBySerial(serial: string, withDeleted = false): Promise<Robot | null> {
    return this.repository.findOne({ where: { serial }, withDeleted })
  }

  /** What a scanner reads: the robot behind a QR code, or null when we do not know that number */
  async findByCode(code: string): Promise<Robot | null> {
    return this.findBySerial(parseRobotCode(code))
  }

  /** The robots in the warehouse: built, but not at a company yet */
  async stock(): Promise<Robot[]> {
    return this.repository.find({ where: { companyId: null, retiredAt: null } })
  }

  async robotsOfCompany(companyId: string, withDeleted = false): Promise<RobotList> {
    await this.companies.findOne(companyId, true)
    const rows = (
      await this.repository.find({ where: { companyId, retiredAt: null }, withDeleted })
    ).sort(
      (a, b) =>
        (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) ||
        a.name.localeCompare(b.name),
    )
    const { live, source } = await this.liveState(rows)
    const open = await this.defects.find({
      where: { companyId, resolvedAt: null, replacementRobotId: null },
    })
    const openDefects = new Map(open.map((defect) => [defect.robotId, String(defect._id)]))
    const models = new Map((await this.models.find()).map((model) => [model.key, model]))
    return {
      items: rows.map((row) =>
        this.view(
          row,
          live.get(row.platformId ?? '') ?? null,
          models.get(row.modelId) ?? null,
          openDefects.get(row.platformId ?? '') ?? null,
        ),
      ),
      source,
    }
  }

  /** What the platform says right now; when it does not answer, what we knew last */
  private async liveState(
    rows: Robot[],
  ): Promise<{ live: Map<string, RobotLive>; source: PlatformSource }> {
    const live = new Map<string, RobotLive>()
    const ids = rows.flatMap((row) => (row.platformId ? [row.platformId] : []))
    if (ids.length === 0) return { live, source: PlatformSource.PLATFORM }
    try {
      const seenAt = new Date()
      for (const item of await this.platform.robotsLive(ids)) {
        live.set(item.id, item)
        await this.repository.updateOne(
          { platformId: item.id },
          { $set: { online: item.online, battery: item.battery, lastSeenAt: seenAt } },
        )
      }
      return { live, source: PlatformSource.PLATFORM }
    } catch (error) {
      if (!isPlatformUnavailable(error)) throw error
      return { live, source: PlatformSource.CACHE }
    }
  }

  view(
    row: Robot,
    live: RobotLive | null,
    model: RobotModel | null,
    openDefectId: string | null,
  ): Robot {
    const online = live ? live.online : row.online
    const battery = live ? live.battery : row.battery
    let status: RobotStatus
    if (row.deletedAt) status = RobotStatus.OUT_OF_SERVICE
    else if (row.companyId === null) status = RobotStatus.STOCK
    else if (openDefectId !== null) status = RobotStatus.DEFECT
    else if (online === null || online === undefined) status = RobotStatus.UNKNOWN
    else status = online ? RobotStatus.ONLINE : RobotStatus.OFFLINE
    return Object.assign(row, {
      online: online ?? null,
      battery: battery ?? null,
      lastSeenAt: row.lastSeenAt ?? null,
      model,
      status,
      openDefectId,
    })
  }

  /**
   * The condition of robots (tilt, cargo, lid, temperature, location), keyed by the robot id. It is what the
   * platform last heard from the robot; a platform that does not know it, or does not answer, gives an empty map.
   */
  async conditionsOf(robots: Robot[]): Promise<Map<string, RobotCondition>> {
    const result = new Map<string, RobotCondition>()
    const ids = robots.flatMap((robot) => (robot.platformId ? [robot.platformId] : []))
    if (ids.length === 0 || !this.platform.robotConditions) return result
    let found: PlatformCondition[]
    try {
      found = await this.platform.robotConditions(ids)
    } catch (error) {
      if (!isPlatformUnavailable(error)) throw error
      return result
    }
    const byId = new Map(found.map((item) => [item.id, item]))
    for (const robot of robots) {
      const condition = robot.platformId ? byId.get(robot.platformId) : undefined
      if (condition) result.set(robot.id, this.condition(robot, condition))
    }
    return result
  }

  private condition(robot: Robot, platform: PlatformCondition): RobotCondition {
    return {
      tilted: platform.tilted,
      tiltDegrees: platform.tiltDegrees,
      hasCargo: platform.hasCargo,
      cargoSummary: platform.cargoSummary,
      cargoSince: platform.cargoSince,
      compartmentTemp: platform.compartmentTemp,
      lid: (platform.lid as LidState) ?? LidState.LOCKED,
      battery: robot.battery ?? null,
      online: robot.online ?? null,
      lastSeenAt: robot.lastSeenAt ? robot.lastSeenAt.toISOString() : null,
      errorCode: platform.errorCode,
      errorText: platform.errorText,
      location: platform.location
        ? {
            country: platform.location.country,
            address: platform.location.address,
            geometry: {
              type: 'Point',
              coordinates: [platform.location.longitude, platform.location.latitude],
            },
          }
        : (robot.location ?? null),
      capturedAt: new Date().toISOString(),
    }
  }

  /** Makes a robot and hands out its key. The key is shown once: only its first characters are kept. */
  async create(
    actor: string,
    companyId: string,
    input: CreateRobotInput,
    options: { serial?: string } = {},
  ): Promise<CreatedRobot> {
    await this.companies.findOne(companyId)
    const model = await this.model(input.modelId)
    if (!model) {
      throw new DomainException(404, 'model_not_found', 'This robot model does not exist')
    }
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
          platformId: registered.id,
          companyId,
          modelId: model.key,
          name: input.name,
          serial: options.serial ?? (await this.newSerial()),
          apiKeyPrefix: registered.apiKeyPrefix,
          createdBy: actor,
          retiredAt: null,
          online: null,
          battery: null,
          lastSeenAt: null,
          location: null,
        }),
      )
    } catch (error) {
      // No record here: the key must not stay valid for a robot nobody knows
      await this.platform.retireRobot(registered.id).catch(() => undefined)
      throw error
    }
    await this.audit.record(
      actor,
      'robot.created',
      registered.id,
      `${input.name}, ${model.name}, key ${registered.apiKeyPrefix}…`,
    )
    return { robot: this.view(saved, null, model, null), apiKey: registered.apiKey }
  }

  /** The next serial number (one more than the highest in use, also by archived robots) */
  async newSerial(): Promise<string> {
    const all = await this.repository.find({ withDeleted: true })
    return nextSerial(all.map((robot) => robot.serial))
  }

  /** Puts a robot in the warehouse: built and labelled, waiting to be scanned by a technician (seed and tests) */
  async addToStock(
    actor: string,
    input: { name: string; modelId: string; serial?: string },
  ): Promise<Robot> {
    const model = await this.model(input.modelId)
    if (!model) {
      throw new DomainException(404, 'model_not_found', 'This robot model does not exist')
    }
    const serial = input.serial ?? (await this.newSerial())
    if (await this.findBySerial(serial, true)) {
      throw new DomainException(409, 'serial_taken', `The number ${serial} is in use`)
    }
    const saved = await this.repository.save(
      this.repository.create({
        platformId: null,
        companyId: null,
        modelId: model.key,
        name: input.name,
        serial,
        apiKeyPrefix: null,
        createdBy: actor,
        retiredAt: null,
        online: null,
        battery: 100,
        lastSeenAt: null,
        location: null,
      }),
    )
    await this.audit.record(actor, 'robot.stocked', serial, `${input.name}, ${model.name}`)
    return saved
  }

  /**
   * Gives a defective robot a successor at the same company. Its key stops working first (a robot with a defect
   * may be lost or stolen), then a new robot with a new key takes its place.
   */
  async replace(actor: string, old: Robot, name: string): Promise<CreatedRobot> {
    const model = await this.requireModel(old.modelId)
    await this.platform.retireRobot(old.platformId!)
    const registered = await this.platform.registerRobot({
      companyId: old.companyId!,
      modelKind: model.kind,
      name,
    })
    const saved = await this.repository.save(
      this.repository.create({
        platformId: registered.id,
        companyId: old.companyId,
        modelId: old.modelId,
        name,
        serial: await this.newSerial(),
        apiKeyPrefix: registered.apiKeyPrefix,
        createdBy: actor,
        retiredAt: null,
        online: null,
        battery: null,
        lastSeenAt: null,
        location: old.location,
      }),
    )
    await this.retire(old)
    await this.audit.record(
      actor,
      'robot.replaced',
      old.platformId,
      `${old.name} → ${name}, key ${registered.apiKeyPrefix}…`,
    )
    return { robot: this.view(saved, null, model, null), apiKey: registered.apiKey }
  }

  /**
   * The replacement with the QR codes: the technician scanned a robot of the warehouse (`serial`). That robot
   * takes the place of the defective one: same company, same name, a new key. It must be in the warehouse and
   * of the same kind (a food robot is not replaced by a parcel robot).
   */
  async replaceWithStock(
    actor: string,
    old: Robot,
    code: string,
    name?: string,
  ): Promise<CreatedRobot> {
    const stock = await this.findBySerial(parseRobotCode(code))
    if (!stock) {
      throw new DomainException(404, 'robot_not_found', 'We do not know this robot')
    }
    if (stock.companyId !== null || stock.platformId !== null) {
      throw new DomainException(409, 'robot_not_in_stock', 'This robot is not in the warehouse')
    }
    const model = await this.requireModel(stock.modelId)
    const oldModel = await this.requireModel(old.modelId)
    if (model.kind !== oldModel.kind) {
      throw new DomainException(
        409,
        'model_mismatch',
        'The new robot is not the same kind of robot',
      )
    }
    const newName = name ?? old.name
    await this.platform.retireRobot(old.platformId!)
    const registered = await this.platform.registerRobot({
      companyId: old.companyId!,
      modelKind: model.kind,
      name: newName,
    })
    stock.platformId = registered.id
    stock.companyId = old.companyId
    stock.name = newName
    stock.apiKeyPrefix = registered.apiKeyPrefix
    stock.location = old.location
    const saved = await this.repository.save(stock)
    await this.retire(old)
    await this.audit.record(
      actor,
      'robot.replaced',
      old.platformId,
      `${old.name} → ${stock.serial}, key ${registered.apiKeyPrefix}…`,
    )
    return { robot: this.view(saved, null, model, null), apiKey: registered.apiKey }
  }

  private async requireModel(key: string): Promise<RobotModel> {
    const model = await this.model(key)
    if (!model) {
      throw new DomainException(404, 'model_not_found', 'This robot model does not exist')
    }
    return model
  }

  /** The replaced robot is gone from the lists (it is kept for history) */
  private async retire(old: Robot): Promise<void> {
    await this.repository.updateOne(
      { _id: old._id as never, retiredAt: null },
      { $set: { retiredAt: new Date() } },
    )
  }

  /** Puts a robot out of service (soft delete): its key stops working. A robot with an open defect cannot. */
  async remove(actor: string, id: string): Promise<Robot> {
    const robot = await this.findById(id)
    if (!robot) {
      throw new DomainException(404, 'robot_not_found', 'This robot does not exist')
    }
    if (robot.platformId) {
      const open = await this.defects.count({
        robotId: robot.platformId,
        resolvedAt: null,
        replacementRobotId: null,
        deletedAt: null,
      })
      if (open > 0) {
        throw new DomainException(
          409,
          'robot_has_defect',
          'Close or replace the open defect of this robot first',
        )
      }
      await this.platform.retireRobot(robot.platformId)
    }
    robot.deletedBy = actor
    await this.repository.save(robot)
    await this.repository.softRemove(robot)
    await this.audit.record(actor, 'robot.archived', robot.platformId ?? robot.serial, robot.name)
    return this.viewOf((await this.findById(id, true))!)
  }

  async restore(actor: string, id: string): Promise<Robot> {
    const robot = await this.findById(id, true)
    if (!robot) {
      throw new DomainException(404, 'robot_not_found', 'This robot does not exist')
    }
    if (!robot.deletedAt) {
      throw new DomainException(409, 'not_archived', 'This robot is not out of service')
    }
    if (robot.platformId) await this.platform.reinstateRobot(robot.platformId)
    robot.deletedBy = null
    await this.repository.save(robot)
    await this.repository.recover(robot)
    await this.audit.record(actor, 'robot.restored', robot.platformId ?? robot.serial, robot.name)
    return this.viewOf((await this.findById(id))!)
  }

  /** The robots that are out of service (for the archive screen) */
  async archived(): Promise<Robot[]> {
    return this.repository.find({
      where: { deletedAt: { $ne: null } } as never,
      withDeleted: true,
    })
  }

  /** A robot with its model and status filled in (for an answer that is not a list) */
  async viewOf(robot: Robot): Promise<Robot> {
    const model = await this.model(robot.modelId)
    const open = robot.platformId
      ? await this.defects.findOne({
          where: { robotId: robot.platformId, resolvedAt: null, replacementRobotId: null },
        })
      : null
    return this.view(robot, null, model, open ? String(open._id) : null)
  }
}
