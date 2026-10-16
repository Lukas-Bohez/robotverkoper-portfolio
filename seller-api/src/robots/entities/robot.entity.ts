import { Field, ID, Int, ObjectType } from '@nestjs/graphql'
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ObjectIdColumn,
  UpdateDateColumn,
} from 'typeorm'
import { PlatformSource } from '../../common/graphql/platform-source.js'
import { Location } from '../../entities/location.entity.js'
import { RobotStatus } from '../enums/robot-status.enum.js'
import { RobotModel } from './robot-model.entity.js'

/**
 * A robot we built. At a company it has an id at the platform (`platformId`) and a key: the platform keeps the
 * key, here only its first characters are kept, so the full key is shown once (when the robot is made) and is not
 * written down. In the warehouse it has neither: it is `in stock` until a technician scans it.
 */
@Entity('robots')
@ObjectType({ description: 'A robot of a company, or one in the warehouse' })
export class Robot {
  @ObjectIdColumn() // Database link - TypeORM
  _id: string

  @Field(() => ID, { description: 'The id of the platform, or our own id for a robot in the warehouse' }) // GraphQL
  get id(): string {
    return this.platformId ?? String(this._id)
  }

  /** The id of the platform (the external id): null while the robot is in the warehouse */
  @Column({ nullable: true })
  platformId: string | null

  /** The platform id of the company, null while in the warehouse */
  @Field(() => ID, { nullable: true })
  @Column({ nullable: true })
  companyId: string | null

  @Column()
  modelId: string

  @Field(() => String)
  @Column()
  name: string

  @Field(() => String, { description: 'The number on the QR code on the robot, for example RBT-000212' })
  @Column()
  serial: string

  @Field(() => String, {
    nullable: true,
    description: 'The first characters of the key, to recognise it',
  })
  @Column({ nullable: true })
  apiKeyPrefix: string | null

  @Column()
  createdBy: string

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

  /** The last known place of the robot (an embedded GeoJSON point) */
  @Field(() => Location, { nullable: true })
  @Column({ type: 'simple-json', nullable: true })
  location: Location | null

  /** Who put the robot out of service (the e-mail address) */
  @Column({ nullable: true })
  deletedBy?: string | null

  @CreateDateColumn({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  createdAt?: Date

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updatedAt?: Date

  /** Null until the robot is put out of service (soft delete): it can be restored */
  @DeleteDateColumn({ nullable: true })
  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null

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
