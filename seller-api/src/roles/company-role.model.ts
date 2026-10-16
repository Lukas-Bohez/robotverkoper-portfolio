import { Field, ID, ObjectType } from '@nestjs/graphql'

/** A role inside a company (for example "kok"): kept by the platform of the companies, not here */
@ObjectType({ description: 'A role inside a company, with the permissions it holds' })
export class CompanyRole {
  @Field(() => ID)
  id: string

  @Field(() => String)
  name: string

  @Field(() => [String])
  permissions: string[]

  @Field(() => Boolean, { description: 'The administrator role is locked: it cannot be removed' })
  locked: boolean
}
