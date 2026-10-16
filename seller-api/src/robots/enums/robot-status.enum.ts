import { registerEnumType } from '@nestjs/graphql'

export enum RobotStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEFECT = 'defect',
  UNKNOWN = 'unknown',
  /** A robot that is not at a company yet: it waits for a technician to scan it */
  STOCK = 'stock',
  /** Archived (soft delete): the robot is out of service and its key stopped working */
  OUT_OF_SERVICE = 'out_of_service',
}

registerEnumType(RobotStatus, {
  name: 'RobotStatus',
  description:
    'DEFECT while there is an open defect, STOCK in the warehouse, OUT_OF_SERVICE when archived, otherwise what the platform last said',
})
