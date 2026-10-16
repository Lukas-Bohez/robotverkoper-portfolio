import { Field, InputType } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import { IsEmail, Matches, MaxLength } from 'class-validator'

const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

@InputType()
export class AddAccountInput {
  @Field(() => String)
  @Transform(lower)
  @IsEmail()
  @MaxLength(120)
  email: string

  @Field(() => String, { description: 'The key of a role of our own staff (see sellerRoles)' })
  @Transform(lower)
  @Matches(/^[a-z][a-z0-9-]{1,29}$/, { message: 'invalid_role_key' })
  roleKey: string
}
