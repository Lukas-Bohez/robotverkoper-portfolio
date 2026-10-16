import { Field, ID, Int, ObjectType } from '@nestjs/graphql'
import { LocalizedNames } from '../entities/localized-names.entity.js'

/** A role inside a company (for example "kok"): kept by the platform of the companies, not here */
@ObjectType({ description: 'A role inside a company, with the permissions it holds' })
export class CompanyRole {
  @Field(() => ID)
  id: string

  @Field(() => String, { description: 'The name in the language of the platform (Dutch)' })
  name: string

  @Field(() => LocalizedNames, { nullable: true, description: 'The name in every language' })
  names: LocalizedNames | null

  @Field(() => [String])
  permissions: string[]

  @Field(() => Boolean, {
    description: 'The administrator role is locked: it cannot be changed or archived',
  })
  locked: boolean

  @Field(() => Date, { nullable: true, description: 'Set when the role is archived (soft delete)' })
  archivedAt: Date | null
}

@ObjectType({ description: 'What happened when roles were copied to companies' })
export class RoleCopyResult {
  @Field(() => Int, { description: 'How many roles were made' })
  copied: number

  @Field(() => [String], {
    description:
      'Roles that were left out because the company has one with that name, as "company: role"',
  })
  skipped: string[]
}
