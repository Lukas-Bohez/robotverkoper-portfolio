import { Field, InputType } from '@nestjs/graphql'
import { Transform, Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsOptional, Matches, ValidateNested } from 'class-validator'
import { LocalizedNames } from '../../entities/localized-names.entity.js'

const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

@InputType()
export class CreateSellerRoleInput {
  @Field(() => String, { description: 'Short and stable: letters, digits and hyphens' })
  @Transform(lower)
  @Matches(/^[a-z][a-z0-9-]{1,29}$/, { message: 'invalid_role_key' })
  key: string

  @Field(() => LocalizedNames)
  @ValidateNested()
  @Type(() => LocalizedNames)
  names: LocalizedNames

  @Field(() => [String], { description: 'Standard permissions and extra claims (area:action)' })
  @IsArray()
  @ArrayMaxSize(60)
  permissions: string[]
}

@InputType()
export class UpdateSellerRoleInput {
  @Field(() => LocalizedNames, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedNames)
  names?: LocalizedNames

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  permissions?: string[]
}
