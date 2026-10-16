import { Field, ID, ObjectType } from '@nestjs/graphql'
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ObjectIdColumn,
  UpdateDateColumn,
} from 'typeorm'
import { LocalizedNames } from '../../entities/localized-names.entity.js'

/**
 * A role of someone who works at the robot seller (not a role inside a company). The roles are data, not code:
 * the administrator adjusts what a technician may do in the table "Rollen en rechten van het team".
 * `name` is a field of the resolver (it depends on the language that is asked), so it is not declared here.
 */
@Entity('seller_roles')
@ObjectType({
  description: 'A role of someone who works at the robot seller, with the rights it holds',
})
export class SellerRole {
  @ObjectIdColumn() // Database link - TypeORM
  _id: string

  @Field(() => ID) // GraphQL
  get id(): string {
    return String(this._id)
  }

  @Field(() => String, { description: 'Short and stable, for example admin or technician' })
  @Column()
  key: string

  @Field(() => LocalizedNames, {
    description: 'The name in every language (a missing language falls back)',
  })
  @Column({ type: 'simple-json' })
  names: LocalizedNames

  @Field(() => [String], { description: 'Standard permissions and extra claims (area:action)' })
  @Column()
  permissions: string[]

  @Field(() => Boolean, {
    description: 'The administrator role is locked: it always holds every right',
  })
  @Column()
  locked: boolean

  /** Who archived it (the e-mail address) */
  @Column({ nullable: true })
  deletedBy?: string | null

  @CreateDateColumn({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  createdAt?: Date

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  updatedAt?: Date

  /** Null until the role is archived (soft delete): the document is kept for history and can be restored */
  @DeleteDateColumn({ nullable: true })
  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null
}

@ObjectType({ description: 'A right that can be given to a role, and the group it belongs to' })
export class PermissionInfo {
  @Field(() => String)
  key: string

  @Field(() => String, { description: 'companies, robots, defects, team or archive' })
  group: string
}
