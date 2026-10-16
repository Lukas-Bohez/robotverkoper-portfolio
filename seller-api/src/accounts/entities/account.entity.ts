import { Field, ObjectType } from '@nestjs/graphql'
import { ObjectId } from 'mongodb'
import { Column, Entity, ObjectIdColumn } from 'typeorm'
import { SellerRole } from '../../authentication/permissions.js'

@Entity('accounts')
@ObjectType({ description: 'Someone who works at the robot seller' })
export class Account {
  @ObjectIdColumn()
  _id: ObjectId

  @Field(() => String)
  @Column()
  email: string

  @Field(() => SellerRole)
  @Column()
  role: SellerRole

  /** Null for an administrator that is set in the settings of the server */
  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  createdBy: string | null

  @Field(() => Date, { nullable: true })
  @Column({ nullable: true })
  createdAt: Date | null
}
