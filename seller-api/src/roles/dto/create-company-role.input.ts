import { Field, InputType } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import { IsArray, IsString, Length } from 'class-validator'

@InputType()
export class CreateCompanyRoleInput {
  @Field(() => String)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(2, 40)
  name: string

  @Field(() => [String], { description: 'Permission keys, see companyPermissions' })
  @IsArray()
  @IsString({ each: true })
  permissions: string[]
}
