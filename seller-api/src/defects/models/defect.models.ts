import { Field, ID, Int, ObjectType } from '@nestjs/graphql'
import { Robot } from '../../robots/entities/robot.entity.js'
import { Defect } from '../entities/defect.entity.js'

@ObjectType({
  description:
    'A defective robot that was replaced: the defect, the new robot and its key (shown this once)',
})
export class ReplacedRobot {
  @Field(() => Defect)
  defect: Defect

  @Field(() => Robot)
  robot: Robot

  @Field(() => String)
  apiKey: string
}

@ObjectType({ description: 'The defects changed: this is how many are open now' })
export class DefectsChanged {
  @Field(() => Int)
  openDefects: number
}

@ObjectType({ description: 'Another defect close to a defect, and how far it is' })
export class NearbyDefect {
  @Field(() => Defect)
  defect: Defect

  @Field(() => Int, { description: 'Distance in meters, as the crow flies' })
  distanceMeters: number
}

@ObjectType({ description: 'Someone called for a technician, or a technician asked for help' })
export class TechnicianCall {
  @Field(() => String, { description: 'CALL (an administrator calls) or HELP (a technician asks)' })
  kind: 'CALL' | 'HELP'

  @Field(() => ID)
  defectId: string

  @Field(() => String)
  robotName: string

  @Field(() => String)
  companyName: string

  @Field(() => String)
  summary: string

  @Field(() => Boolean, { description: 'There is food or a parcel inside: this is urgent' })
  hasCargo: boolean

  @Field(() => String)
  requestedBy: string

  @Field(() => Date)
  at: Date
}
