import { Field, Int, ObjectType } from '@nestjs/graphql'
import { Robot } from '../../robots/entities/robot.entity.js'
import { Defect } from '../entities/defect.entity.js'

@ObjectType({ description: 'A defective robot that was replaced: the defect, the new robot and its key (shown this once)' })
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
