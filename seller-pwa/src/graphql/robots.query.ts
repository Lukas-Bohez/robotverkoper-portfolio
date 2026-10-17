import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { CreatedRobot, Robot, RobotList, RobotModel } from '@/api/types'

/** What a technician wants to know about a robot: food inside, tilt, lid, temperature, error and place */
export const CONDITION_FIELDS = gql`
  fragment ConditionFields on RobotCondition {
    tilted
    tiltDegrees
    hasCargo
    cargoSummary
    cargoSince
    compartmentTemp
    lid
    battery
    online
    lastSeenAt
    errorCode
    errorText
    capturedAt
    location {
      country
      address
      geometry {
        type
        coordinates
      }
    }
  }
`

export const ROBOT_FIELDS = gql`
  fragment RobotFields on Robot {
    id
    companyId
    name
    serial
    qrCode
    apiKeyPrefix
    online
    battery
    status
    inStock
    openDefectId
    lastSeenAt
    deletedAt
    model {
      id
      name
      kind
    }
  }
`

export const ROBOT_MODELS: TypedDocumentNode<{ robotModels: RobotModel[] }> = gql`
  query RobotModels {
    robotModels {
      id
      name
      kind
      description
    }
  }
`

export const ROBOTS: TypedDocumentNode<
  { robots: RobotList },
  { companyId: string; withDeleted?: boolean }
> = gql`
  ${ROBOT_FIELDS}
  query Robots($companyId: ID!, $withDeleted: Boolean) {
    robots(companyId: $companyId, withDeleted: $withDeleted) {
      source
      items {
        ...RobotFields
      }
    }
  }
`

export const ROBOT: TypedDocumentNode<{ robot: Robot }, { id: string }> = gql`
  ${ROBOT_FIELDS}
  ${CONDITION_FIELDS}
  query RobotDetail($id: ID!) {
    robot(id: $id, withDeleted: true) {
      ...RobotFields
      condition {
        ...ConditionFields
      }
    }
  }
`

/** The robot behind a scanned QR code: null for a number we do not know */
export const ROBOT_BY_CODE: TypedDocumentNode<{ robotByCode: Robot | null }, { code: string }> = gql`
  ${ROBOT_FIELDS}
  query RobotByCode($code: String!) {
    robotByCode(code: $code) {
      ...RobotFields
    }
  }
`

export const STOCK_ROBOTS: TypedDocumentNode<{ stockRobots: Robot[] }> = gql`
  ${ROBOT_FIELDS}
  query StockRobots {
    stockRobots {
      ...RobotFields
    }
  }
`

export interface CreateRobotVariables {
  companyId: string
  input: { name: string; modelId: string }
}

export const CREATE_ROBOT: TypedDocumentNode<{ createRobot: CreatedRobot }, CreateRobotVariables> = gql`
  ${ROBOT_FIELDS}
  mutation CreateRobot($companyId: ID!, $input: CreateRobotInput!) {
    createRobot(companyId: $companyId, input: $input) {
      apiKey
      robot {
        ...RobotFields
      }
    }
  }
`

export const REMOVE_ROBOT: TypedDocumentNode<{ removeRobot: Robot }, { id: string }> = gql`
  ${ROBOT_FIELDS}
  mutation RemoveRobot($id: ID!) {
    removeRobot(id: $id) {
      ...RobotFields
    }
  }
`

export const RESTORE_ROBOT: TypedDocumentNode<{ restoreRobot: Robot }, { id: string }> = gql`
  ${ROBOT_FIELDS}
  mutation RestoreRobot($id: ID!) {
    restoreRobot(id: $id) {
      ...RobotFields
    }
  }
`
