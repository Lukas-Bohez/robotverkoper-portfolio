import { Field, ID, Int, ObjectType } from '@nestjs/graphql'
import { ObjectId } from 'mongodb'
import { Column, Entity, ObjectIdColumn } from 'typeorm'
import { PlatformSource } from '../../common/graphql/platform-source.js'

/**
 * A small copy of a company of the platform: only what we show (name, address), so the seller side keeps
 * working when the platform does not answer. The counts are worked out when asked: they are not stored.
 */
@Entity('companies')
@ObjectType({
  description: 'A company that uses our robots (a copy of the platform: no staff, no customers)',
})
export class Company {
  @ObjectIdColumn()
  _id: ObjectId

  /** The id of the platform */
  @Field(() => ID)
  @Column()
  id: string

  @Field(() => String)
  @Column()
  name: string

  @Field(() => String, { description: 'The subdomain of the company' })
  @Column()
  subdomain: string

  @Field(() => Date)
  @Column()
  createdAt: Date

  @Column()
  syncedAt: Date

  @Field(() => Int, { description: 'Robots of this company that are not replaced' })
  robotCount: number

  @Field(() => Int, { description: 'Defects that are not resolved yet' })
  openDefects: number
}

@ObjectType()
export class CompanyList {
  @Field(() => [Company])
  items: Company[]

  @Field(() => PlatformSource)
  source: PlatformSource
}
