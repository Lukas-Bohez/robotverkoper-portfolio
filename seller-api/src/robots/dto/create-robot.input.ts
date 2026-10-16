import { Field, InputType } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import { Length } from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

@InputType()
export class CreateRobotInput {
  @Field(() => String)
  @Transform(trim)
  @Length(2, 120)
  name: string

  @Field(() => String, { description: 'The id of a robot model (see robotModels)' })
  @Transform(trim)
  @Length(1, 60)
  modelId: string
}
