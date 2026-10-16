import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql'
import { ObjectId } from 'mongodb'
import { Column, Entity, ObjectIdColumn } from 'typeorm'

export enum ModelKind {
  FOOD = 'FOOD',
  PARCEL = 'PARCEL',
}
registerEnumType(ModelKind, {
  name: 'ModelKind',
  description: 'FOOD: the insulated food robot. PARCEL: a robot with an ordinary compartment.',
})

/** What we build and sell: our own catalogue (no link with the models of the platform) */
@Entity('robot_models')
@ObjectType({ description: 'A kind of robot that we build' })
export class RobotModel {
  @ObjectIdColumn()
  _id: ObjectId

  @Field(() => ID)
  @Column()
  id: string

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
