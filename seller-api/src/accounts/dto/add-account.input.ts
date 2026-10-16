import { Field, InputType } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import { IsEmail, IsEnum, MaxLength } from 'class-validator'
import { SellerRole } from '../../authentication/permissions.js'

@InputType()
export class AddAccountInput {
  @Field(() => String)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(120)
  email: string

  @Field(() => SellerRole)
  @IsEnum(SellerRole)
  role: SellerRole
}
