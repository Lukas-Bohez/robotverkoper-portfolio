import { Field, ID, ObjectType } from '@nestjs/graphql'
import { ObjectId } from 'mongodb'
import { Column, Entity, ObjectIdColumn } from 'typeorm'

@Entity('audit')
@ObjectType({ description: 'Who did what at the robot seller, and when' })
export class AuditEntry {
  @ObjectIdColumn()
  _id: ObjectId

  @Field(() => ID)
  get id(): string {
    return this._id.toHexString()
  }

  @Field(() => Date)
  @Column()
  at: Date

  /** The e-mail address of the person (kept as text: the entry outlives the account) */
  @Field(() => String)
  @Column()
  actor: string

  @Field(() => String, { description: 'For example robot.created or defect.closed' })
  @Column()
  action: string

  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  target: string | null

  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  detail: string | null
}
