import { Field, ID, ObjectType } from '@nestjs/graphql'
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ObjectIdColumn,
  UpdateDateColumn,
} from 'typeorm'
import { RobotCondition } from '../../entities/robot-condition.entity.js'
import { Location } from '../../entities/location.entity.js'
import { DefectResolution, DefectSeverity } from '../enums/defect.enums.js'

/**
 * A defect of a robot. The robot and the company are kept as ids (the platform ids) and shown through
 * `@ResolveField`s in the resolver; `status` is worked out there too, because it follows from the fields below.
 */
@Entity('defects')
@ObjectType({ description: 'A defect of a robot, with everything a technician needs to know' })
export class Defect {
  @ObjectIdColumn() // Database link - TypeORM
  _id: string

  @Field(() => ID) // GraphQL
  get id(): string {
    return String(this._id)
  }

  /** The id of the robot at the platform (not exposed: the `robot` field of the resolver shows the robot) */
  @Column()
  robotId: string

  /** The id of the company at the platform (not exposed: see the `company` field of the resolver) */
  @Column()
  companyId: string

  @Field(() => String)
  @Column()
  summary: string

  @Field(() => DefectSeverity)
  @Column()
  severity: DefectSeverity

  @Field(() => String)
  @Column()
  reportedBy: string

  /** The technician who took the defect (the e-mail address) */
  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  assignedTo: string | null

  @Field(() => Date, { nullable: true, description: 'When the technician took it ("ik ga erheen")' })
  @Column({ nullable: true })
  claimedAt: Date | null

  @Field(() => Date, { nullable: true, description: 'When the technician arrived at the robot' })
  @Column({ nullable: true })
  onSiteAt: Date | null

  /** The items of the safety check that are done (see CHECKLIST_ITEMS) */
  @Field(() => [String])
  @Column()
  checklistDone: string[]

  @Field(() => DefectResolution, { nullable: true })
  @Column({ nullable: true })
  resolution: DefectResolution | null

  @Field(() => Date, { nullable: true })
  @Column({ nullable: true })
  resolvedAt: Date | null

  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  resolvedBy: string | null

  @Field(() => String, { nullable: true, description: 'What the technician did, in a few words' })
  @Column({ nullable: true })
  resolutionNote: string | null

  @Field(() => ID, { nullable: true })
  @Column({ nullable: true })
  replacementRobotId: string | null

  /** The condition of the robot when the defect was reported: cargo, tilt, battery, lid, temperature */
  @Field(() => RobotCondition, { nullable: true })
  @Column({ type: 'simple-json', nullable: true })
  condition: RobotCondition | null

  /** Where the robot stands (an embedded GeoJSON point) */
  @Field(() => Location, { nullable: true })
  @Column({ type: 'simple-json', nullable: true })
  location: Location | null

  @Field(() => Date, { nullable: true, description: 'When someone called for a technician' })
  @Column({ nullable: true })
  callRequestedAt: Date | null

  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  calledBy: string | null

  @Field(() => Date, { nullable: true, description: 'When the technician asked for help' })
  @Column({ nullable: true })
  helpRequestedAt: Date | null

  /** Set when the defect moved to cold storage (a year after it was resolved) */
  @Field(() => Date, { nullable: true })
  @Column({ nullable: true })
  coldAt: Date | null

  /** Who archived it (the e-mail address) */
  @Column({ nullable: true })
  deletedBy?: string | null

  @CreateDateColumn({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  createdAt?: Date

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  updatedAt?: Date

  /** Null until the defect is archived (soft delete): it can be restored */
  @DeleteDateColumn({ nullable: true })
  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null
}
