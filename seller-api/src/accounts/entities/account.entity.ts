import { Field, ID, ObjectType } from '@nestjs/graphql'
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ObjectIdColumn,
  UpdateDateColumn,
} from 'typeorm'

/**
 * Someone who works at the robot seller. The role is stored as its key and shown as a role through the
 * `role` field of the resolver (it is not declared here: see "Resolvers for ids").
 */
@Entity('accounts')
@ObjectType({ description: 'Someone who works at the robot seller' })
export class Account {
  @ObjectIdColumn() // Database link - TypeORM
  _id: string

  @Field(() => ID) // GraphQL
  get id(): string {
    return String(this._id)
  }

  @Field(() => String)
  @Column()
  email: string

  /** The key of the role (see SellerRole): resolved to the role itself by the resolver */
  @Column()
  roleKey: string

  /** Null for an administrator that is set in the settings of the server */
  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  createdBy: string | null

  /** Who archived it (the e-mail address) */
  @Column({ nullable: true })
  deletedBy?: string | null

  @CreateDateColumn({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  createdAt?: Date | null

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  updatedAt?: Date

  /** Null until the account is archived (soft delete): the account can no longer log in, but can be restored */
  @DeleteDateColumn({ nullable: true })
  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null
}
