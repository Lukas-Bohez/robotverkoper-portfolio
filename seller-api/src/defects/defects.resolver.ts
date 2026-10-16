import { Inject } from '@nestjs/common'
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql'
import type { PubSub } from 'graphql-subscriptions'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { PUB_SUB } from '../common/realtime/realtime.module.js'
import { DEFECTS_CHANGED, DefectsService } from './defects.service.js'
import { ReplaceRobotInput, ReportDefectInput } from './dto/defect.inputs.js'
import { Defect } from './entities/defect.entity.js'
import { DefectsChanged, ReplacedRobot } from './models/defect.models.js'

@Resolver(() => Defect)
export class DefectsResolver {
  constructor(
    private readonly defects: DefectsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @RequirePermissions('defects:read')
  @Query(() => [Defect], { name: 'defects', description: 'The defects of our robots, newest first' })
  list(
    @Args('onlyOpen', { defaultValue: true }) onlyOpen: boolean,
  ): Promise<Defect[]> {
    return this.defects.list(onlyOpen)
  }

  @RequirePermissions('defects:manage')
  @Mutation(() => Defect, { description: 'Reports a defect of a robot' })
  reportDefect(
    @CurrentCaller() caller: Caller,
    @Args('robotId', { type: () => ID }) robotId: string,
    @Args('input') input: ReportDefectInput,
  ): Promise<Defect> {
    return this.defects.report(caller.email, robotId, input)
  }

  @RequirePermissions('defects:manage')
  @Mutation(() => Defect, { description: 'Closes a defect without replacing the robot' })
  closeDefect(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Defect> {
    return this.defects.close(caller.email, id)
  }

  @RequirePermissions('robots:create')
  @Mutation(() => ReplacedRobot, {
    description: 'Replaces the robot of a defect: its key stops working and a new robot with a new key takes its place',
  })
  replaceRobot(
    @CurrentCaller() caller: Caller,
    @Args('defectId', { type: () => ID }) defectId: string,
    @Args('input', { nullable: true }) input?: ReplaceRobotInput,
  ): Promise<ReplacedRobot> {
    return this.defects.replace(caller.email, defectId, input ?? {})
  }

  /** Realtime: the screen with the defects refreshes itself when a defect is reported, closed or replaced */
  @RequirePermissions('defects:read')
  @Subscription(() => DefectsChanged, { name: DEFECTS_CHANGED })
  defectsChanged() {
    return this.pubSub.asyncIterableIterator(DEFECTS_CHANGED)
  }
}
