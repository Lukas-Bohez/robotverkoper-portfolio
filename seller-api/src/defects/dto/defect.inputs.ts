import { Field, InputType } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import { IsEnum, IsOptional, Length } from 'class-validator'
import { DefectSeverity } from '../entities/defect.entity.js'

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value

@InputType()
export class ReportDefectInput {
  @Field(() => String, { description: 'What is wrong with the robot' })
  @Transform(trim)
  @Length(3, 200)
  summary: string

  @Field(() => DefectSeverity, { defaultValue: DefectSeverity.MEDIUM })
  @IsEnum(DefectSeverity)
  @IsOptional()
  severity: DefectSeverity = DefectSeverity.MEDIUM
}

@InputType()
export class ReplaceRobotInput {
  @Field(() => String, { nullable: true, description: 'Default: the old name with "(vervanger)"' })
  @Transform(trim)
  @IsOptional()
  @Length(2, 120)
  name?: string
}
