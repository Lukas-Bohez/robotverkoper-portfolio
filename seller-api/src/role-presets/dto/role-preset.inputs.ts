import { Field, ID, InputType } from '@nestjs/graphql'
import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsOptional, ValidateNested } from 'class-validator'
import { LocalizedNames } from '../../entities/localized-names.entity.js'

@InputType()
export class CreateRolePresetInput {
  @Field(() => LocalizedNames)
  @ValidateNested()
  @Type(() => LocalizedNames)
  names: LocalizedNames

  @Field(() => [String], { description: 'The permission keys of a company role' })
  @IsArray()
  @ArrayMaxSize(40)
  permissions: string[]
}

@InputType()
export class UpdateRolePresetInput {
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
export class ApplyRolePresetInput {
  @Field(() => [ID], { description: 'The companies that get the role' })
  @IsArray()
  @ArrayMaxSize(50)
  companyIds: string[]
}
