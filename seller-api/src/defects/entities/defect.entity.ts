import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql'
import { ObjectId } from 'mongodb'
import { Column, Entity, ObjectIdColumn } from 'typeorm'
import { Company } from '../../companies/entities/company.entity.js'
import { Robot } from '../../robots/entities/robot.entity.js'

export enum DefectSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
registerEnumType(DefectSeverity, { name: 'DefectSeverity' })

export enum DefectStatus {
  OPEN = 'open',
  REPLACED = 'replaced',
  CLOSED = 'closed',
}
registerEnumType(DefectStatus, {
  name: 'DefectStatus',
  description: 'OPEN until it is closed or the robot is replaced',
})

/** A defect of a robot. The company is kept here too: a robot never moves to another company. */
@Entity('defects')
@ObjectType({ description: 'A defect of a robot' })
export class Defect {
  @ObjectIdColumn()
  _id: ObjectId

  @Field(() => ID)
  @Column()
  id: string

  @Column()
  robotId: string

  @Column()
  companyId: string

  @Field(() => String)
  @Column()
  summary: string

  @Field(() => DefectSeverity)
  @Column()
  severity: DefectSeverity

  @Field(() => DefectStatus)
  @Column()
  status: DefectStatus

  @Field(() => String)
  @Column()
  reportedBy: string

  @Field(() => Date)
  @Column()
  createdAt: Date

  @Field(() => Date, { nullable: true })
  @Column({ nullable: true })
  resolvedAt: Date | null

  @Field(() => ID, { nullable: true })
  @Column({ nullable: true })
  replacementRobotId: string | null

  /** Resolved per request with a DataLoader (see defects.resolver.ts) */
  @Field(() => Robot)
  robot: Robot

  @Field(() => Company)
  company: Company
}
