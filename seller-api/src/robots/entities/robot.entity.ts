import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql'
import { ObjectId } from 'mongodb'
import { Column, Entity, ObjectIdColumn } from 'typeorm'
import { PlatformSource } from '../../common/graphql/platform-source.js'
import { RobotModel } from './robot-model.entity.js'

export enum RobotStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEFECT = 'defect',
  UNKNOWN = 'unknown',
}
registerEnumType(RobotStatus, {
  name: 'RobotStatus',
  description: 'DEFECT while there is an open defect, otherwise what the platform last said about the robot',
})

/**
 * A robot we gave to a company. The platform keeps the key; here only its first characters are kept, so
 * the full key is shown once (when the robot is made) and is not written down.
 */
@Entity('robots')
@ObjectType({ description: 'A robot of a company' })
export class Robot {
  @ObjectIdColumn()
  _id: ObjectId

  /** The id of the platform */
  @Field(() => ID)
  @Column()
  id: string

  @Field(() => ID)
  @Column()
  companyId: string

  @Column()
  modelId: string

  @Field(() => String)
  @Column()
  name: string

  @Field(() => String, { description: 'The first characters of the key, to recognise it' })
  @Column()
  apiKeyPrefix: string

  @Column()
  createdBy: string

  @Column()
  createdAt: Date

  /** Set when the robot was replaced: it is then gone from the lists */
  @Column({ nullable: true })
  retiredAt: Date | null

  @Field(() => Boolean, { nullable: true, description: 'Null while we have not heard from the platform' })
  @Column({ nullable: true })
  online: boolean | null

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  battery: number | null

  @Field(() => Date, { nullable: true })
  @Column({ nullable: true })
  lastSeenAt: Date | null

  // Worked out when asked, not stored
  @Field(() => RobotModel, { nullable: true })
  model: RobotModel | null

  @Field(() => RobotStatus)
  status: RobotStatus

  @Field(() => ID, { nullable: true })
  openDefectId: string | null
}

@ObjectType()
export class RobotList {
  @Field(() => [Robot])
  items: Robot[]

  @Field(() => PlatformSource)
  source: PlatformSource
}

@ObjectType({ description: 'A new robot and its key. The key is shown this once.' })
export class CreatedRobot {
  @Field(() => Robot)
  robot: Robot

  @Field(() => String)
  apiKey: string
}
