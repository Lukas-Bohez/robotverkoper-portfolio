import { registerEnumType } from '@nestjs/graphql'

export enum LidState {
  LOCKED = 'LOCKED',
  UNLOCKED = 'UNLOCKED',
  OPEN = 'OPEN',
}

registerEnumType(LidState, {
  name: 'LidState',
  description: 'The lid of the robot: locked (nobody can get in), unlocked or open',
})
