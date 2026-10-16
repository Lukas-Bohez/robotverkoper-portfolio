import { Inject } from '@nestjs/common'
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql'
import type { PubSub } from 'graphql-subscriptions'
import {
  CurrentCaller,
  FromThisComputer,
  Public,
  RequirePermissions,
} from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { PUB_SUB } from '../common/realtime/realtime.module.js'
import { CreatePairingInput, DeliverKeyInput } from './dto/pairing.inputs.js'
import { PairingCollection, PairingTicket, WaitingPairing } from './pairing.models.js'
import { PairingsService, WAITING_PAIRINGS_CHANGED } from './pairings.service.js'

@Resolver(() => WaitingPairing)
export class PairingsResolver {
  constructor(
    private readonly pairings: PairingsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  // The simulator is a device, not a person: it proves itself with a secret instead of a login

  @Public()
  @Mutation(() => PairingTicket, { description: 'A simulator announces itself and waits for the key of a robot' })
  createPairing(
    @FromThisComputer() fromThisComputer: boolean,
    @Args('input', { nullable: true }) input?: CreatePairingInput,
  ): Promise<PairingTicket> {
    return this.pairings.create(input?.device ?? 'Simulator', fromThisComputer)
  }

  @Public()
  @Mutation(() => PairingCollection, {
    description: 'The simulator asks if its key has arrived. The key comes once, then the pairing is gone.',
  })
  collectPairing(
    @Args('id', { type: () => ID }) id: string,
    @Args('secret') secret: string,
  ): PairingCollection {
    return this.pairings.collect(id, secret)
  }

  @Public()
  @Mutation(() => Boolean, { description: 'The simulator stops waiting' })
  async cancelPairing(
    @Args('id', { type: () => ID }) id: string,
    @Args('secret') secret: string,
  ): Promise<boolean> {
    await this.pairings.cancel(id, secret)
    return true
  }

  // The seller's side

  @RequirePermissions('robots:create')
  @Query(() => [WaitingPairing], { description: 'The simulators that wait for a key right now' })
  waitingPairings(): WaitingPairing[] {
    return this.pairings.waiting()
  }

  /** Realtime: the seller sees a simulator appear or leave without asking again */
  @RequirePermissions('robots:create')
  @Subscription(() => [WaitingPairing], { name: WAITING_PAIRINGS_CHANGED })
  waitingPairingsChanged() {
    return this.pubSub.asyncIterableIterator(WAITING_PAIRINGS_CHANGED)
  }

  @RequirePermissions('robots:create')
  @Mutation(() => Boolean, { description: 'Hands the key of a robot to a waiting simulator. Nothing of it is written down.' })
  async deliverToSimulator(
    @CurrentCaller() caller: Caller,
    @Args('pairingId', { type: () => ID }) pairingId: string,
    @Args('input') input: DeliverKeyInput,
  ): Promise<boolean> {
    await this.pairings.deliver(caller.email, pairingId, input.robotId, input.apiKey)
    return true
  }
}
