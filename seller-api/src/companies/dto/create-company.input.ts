import { Field, InputType } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import { IsEmail, Length, Matches, MaxLength } from 'class-validator'

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

@InputType()
export class CreateCompanyInput {
  @Field(() => String)
  @Transform(trim)
  @Length(2, 60)
  name: string

  @Field(() => String, { description: 'Letters, digits and hyphens, not at the start or the end' })
  @Transform(lower)
  @Length(2, 30)
  @Matches(/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/, { message: 'invalid_subdomain' })
  subdomain: string

  @Field(() => String, {
    description: 'The first administrator of the company: kept by the platform, not here',
  })
  @Transform(lower)
  @IsEmail()
  @MaxLength(120)
  adminEmail: string
}
