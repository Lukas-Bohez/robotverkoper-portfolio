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
 * A role that is made once and used again: "Kok" with its rights and its name in every language. A company that
 * gets a preset gets its own copy, which it can change. `name` is a field of the resolver (it depends on the
 * language that is asked).
 */
@Entity('role_presets')
@ObjectType({ description: 'A role to reuse at other companies: rights and names, ready to copy' })
export class RolePreset {
  @ObjectIdColumn() // Database link - TypeORM
  _id: string

  @Field(() => ID) // GraphQL
  get id(): string {
    return String(this._id)
  }

  @Field(() => LocalizedNames)
  @Column({ type: 'simple-json' })
  names: LocalizedNames

  @Field(() => [String], { description: 'The permission keys of a company role' })
  @Column()
  permissions: string[]

  @Field(() => String)
  @Column()
  createdBy: string

  /** Who archived it (the e-mail address) */
  @Column({ nullable: true })
  deletedBy?: string | null

  @CreateDateColumn({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  createdAt?: Date

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  @Field(() => Date, { nullable: true })
  updatedAt?: Date

  /** Null until the preset is archived (soft delete): it can be restored */
  @DeleteDateColumn({ nullable: true })
  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null
}
