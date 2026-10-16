import { Field, ID, InputType } from '@nestjs/graphql'
import { Transform, Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsOptional, Length, ValidateNested } from 'class-validator'
import { LocalizedNames } from '../../entities/localized-names.entity.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

@InputType()
export class CreateCompanyRoleInput {
  @Field(() => String, { description: 'The name in Dutch, for example kok' })
  @Transform(trim)
  @Length(2, 40)
  name: string

  @Field(() => LocalizedNames, {
    nullable: true,
    description:
      'The name in the other languages (a language that is left out falls back to English)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedNames)
  names?: LocalizedNames

  @Field(() => [String])
  @IsArray()
  @ArrayMaxSize(40)
  permissions: string[]
}

@InputType()
export class UpdateCompanyRoleInput {
  @Field(() => String, { nullable: true })
  @Transform(trim)
  @IsOptional()
  @Length(2, 40)
  name?: string

  @Field(() => LocalizedNames, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedNames)
  names?: LocalizedNames

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  permissions?: string[]
}

@InputType()
export class CopyCompanyRoleInput {
  @Field(() => [ID], { description: 'The companies that get a copy of the role' })
  @IsArray()
  @ArrayMaxSize(50)
  targetCompanyIds: string[]
}
