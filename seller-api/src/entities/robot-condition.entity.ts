import { Field, Float, Int, ObjectType } from '@nestjs/graphql'
import { LidState } from '../enums/lid-state.enum.js'
import { Location } from './location.entity.js'

/**
 * Everything a technician wants to know about a robot before (and while) working on it: is there still food inside,
 * is it tilted, how full is the battery, is the lid locked, where is it. It is what the platform last heard from
 * the robot. An embedded document: a defect keeps the condition of the moment it was reported.
 */
@ObjectType({
  description: 'The condition of a robot: cargo, tilt, battery, lid, temperature, location',
})
export class RobotCondition {
  @Field(() => Boolean, {
    description: 'The robot is tilted (it lies on its side or stands crooked)',
  })
  tilted: boolean

  @Field(() => Int, { nullable: true, description: 'How far, in degrees' })
  tiltDegrees: number | null

  @Field(() => Boolean, { description: 'There is food or a parcel inside' })
  hasCargo: boolean

  @Field(() => String, {
    nullable: true,
    description: 'What is inside, for example the order and its items',
  })
  cargoSummary: string | null

  @Field(() => String, { nullable: true, description: 'Since when the cargo is inside (ISO date)' })
  cargoSince: string | null

  @Field(() => Float, {
    nullable: true,
    description: 'Temperature of the compartment in degrees Celsius',
  })
  compartmentTemp: number | null

  @Field(() => LidState)
  lid: LidState

  @Field(() => Int, { nullable: true })
  battery: number | null

  @Field(() => Boolean, { nullable: true })
  online: boolean | null

  @Field(() => String, {
    nullable: true,
    description: 'The last time the platform heard from the robot (ISO date)',
  })
  lastSeenAt: string | null

  @Field(() => String, { nullable: true, description: 'For example E42' })
  errorCode: string | null

  @Field(() => String, { nullable: true })
  errorText: string | null

  @Field(() => Location, { nullable: true })
  location: Location | null

  @Field(() => String, { description: 'When this was captured (ISO date)' })
  capturedAt: string
}
