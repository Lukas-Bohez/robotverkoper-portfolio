import { Field, ID, ObjectType } from '@nestjs/graphql'
import { Column, Entity, ObjectIdColumn } from 'typeorm'
import { ModelKind } from '../enums/model-kind.enum.js'

/** What we build and sell: our own catalogue (no link with the models of the platform) */
@Entity('robot_models')
@ObjectType({ description: 'A kind of robot that we build' })
export class RobotModel {
  @ObjectIdColumn() // Database link - TypeORM
  _id: string

  @Field(() => ID, { description: 'The key of the model in our catalogue, for example model-food' }) // GraphQL
  get id(): string {
    return this.key
  }

  @Column()
  key: string

  @Field(() => String)
  @Column()
  name: string

  @Field(() => ModelKind)
  @Column()
  kind: ModelKind

  @Field(() => String)
  @Column()
  description: string
}
