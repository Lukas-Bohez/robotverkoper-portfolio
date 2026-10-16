import { Field, ID, ObjectType } from '@nestjs/graphql'
import { Column, CreateDateColumn, Entity, ObjectIdColumn } from 'typeorm'

@Entity('audit')
@ObjectType({ description: 'Who did what at the robot seller, and when' })
export class AuditEntry {
  @ObjectIdColumn() // Database link - TypeORM
  _id: string

  @Field(() => ID) // GraphQL
  get id(): string {
    return String(this._id)
  }

  @CreateDateColumn({ type: 'timestamp' })
  @Field(() => Date)
  createdAt: Date

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

  /** Set when the entry moved to cold storage (older than a year): see ColdStorageService */
  @Field(() => Date, { nullable: true })
  @Column({ nullable: true })
  coldAt?: Date | null
}
