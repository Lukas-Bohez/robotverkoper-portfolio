import { ID, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { RobotCondition } from '../entities/robot-condition.entity.js'
import { RobotModel } from './entities/robot-model.entity.js'
import { Robot } from './entities/robot.entity.js'
import { RobotStatus } from './enums/robot-status.enum.js'
import { qrPayload } from './robot-serial.js'
import { RobotConditionsLoader, RobotModelsLoader } from './robots.loaders.js'

/**
 * The fields of a robot that are worked out when asked. A robot that the robot list built already carries them;
 * a robot that comes from elsewhere (the robot of a defect) gets them here, with DataLoaders.
 */
@Resolver(() => Robot)
export class RobotFieldsResolver {
  constructor(
    private readonly models: RobotModelsLoader,
    private readonly conditions: RobotConditionsLoader,
  ) {}

  @ResolveField(() => RobotModel, { nullable: true })
  model(@Parent() robot: Robot): Promise<RobotModel | null> | RobotModel | null {
    return robot.model !== undefined ? robot.model : this.models.load(robot.modelId)
  }

  @ResolveField(() => RobotStatus)
  status(@Parent() robot: Robot): RobotStatus {
    if (robot.status) return robot.status
    if (robot.deletedAt) return RobotStatus.OUT_OF_SERVICE
    if (robot.companyId === null) return RobotStatus.STOCK
    if (robot.online === null || robot.online === undefined) return RobotStatus.UNKNOWN
    return robot.online ? RobotStatus.ONLINE : RobotStatus.OFFLINE
  }

  @ResolveField(() => ID, { nullable: true })
  openDefectId(@Parent() robot: Robot): string | null {
    return robot.openDefectId ?? null
  }

  @ResolveField(() => RobotCondition, {
    nullable: true,
    description:
      'What the platform last heard: tilt, cargo, lid, temperature, location. Null when it does not know.',
  })
  condition(@Parent() robot: Robot): Promise<RobotCondition | null> {
    return this.conditions.load(robot)
  }

  @ResolveField(() => String, { description: 'What the QR code on the robot says' })
  qrCode(@Parent() robot: Robot): string {
    return qrPayload(robot.serial)
  }

  @ResolveField(() => Boolean, {
    description: 'The robot is in the warehouse: a technician can put it at a company',
  })
  inStock(@Parent() robot: Robot): boolean {
    return robot.companyId === null && !robot.deletedAt
  }
}
