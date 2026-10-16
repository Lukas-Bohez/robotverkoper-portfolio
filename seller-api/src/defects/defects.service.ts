import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { PubSub } from 'graphql-subscriptions'
import type { Point } from 'geojson'
import type { MongoRepository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { yearRange } from '../audit/audit.service.js'
import { DomainException } from '../common/domain-exception.js'
import { PUB_SUB } from '../common/realtime/realtime.module.js'
import { distanceInMeters } from '../common/utils/geo.util.js'
import { toObjectId } from '../common/utils/mongo.util.js'
import { CompaniesService } from '../companies/companies.service.js'
import { CreatedRobot } from '../robots/entities/robot.entity.js'
import { RobotsService } from '../robots/robots.service.js'
import type { CloseDefectInput, ReplaceRobotInput, ReportDefectInput } from './dto/defect.inputs.js'
import { Defect } from './entities/defect.entity.js'
import {
  CHECKLIST_ITEMS,
  DefectResolution,
  DefectStatusType,
  OPEN_STATUSES,
} from './enums/defect.enums.js'
import { NearbyDefect, TechnicianCall } from './models/defect.models.js'

/** The channels of the realtime part: lists refresh, the detail of one defect refreshes, technicians are called */
export const DEFECTS_CHANGED = 'defectsChanged'
export const DEFECT_UPDATED = 'defectUpdated'
export const TECHNICIAN_CALLED = 'technicianCalled'

export interface ReplacedRobotResult {
  defect: Defect
  robot: CreatedRobot['robot']
  apiKey: string
}

export interface DefectFilter {
  /** Not resolved yet: open, en route or on site */
  onlyOpen?: boolean
  statuses?: DefectStatusType[]
  /** Only the defects reported in this calendar year */
  year?: number | null
  withDeleted?: boolean
  /** Defects in cold storage are left out unless asked for */
  includeCold?: boolean
  /** Only the defects of this technician */
  assignedTo?: string | null
}

type StatusFields = Pick<
  Defect,
  'deletedAt' | 'replacementRobotId' | 'resolvedAt' | 'onSiteAt' | 'claimedAt' | 'createdAt'
>

/**
 * The status follows from what happened to the defect; it is not stored. The first row that matches wins:
 *
 * | # | Status     | Condition                                                                       |
 * | - | ---------- | ------------------------------------------------------------------------------- |
 * | 1 | ARCHIVED   | `deletedAt` is set (soft delete)                                                |
 * | 2 | UNKNOWN    | the data does not add up (resolved before it was reported, arrival without a   |
 * |   |            | technician, a replacement that is not resolved)                                 |
 * | 3 | REPLACED   | a replacement robot is set                                                      |
 * | 4 | CLOSED     | `resolvedAt` is set                                                             |
 * | 5 | ON_SITE    | `onSiteAt` is set                                                               |
 * | 6 | EN_ROUTE   | `claimedAt` is set                                                              |
 * | 7 | OPEN       | none of the above                                                               |
 */
export function defectStatus(defect: StatusFields): DefectStatusType {
  if (defect.deletedAt) return DefectStatusType.ARCHIVED
  const resolvedBeforeReported =
    defect.resolvedAt && defect.createdAt && defect.resolvedAt < defect.createdAt
  const arrivedWithoutTechnician = defect.onSiteAt && !defect.claimedAt
  const replacedButNotResolved = defect.replacementRobotId && !defect.resolvedAt
  if (resolvedBeforeReported || arrivedWithoutTechnician || replacedButNotResolved) {
    return DefectStatusType.UNKNOWN
  }
  if (defect.replacementRobotId) return DefectStatusType.REPLACED
  if (defect.resolvedAt) return DefectStatusType.CLOSED
  if (defect.onSiteAt) return DefectStatusType.ON_SITE
  if (defect.claimedAt) return DefectStatusType.EN_ROUTE
  return DefectStatusType.OPEN
}

@Injectable()
export class DefectsService {
  constructor(
    @InjectRepository(Defect) private readonly repository: MongoRepository<Defect>,
    private readonly robots: RobotsService,
    private readonly companies: CompaniesService,
    private readonly audit: AuditService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  /** The business logic of the status lives here, so the resolver, the filters and the tests all use one rule */
  getStatus(defect: StatusFields): DefectStatusType {
    return defectStatus(defect)
  }

  /** Tells the open screens that the defects changed (realtime) */
  private async announce(defect: Defect): Promise<void> {
    const openDefects = await this.repository.count({
      resolvedAt: null,
      replacementRobotId: null,
      deletedAt: null,
    })
    await this.pubSub.publish(DEFECTS_CHANGED, { [DEFECTS_CHANGED]: { openDefects } })
    await this.pubSub.publish(DEFECT_UPDATED, { [DEFECT_UPDATED]: defect })
  }

  // ---- reading ----

  async findAll(filter: DefectFilter = {}): Promise<Defect[]> {
    const statuses = filter.onlyOpen ? [...OPEN_STATUSES] : filter.statuses
    const where: Record<string, unknown> = {}
    if (!filter.includeCold) where.coldAt = null
    if (filter.assignedTo) where.assignedTo = filter.assignedTo
    if (filter.year) {
      const { from, to } = yearRange(filter.year)
      where.createdAt = { $gte: from, $lt: to }
    }
    // An archived defect is only loaded when it is asked for (or its status is)
    const withDeleted =
      filter.withDeleted === true || statuses?.includes(DefectStatusType.ARCHIVED) === true
    const found = await this.repository.find({
      where: where as never,
      withDeleted,
      order: { createdAt: 'DESC' },
    })
    return statuses ? found.filter(defect => statuses.includes(this.getStatus(defect))) : found
  }

  /** The defects with one of these statuses (the status is worked out, so this filters after loading) */
  findByStatus(statuses: DefectStatusType[], filter: DefectFilter = {}): Promise<Defect[]> {
    return statuses.length === 0
      ? Promise.resolve([])
      : this.findAll({ ...filter, statuses, onlyOpen: false })
  }

  async findOne(id: string, withDeleted = false): Promise<Defect> {
    const defect = await this.repository.findOne({
      where: { _id: toObjectId(id) },
      withDeleted,
    })
    if (!defect) throw new DomainException(404, 'defect_not_found', 'This defect does not exist')
    return defect
  }

  /** The distance in meters from a place to the robot of a defect, or null when the robot has no place */
  distanceFrom(defect: Defect, point: Point): number | null {
    const place = defect.location?.geometry
    return place ? distanceInMeters(point, place) : null
  }

  /** Other defects that are not resolved, close to this one: the technician is there anyway */
  async nearby(id: string, radiusMeters: number): Promise<NearbyDefect[]> {
    const defect = await this.findOne(id)
    const origin = defect.location?.geometry
    if (!origin) return []
    const others = await this.findAll({ onlyOpen: true })
    return others
      .filter(other => other.id !== defect.id)
      .flatMap(other => {
        const distanceMeters = this.distanceFrom(other, origin)
        return distanceMeters !== null && distanceMeters <= radiusMeters
          ? [{ defect: other, distanceMeters }]
          : []
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
  }

  // ---- writing ----

  async report(actor: string, robotId: string, input: ReportDefectInput): Promise<Defect> {
    const robot = await this.robots.findById(robotId)
    if (!robot) throw new DomainException(404, 'robot_not_found', 'This robot does not exist')
    if (!robot.platformId || !robot.companyId) {
      throw new DomainException(409, 'robot_not_at_company', 'This robot is not at a company')
    }
    const existing = await this.repository.findOne({
      where: { robotId: robot.platformId, resolvedAt: null, replacementRobotId: null },
    })
    if (existing) {
      throw new DomainException(409, 'defect_exists', 'This robot already has an open defect')
    }
    // Everything a technician wants to know, as the platform last heard it, kept with the defect
    const condition = (await this.robots.conditionsOf([robot])).get(robot.id) ?? null
    const saved = await this.repository.save(
      this.repository.create({
        robotId: robot.platformId,
        companyId: robot.companyId,
        summary: input.summary,
        severity: input.severity,
        reportedBy: actor,
        assignedTo: null,
        claimedAt: null,
        onSiteAt: null,
        checklistDone: [],
        resolution: null,
        resolvedAt: null,
        resolvedBy: null,
        resolutionNote: null,
        replacementRobotId: null,
        condition,
        location: condition?.location ?? robot.location ?? null,
        callRequestedAt: null,
        calledBy: null,
        helpRequestedAt: null,
        coldAt: null,
      }),
    )
    await this.audit.record(actor, 'defect.reported', robot.platformId, `${robot.name}: ${input.summary}`)
    await this.announce(saved)
    return saved
  }

  /** A defect that still needs work */
  private async openOne(id: string): Promise<Defect> {
    const defect = await this.findOne(id)
    if (!OPEN_STATUSES.includes(this.getStatus(defect))) {
      throw new DomainException(409, 'defect_not_open', 'This defect is already resolved')
    }
    return defect
  }

  /** "Ik ga erheen": the technician takes the defect. A technician can take more than one. */
  async claim(actor: string, id: string): Promise<Defect> {
    const defect = await this.openOne(id)
    if (defect.assignedTo && defect.assignedTo !== actor) {
      throw new DomainException(409, 'defect_claimed', 'Another technician already took this defect')
    }
    if (!defect.claimedAt) {
      defect.assignedTo = actor
      defect.claimedAt = new Date()
      await this.repository.save(defect)
      await this.audit.record(actor, 'defect.claimed', defect.robotId)
      await this.announce(defect)
    }
    return defect
  }

  private requireOwner(defect: Defect, actor: string): void {
    if (defect.assignedTo !== actor) {
      throw new DomainException(409, 'not_your_defect', 'Take this defect first ("Ik ga erheen")')
    }
  }

  /** The technician gives the defect back: someone else can take it */
  async release(actor: string, id: string): Promise<Defect> {
    const defect = await this.openOne(id)
    this.requireOwner(defect, actor)
    Object.assign(defect, { assignedTo: null, claimedAt: null, onSiteAt: null, checklistDone: [] })
    await this.repository.save(defect)
    await this.audit.record(actor, 'defect.released', defect.robotId)
    await this.announce(defect)
    return defect
  }

  async markOnSite(actor: string, id: string): Promise<Defect> {
    const defect = await this.openOne(id)
    this.requireOwner(defect, actor)
    if (!defect.onSiteAt) {
      defect.onSiteAt = new Date()
      await this.repository.save(defect)
      await this.audit.record(actor, 'defect.on-site', defect.robotId)
      await this.announce(defect)
    }
    return defect
  }

  /** The safety check on site: which items are done (see CHECKLIST_ITEMS) */
  async updateChecklist(actor: string, id: string, done: string[]): Promise<Defect> {
    const defect = await this.openOne(id)
    this.requireOwner(defect, actor)
    if (!defect.onSiteAt) {
      throw new DomainException(409, 'not_on_site', 'Say that you arrived first')
    }
    const unknown = done.filter(item => !(CHECKLIST_ITEMS as readonly string[]).includes(item))
    if (unknown.length > 0) {
      throw new DomainException(400, 'invalid_checklist', `Not an item of the check: ${unknown.join(', ')}`)
    }
    defect.checklistDone = [...new Set(done)]
    await this.repository.save(defect)
    await this.announce(defect)
    return defect
  }

  /** Food that is still in the robot must come out before the robot is repaired or replaced */
  private requireCargoRemoved(defect: Defect): void {
    if (defect.condition?.hasCargo && !defect.checklistDone.includes('cargo_removed')) {
      throw new DomainException(
        409,
        'cargo_still_aboard',
        'There is still food in the robot: take it out first and tick it off in the check',
      )
    }
  }

  private async resolve(
    actor: string,
    defect: Defect,
    resolution: DefectResolution,
    note: string | null,
    replacementRobotId: string | null,
  ): Promise<Defect> {
    defect.resolution = resolution
    defect.resolvedAt = new Date()
    defect.resolvedBy = actor
    defect.resolutionNote = note
    defect.replacementRobotId = replacementRobotId
    return this.repository.save(defect)
  }

  async close(actor: string, id: string, input: CloseDefectInput): Promise<Defect> {
    const defect = await this.openOne(id)
    // A false alarm has no food to take out: the robot was fine
    if (input.resolution !== DefectResolution.FALSE_ALARM) this.requireCargoRemoved(defect)
    const closed = await this.resolve(actor, defect, input.resolution, input.note ?? null, null)
    await this.audit.record(actor, 'defect.closed', defect.robotId, `${input.resolution}${input.note ? `: ${input.note}` : ''}`)
    await this.announce(closed)
    return closed
  }

  /** Replaces a defective robot: its key stops working, a new robot (made, or scanned from the warehouse) takes its place */
  async replace(actor: string, id: string, input: ReplaceRobotInput): Promise<ReplacedRobotResult> {
    const defect = await this.openOne(id)
    this.requireCargoRemoved(defect)
    const old = await this.robots.findById(defect.robotId)
    if (!old) throw new DomainException(404, 'robot_not_found', 'This robot does not exist')
    const created = input.code
      ? await this.robots.replaceWithStock(actor, old, input.code, input.name)
      : await this.robots.replace(actor, old, input.name ?? `${old.name} (vervanger)`)
    const replaced = await this.resolve(actor, defect, DefectResolution.REPLACED, null, created.robot.id)
    await this.announce(replaced)
    return { defect: replaced, robot: created.robot, apiKey: created.apiKey }
  }

  /** An administrator calls for a technician: all technicians that watch their dashboard hear it */
  async callTechnician(actor: string, id: string): Promise<Defect> {
    const defect = await this.openOne(id)
    defect.callRequestedAt = new Date()
    defect.calledBy = actor
    await this.repository.save(defect)
    await this.audit.record(actor, 'defect.called', defect.robotId)
    await this.broadcast('CALL', defect, actor)
    await this.announce(defect)
    return defect
  }

  /** A technician asks a colleague or the administrator for help */
  async requestHelp(actor: string, id: string): Promise<Defect> {
    const defect = await this.openOne(id)
    defect.helpRequestedAt = new Date()
    await this.repository.save(defect)
    await this.audit.record(actor, 'defect.help', defect.robotId)
    await this.broadcast('HELP', defect, actor)
    await this.announce(defect)
    return defect
  }

  private async broadcast(kind: 'CALL' | 'HELP', defect: Defect, actor: string): Promise<void> {
    const robot = await this.robots.findById(defect.robotId, true)
    const company = await this.companies.findOne(defect.companyId, true).catch(() => null)
    const call: TechnicianCall = {
      kind,
      defectId: defect.id,
      robotName: robot?.name ?? defect.robotId,
      companyName: company?.name ?? '',
      summary: defect.summary,
      hasCargo: defect.condition?.hasCargo ?? false,
      requestedBy: actor,
      at: new Date(),
    }
    await this.pubSub.publish(TECHNICIAN_CALLED, { [TECHNICIAN_CALLED]: call })
  }

  /** Soft delete: only a resolved defect can go to the archive. It is kept and can be restored. */
  async remove(actor: string, id: string): Promise<Defect> {
    const defect = await this.findOne(id)
    const status = this.getStatus(defect)
    if (status !== DefectStatusType.CLOSED && status !== DefectStatusType.REPLACED) {
      throw new DomainException(409, 'defect_not_resolved', 'Only a resolved defect can be archived')
    }
    defect.deletedBy = actor
    await this.repository.save(defect)
    await this.repository.softRemove(defect)
    await this.audit.record(actor, 'defect.archived', defect.robotId)
    return this.findOne(id, true)
  }

  async restore(actor: string, id: string): Promise<Defect> {
    const defect = await this.findOne(id, true)
    if (!defect.deletedAt) {
      throw new DomainException(409, 'not_archived', 'This defect is not archived')
    }
    defect.deletedBy = null
    await this.repository.save(defect)
    await this.repository.recover(defect)
    await this.audit.record(actor, 'defect.restored', defect.robotId)
    return this.findOne(id)
  }

  /** The archived defects (for the archive screen) */
  async archived(): Promise<Defect[]> {
    return this.repository.find({
      where: { deletedAt: { $ne: null } } as never,
      withDeleted: true,
    })
  }
}
