import { Field, ID, InputType } from '@nestjs/graphql'
import { Transform } from 'class-transformer'
import { IsOptional, Length } from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

@InputType()
export class CreatePairingInput {
  @Field(() => String, {
    nullable: true,
    defaultValue: 'Simulator',
    description: 'What the device calls itself',
  })
  @Transform(trim)
  @IsOptional()
  @Length(1, 60)
  device?: string
}

@InputType()
export class DeliverKeyInput {
  @Field(() => ID, { description: 'The robot whose key is handed over' })
  @Transform(trim)
  @Length(1, 80)
  robotId: string

  @Field(() => String, { description: 'The key, as it was shown when the robot was made' })
  @Length(12, 200)
  apiKey: string
}
