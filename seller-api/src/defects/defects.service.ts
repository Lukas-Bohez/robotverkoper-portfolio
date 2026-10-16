import { randomUUID } from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { PubSub } from 'graphql-subscriptions'
import type { MongoRepository } from 'typeorm'
import { AuditService } from '../audit/audit.service.js'
import { DomainException } from '../common/domain-exception.js'
import { PUB_SUB } from '../common/realtime/realtime.module.js'
import { CreatedRobot } from '../robots/entities/robot.entity.js'
import { RobotsService } from '../robots/robots.service.js'
import type { ReplaceRobotInput, ReportDefectInput } from './dto/defect.inputs.js'
import { Defect, DefectStatus } from './entities/defect.entity.js'

export const DEFECTS_CHANGED = 'defectsChanged'

export interface ReplacedRobotResult {
  defect: Defect
  robot: CreatedRobot['robot']
  apiKey: string
}

@Injectable()
export class DefectsService {
  constructor(
    @InjectRepository(Defect) private readonly repository: MongoRepository<Defect>,
    private readonly robots: RobotsService,
    private readonly audit: AuditService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  /** Tells the open screens that the defects changed (realtime) */
  private async announce(): Promise<void> {
    const openDefects = await this.repository.count({ status: DefectStatus.OPEN })
    await this.pubSub.publish(DEFECTS_CHANGED, { [DEFECTS_CHANGED]: { openDefects } })
  }

  async report(actor: string, robotId: string, input: ReportDefectInput): Promise<Defect> {
    const robot = await this.robots.find(robotId)
    if (!robot) throw new DomainException(404, 'robot_not_found', 'This robot does not exist')
    const saved = await this.repository.save(
      this.repository.create({
        id: randomUUID(),
        robotId,
        companyId: robot.companyId,
        summary: input.summary,
        severity: input.severity,
        status: DefectStatus.OPEN,
        reportedBy: actor,
        createdAt: new Date(),
        resolvedAt: null,
        replacementRobotId: null,
      }),
    )
    await this.audit.record(actor, 'defect.reported', robotId, `${robot.name}: ${input.summary}`)
    await this.announce()
    return saved
  }

  async list(onlyOpen: boolean): Promise<Defect[]> {
    return this.repository.find({
      where: onlyOpen ? { status: DefectStatus.OPEN } : {},
      order: { createdAt: 'DESC' },
    })
  }

  private async open(defectId: string): Promise<Defect> {
    const defect = await this.repository.findOneBy({ id: defectId })
    if (!defect) throw new DomainException(404, 'defect_not_found', 'This defect does not exist')
    if (defect.status !== DefectStatus.OPEN) {
      throw new DomainException(409, 'defect_not_open', 'This defect is already resolved')
    }
    return defect
  }

  private async resolve(defect: Defect, status: DefectStatus, replacementRobotId: string | null): Promise<Defect> {
    defect.status = status
    defect.resolvedAt = new Date()
    defect.replacementRobotId = replacementRobotId
    return this.repository.save(defect)
  }

  async close(actor: string, defectId: string): Promise<Defect> {
    const defect = await this.open(defectId)
    const closed = await this.resolve(defect, DefectStatus.CLOSED, null)
    await this.audit.record(actor, 'defect.closed', defect.robotId)
    await this.announce()
    return closed
  }

  /** Replaces a defective robot: its key stops working, a new robot with a new key takes its place */
  async replace(actor: string, defectId: string, input: ReplaceRobotInput): Promise<ReplacedRobotResult> {
    const defect = await this.open(defectId)
    const old = await this.robots.find(defect.robotId)
    if (!old) throw new DomainException(404, 'robot_not_found', 'This robot does not exist')
    const name = input.name ?? `${old.name} (vervanger)`
    const created = await this.robots.replace(actor, old, name)
    const replaced = await this.resolve(defect, DefectStatus.REPLACED, created.robot.id)
    await this.announce()
    return { defect: replaced, robot: created.robot, apiKey: created.apiKey }
  }
}
