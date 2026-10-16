import { Global, Module } from '@nestjs/common'
import { PubSub } from 'graphql-subscriptions'

/** Inject with @Inject(PUB_SUB) pubSub: PubSub */
export const PUB_SUB = Symbol('PUB_SUB')

/**
 * One PubSub for all GraphQL subscriptions. In memory: fine for one API instance.
 * With several instances, swap it for a Redis PubSub here.
 */
@Global()
@Module({
  providers: [{ provide: PUB_SUB, useValue: new PubSub() }],
  exports: [PUB_SUB],
})
export class RealtimeModule {}
