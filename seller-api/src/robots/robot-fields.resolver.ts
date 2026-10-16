import { ID, Parent, ResolveField, Resolver } from '@nestjs/graphql'
import { RobotModel } from './entities/robot-model.entity.js'
import { Robot, RobotStatus } from './entities/robot.entity.js'
import { RobotModelsLoader } from './robots.loaders.js'

/**
 * The fields of a robot that are worked out when asked. A robot that the robot list built already carries them;
 * a robot that comes from elsewhere (the robot of a defect) gets them here, with a DataLoader for the model.
 */
@Resolver(() => Robot)
export class RobotFieldsResolver {
  constructor(private readonly models: RobotModelsLoader) {}

  @ResolveField(() => RobotModel, { nullable: true })
  model(@Parent() robot: Robot): Promise<RobotModel | null> | RobotModel | null {
    return robot.model !== undefined ? robot.model : this.models.load(robot.modelId)
  }

  @ResolveField(() => RobotStatus)
  status(@Parent() robot: Robot): RobotStatus {
    if (robot.status) return robot.status
    if (robot.online === null || robot.online === undefined) return RobotStatus.UNKNOWN
    return robot.online ? RobotStatus.ONLINE : RobotStatus.OFFLINE
  }

  @ResolveField(() => ID, { nullable: true })
  openDefectId(@Parent() robot: Robot): string | null {
    return robot.openDefectId ?? null
  }
}
