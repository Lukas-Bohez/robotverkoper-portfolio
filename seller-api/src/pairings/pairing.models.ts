import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql'

export enum PairingStatus {
  WAITING = 'waiting',
  DELIVERED = 'delivered',
}
registerEnumType(PairingStatus, {
  name: 'PairingStatus',
  description:
    'WAITING: nobody has given this simulator a key yet. DELIVERED: here is the key (you get it once).',
})

@ObjectType({ description: 'A simulator that waits for the key of a robot (never its secret)' })
export class WaitingPairing {
  @Field(() => ID)
  id: string

  @Field(() => String, {
    description: 'What the device calls itself, for example Windows-simulator',
  })
  device: string

  @Field(() => String, {
    description: 'A short code the seller sees next to the device, to be sure it is the right one',
  })
  code: string

  @Field(() => Boolean, { description: 'The simulator runs on the same computer as this API' })
  loopback: boolean

  @Field(() => Date)
  createdAt: Date
}

@ObjectType({
  description:
    'What a simulator gets when it announces itself: keep the secret, it proves who asked',
})
export class PairingTicket {
  @Field(() => ID)
  id: string

  @Field(() => String)
  secret: string

  @Field(() => String)
  code: string
}

@ObjectType({ description: 'The answer to a simulator that asks if its key has arrived' })
export class PairingCollection {
  @Field(() => PairingStatus)
  status: PairingStatus

  @Field(() => String, { nullable: true })
  apiKey?: string

  @Field(() => String, { nullable: true })
  robotName?: string

  @Field(() => String, { nullable: true, description: 'Where the robot connects' })
  platformUrl?: string
}
