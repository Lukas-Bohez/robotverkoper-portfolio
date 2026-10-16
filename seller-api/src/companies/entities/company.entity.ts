import { Field, ID, Int, ObjectType } from '@nestjs/graphql'
import { Column, DeleteDateColumn, Entity, ObjectIdColumn, UpdateDateColumn } from 'typeorm'
import { PlatformSource } from '../../common/graphql/platform-source.js'

/**
 * A small copy of a company of the platform: only what we show (name, address), so the seller side keeps
 * working when the platform does not answer. The counts are worked out when asked: they are not stored.
 * The id the outside world knows is the id of the platform (`platformId`, like the `externalUid` of a user).
 */
@Entity('companies')
@ObjectType({
  description: 'A company that uses our robots (a copy of the platform: no staff, no customers)',
})
export class Company {
  @ObjectIdColumn() // Database link - TypeORM
  _id: string

  @Field(() => ID, { description: 'The id of the platform' }) // GraphQL
  get id(): string {
    return this.platformId
  }

  @Column()
  platformId: string

  @Field(() => String)
  @Column()
  name: string

  @Field(() => String, { description: 'The subdomain of the company' })
  @Column()
  subdomain: string

  /** When the company was made at the platform (not when this copy was made) */
  @Field(() => Date)
  @Column()
  createdAt: Date

  @Column()
  syncedAt: Date

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updatedAt?: Date

  /** Who archived it (the e-mail address) */
  @Column({ nullable: true })
  deletedBy?: string | null

  /** Null until the company is archived (soft delete): it then leaves the lists but can be restored */
  @DeleteDateColumn({ nullable: true })
  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null

  @Field(() => Int, { description: 'Robots of this company that are in service' })
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
