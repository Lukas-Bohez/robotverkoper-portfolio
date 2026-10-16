import { Inject, Injectable } from '@nestjs/common'
import type { PubSub } from 'graphql-subscriptions'
import { AuditService } from '../audit/audit.service.js'
import { DomainException } from '../common/domain-exception.js'
import { PUB_SUB } from '../common/realtime/realtime.module.js'
import { APP_CONFIG, type AppConfig } from '../config/app-config.js'
import { RobotsService } from '../robots/robots.service.js'
import { PairingBook, type WaitingPairing } from './pairing-book.js'
import { PairingStatus, type PairingCollection, type PairingTicket } from './pairing.models.js'

export const WAITING_PAIRINGS_CHANGED = 'waitingPairingsChanged'

@Injectable()
export class PairingsService {
  private readonly book = new PairingBook()

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly robots: RobotsService,
    private readonly audit: AuditService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  /** Realtime: the seller's screen sees a simulator appear or disappear without asking */
  private async announce(): Promise<void> {
    await this.pubSub.publish(WAITING_PAIRINGS_CHANGED, {
      [WAITING_PAIRINGS_CHANGED]: this.book.waiting(),
    })
  }

  waiting(): WaitingPairing[] {
    return this.book.waiting()
  }

  /** A simulator announces itself and waits for the key of a robot */
  async create(device: string, loopback: boolean): Promise<PairingTicket> {
    const ticket = this.book.create(device, loopback)
    await this.announce()
    return ticket
  }

  collect(id: string, secret: string): PairingCollection {
    const result = this.book.collect(id, secret)
    if (result.status === 'waiting') return { status: PairingStatus.WAITING }
    return {
      status: PairingStatus.DELIVERED,
      apiKey: result.apiKey,
      robotName: result.robotName,
      platformUrl: result.platformUrl,
    }
  }

  async cancel(id: string, secret: string): Promise<void> {
    this.book.cancel(id, secret)
    await this.announce()
  }

  /**
   * Gives the key of a robot to a waiting simulator. Only the key of a robot we know is accepted (its first
   * characters must match what we stored), and nothing of it is written down here.
   */
  async deliver(actor: string, pairingId: string, robotId: string, apiKey: string): Promise<void> {
    const robot = await this.robots.find(robotId)
    if (!robot) throw new DomainException(404, 'robot_not_found', 'This robot does not exist')
    if (apiKey.slice(0, robot.apiKeyPrefix.length) !== robot.apiKeyPrefix) {
      throw new DomainException(400, 'key_mismatch', 'This key does not belong to this robot')
    }
    const pairing = this.book.deliver(pairingId, {
      apiKey,
      robotName: robot.name,
      platformUrl: this.config.robotApiUrl,
    })
    await this.audit.record(
      actor,
      'robot.key-sent',
      robot.id,
      `${robot.name} → ${pairing.device} (${pairing.code}), key ${robot.apiKeyPrefix}…`,
    )
    await this.announce()
  }
}
