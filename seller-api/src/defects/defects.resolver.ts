import { Inject } from '@nestjs/common'
import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql'
import type { PubSub } from 'graphql-subscriptions'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { PUB_SUB } from '../common/realtime/realtime.module.js'
import {
  DEFECT_UPDATED,
  DEFECTS_CHANGED,
  DefectsService,
  TECHNICIAN_CALLED,
} from './defects.service.js'
import { CloseDefectInput, ReplaceRobotInput, ReportDefectInput } from './dto/defect.inputs.js'
import { Defect } from './entities/defect.entity.js'
import { DefectStatusType } from './enums/defect.enums.js'
import {
  DefectsChanged,
  NearbyDefect,
  ReplacedRobot,
  TechnicianCall,
} from './models/defect.models.js'

@Resolver(() => Defect)
export class DefectsResolver {
  constructor(
    private readonly defects: DefectsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  // ---- queries ----

  @RequirePermissions('defects:read')
  @Query(() => [Defect], {
    name: 'defects',
    description:
      'The defects of our robots, newest first. Resolved ones, archived ones and cold storage only when asked for.',
  })
  findAll(
    @Args('onlyOpen', { defaultValue: true }) onlyOpen: boolean,
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
    @Args('includeCold', { defaultValue: false }) includeCold: boolean,
    @Args('mine', { defaultValue: false }) mine: boolean,
    @Args('year', { type: () => Int, nullable: true }) year: number | undefined,
    @CurrentCaller() caller: Caller,
  ): Promise<Defect[]> {
    return this.defects.findAll({
      onlyOpen,
      withDeleted,
      includeCold,
      year,
      assignedTo: mine ? caller.email : null,
    })
  }

  @RequirePermissions('defects:read')
  @Query(() => [Defect], {
    name: 'defectsByStatus',
    description:
      'The defects with one of these statuses. The status is worked out, so the list is filtered after loading.',
  })
  findByStatus(
    @Args('statuses', { type: () => [DefectStatusType] }) statuses: DefectStatusType[],
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
    @Args('includeCold', { defaultValue: false }) includeCold: boolean,
    @Args('year', { type: () => Int, nullable: true }) year?: number,
  ): Promise<Defect[]> {
    return this.defects.findByStatus(statuses, { withDeleted, includeCold, year })
  }

  @RequirePermissions('defects:read')
  @Query(() => Defect, { name: 'defect' })
  findOne(
    @Args('id', { type: () => ID }) id: string,
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
  ): Promise<Defect> {
    return this.defects.findOne(id, withDeleted)
  }

  @RequirePermissions('defects:read')
  @Query(() => [NearbyDefect], {
    description: 'Other defects that are not resolved yet and lie close to this one, nearest first',
  })
  nearbyDefects(
    @Args('defectId', { type: () => ID }) defectId: string,
    @Args('radiusMeters', { type: () => Int, defaultValue: 1000 }) radiusMeters: number,
  ): Promise<NearbyDefect[]> {
    return this.defects.nearby(defectId, radiusMeters)
  }

  // ---- mutations ----

  @RequirePermissions('defects:report')
  @Mutation(() => Defect, {
    description: 'Reports a defect of a robot, with the condition of the robot at that moment',
  })
  reportDefect(
    @CurrentCaller() caller: Caller,
    @Args('robotId', { type: () => ID }) robotId: string,
    @Args('input') input: ReportDefectInput,
  ): Promise<Defect> {
    return this.defects.report(caller.email, robotId, input)
  }

  @RequirePermissions('defects:claim')
  @Mutation(() => Defect, {
    description: '"Ik ga erheen": a technician takes the defect (more than one is fine)',
  })
  claimDefect(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Defect> {
    return this.defects.claim(caller.email, id)
  }

  @RequirePermissions('defects:claim')
  @Mutation(() => Defect, { description: 'Gives a defect back, so another technician can take it' })
  releaseDefect(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Defect> {
    return this.defects.release(caller.email, id)
  }

  @RequirePermissions('defects:claim')
  @Mutation(() => Defect, { description: 'The technician arrived at the robot' })
  arriveAtDefect(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Defect> {
    return this.defects.markOnSite(caller.email, id)
  }

  @RequirePermissions('defects:claim')
  @Mutation(() => Defect, { description: 'The safety check on site: which items are done' })
  updateDefectChecklist(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
    @Args('done', { type: () => [String] }) done: string[],
  ): Promise<Defect> {
    return this.defects.updateChecklist(caller.email, id, done)
  }

  @RequirePermissions('defects:close')
  @Mutation(() => Defect, { description: 'Closes a defect: repaired, or a false alarm' })
  closeDefect(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CloseDefectInput,
  ): Promise<Defect> {
    return this.defects.close(caller.email, id, input)
  }

  @RequirePermissions('robots:replace')
  @Mutation(() => ReplacedRobot, {
    description:
      'Replaces the robot of a defect: its key stops working and a new robot with a new key takes its place (scan its QR code, or leave the code out to make one)',
  })
  replaceRobot(
    @CurrentCaller() caller: Caller,
    @Args('defectId', { type: () => ID }) defectId: string,
    @Args('input', { nullable: true }) input?: ReplaceRobotInput,
  ): Promise<ReplacedRobot> {
    return this.defects.replace(caller.email, defectId, input ?? {})
  }

  @RequirePermissions('defects:call')
  @Mutation(() => Defect, {
    description: 'Calls for a technician (the way they are reached does not matter)',
  })
  callTechnician(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Defect> {
    return this.defects.callTechnician(caller.email, id)
  }

  @RequirePermissions('defects:claim')
  @Mutation(() => Defect, {
    description: 'A technician asks a colleague or the administrator for help',
  })
  requestHelp(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Defect> {
    return this.defects.requestHelp(caller.email, id)
  }

  @RequirePermissions('defects:close')
  @Mutation(() => Defect, {
    description: 'Archives a resolved defect (soft delete): it can be restored',
  })
  removeDefect(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Defect> {
    return this.defects.remove(caller.email, id)
  }

  @RequirePermissions('archive:restore')
  @Mutation(() => Defect)
  restoreDefect(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Defect> {
    return this.defects.restore(caller.email, id)
  }

  // ---- realtime ----

  /** Realtime: a list of defects refreshes itself when a defect is reported, taken, closed or replaced */
  @RequirePermissions('defects:read')
  @Subscription(() => DefectsChanged, { name: DEFECTS_CHANGED })
  defectsChanged() {
    return this.pubSub.asyncIterableIterator(DEFECTS_CHANGED)
  }

  /** Realtime: the detail screen of one defect follows it (the filter keeps the others out) */
  @RequirePermissions('defects:read')
  @Subscription(() => Defect, {
    name: DEFECT_UPDATED,
    filter: (payload: { [DEFECT_UPDATED]: Defect }, variables: { defectId: string }) =>
      payload[DEFECT_UPDATED].id === variables.defectId,
  })
  defectUpdated(
    // The argument is only for the filter above, but GraphQL needs it declared
    @Args('defectId', { type: () => ID }) _defectId: string,
  ) {
    return this.pubSub.asyncIterableIterator(DEFECT_UPDATED)
  }

  /** Realtime: the dashboard of a technician hears when someone calls for a technician or asks for help */
  @RequirePermissions('defects:claim')
  @Subscription(() => TechnicianCall, { name: TECHNICIAN_CALLED })
  technicianCalled() {
    return this.pubSub.asyncIterableIterator(TECHNICIAN_CALLED)
  }
}
