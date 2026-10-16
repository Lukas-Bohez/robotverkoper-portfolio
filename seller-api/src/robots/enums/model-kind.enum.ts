import { registerEnumType } from '@nestjs/graphql'

export enum ModelKind {
  FOOD = 'FOOD',
  PARCEL = 'PARCEL',
}

registerEnumType(ModelKind, {
  name: 'ModelKind',
  description: 'FOOD: the insulated food robot. PARCEL: a robot with an ordinary compartment.',
})
