import { Field, ID, Int, ObjectType } from '@nestjs/graphql'
import { ArchiveKind } from '../enums/archive-kind.enum.js'

@ObjectType({ description: 'Something that was archived instead of deleted, and can be restored' })
export class ArchivedItem {
  @Field(() => ID, {
    description: 'What restoreArchived needs: an e-mail address for an account, else the id',
  })
  id: string

  @Field(() => ArchiveKind)
  kind: ArchiveKind

  @Field(() => String, {
    description: 'What the person recognises it by: an address, a name, a robot',
  })
  label: string

  @Field(() => String, { nullable: true })
  detail: string | null

  @Field(() => Date)
  archivedAt: Date

  @Field(() => String, { nullable: true, description: 'Who archived it' })
  archivedBy: string | null
}

@ObjectType({ description: 'What cold storage moved' })
export class ColdStorageResult {
  @Field(() => Int)
  defects: number

  @Field(() => Int)
  auditEntries: number
}
