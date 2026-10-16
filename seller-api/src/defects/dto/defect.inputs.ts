import { Field, InputType } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import { IsEnum, IsIn, IsOptional, Length } from 'class-validator'
import { DefectResolution, DefectSeverity } from '../enums/defect.enums.js'

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
  @Field(() => String, {
    nullable: true,
    description:
      'The QR code of the new robot (rbt:RBT-000417 or the number). Without it a new robot is made.',
  })
  @Transform(trim)
  @IsOptional()
  @Length(3, 40)
  code?: string

  @Field(() => String, {
    nullable: true,
    description: 'Default: the name of the old robot (a new robot made without a code gets "(vervanger)")',
  })
  @Transform(trim)
  @IsOptional()
  @Length(2, 120)
  name?: string
}

@InputType()
export class CloseDefectInput {
  @Field(() => DefectResolution, {
    description: 'REPAIRED or FALSE_ALARM (replacing a robot has its own mutation)',
  })
  @IsIn([DefectResolution.REPAIRED, DefectResolution.FALSE_ALARM])
  resolution: DefectResolution

  @Field(() => String, { nullable: true, description: 'What was done, in a few words' })
  @Transform(trim)
  @IsOptional()
  @Length(0, 300)
  note?: string
}
