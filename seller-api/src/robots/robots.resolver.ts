import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { DomainException } from '../common/domain-exception.js'
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
    description:
      'The robots of a company, with what the platform says about them (or the last known state). Robots out of service only when asked for.',
  })
  findAll(
    @Args('companyId', { type: () => ID }) companyId: string,
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
  ): Promise<RobotList> {
    return this.robots.robotsOfCompany(companyId, withDeleted)
  }

  @RequirePermissions('robots:read')
  @Query(() => Robot, { name: 'robot', description: 'One robot, with its condition' })
  async findOne(
    @Args('id', { type: () => ID }) id: string,
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
  ): Promise<Robot> {
    const robot = await this.robots.findById(id, withDeleted)
    if (!robot) {
      throw new DomainException(404, 'robot_not_found', 'This robot does not exist')
    }
    return this.robots.viewOf(robot)
  }

  @RequirePermissions('robots:read')
  @Query(() => Robot, {
    name: 'robotByCode',
    nullable: true,
    description:
      'The robot behind a scanned QR code (rbt:RBT-000417 or the number alone), or null when unknown',
  })
  async findByCode(@Args('code') code: string): Promise<Robot | null> {
    const robot = await this.robots.findByCode(code)
    return robot ? this.robots.viewOf(robot) : null
  }

  @RequirePermissions('robots:read')
  @Query(() => [Robot], {
    description: 'The robots in the warehouse: built, but not at a company yet',
  })
  stockRobots(): Promise<Robot[]> {
    return this.robots.stock()
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

  @RequirePermissions('robots:archive')
  @Mutation(() => Robot, {
    description:
      'Puts a robot out of service (soft delete): its key stops working and it can be restored',
  })
  removeRobot(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Robot> {
    return this.robots.remove(caller.email, id)
  }

  @RequirePermissions('archive:restore')
  @Mutation(() => Robot)
  restoreRobot(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Robot> {
    return this.robots.restore(caller.email, id)
  }
}
