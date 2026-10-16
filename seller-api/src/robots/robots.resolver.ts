import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { CreateRobotInput } from './dto/create-robot.input.js'
import { RobotModel } from './entities/robot-model.entity.js'
import { CreatedRobot, Robot, RobotList } from './entities/robot.entity.js'
import { RobotsService } from './robots.service.js'

@Resolver(() => Robot)
export class RobotsResolver {
  constructor(private readonly robots: RobotsService) {}

  @RequirePermissions('robots:read')
  @Query(() => [RobotModel], { description: 'The kinds of robot that we build' })
  robotModels(): Promise<RobotModel[]> {
    return this.robots.listModels()
  }

  @RequirePermissions('robots:read')
  @Query(() => RobotList, {
    name: 'robots',
    description: 'The robots of a company, with what the platform says about them (or the last known state)',
  })
  list(@Args('companyId', { type: () => ID }) companyId: string): Promise<RobotList> {
    return this.robots.robotsOfCompany(companyId)
  }

  @RequirePermissions('robots:create')
  @Mutation(() => CreatedRobot, {
    description: 'Makes a robot for a company and hands out its key. The key is shown this once.',
  })
  createRobot(
    @CurrentCaller() caller: Caller,
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('input') input: CreateRobotInput,
  ): Promise<CreatedRobot> {
    return this.robots.create(caller.email, companyId, input)
  }
}
