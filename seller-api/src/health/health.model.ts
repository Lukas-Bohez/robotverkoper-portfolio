import { Field, ObjectType } from '@nestjs/graphql'

@ObjectType({ description: 'Proof that the API and the database are running' })
export class Health {
  @Field(() => String, { description: 'Always "ok" when the API answers' })
  status: string

  @Field(() => String, { description: '"up" or "down"' })
  database: string

  @Field(() => String, { description: 'Server time, ISO 8601' })
  timestamp: string
}
