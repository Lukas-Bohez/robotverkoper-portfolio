import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { CreatedRobot, RobotList, RobotModel } from '@/api/types'

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

const ROBOT_FIELDS = gql`
  fragment RobotFields on Robot {
    id
    companyId
    name
    apiKeyPrefix
    online
    battery
    status
    openDefectId
    lastSeenAt
    model {
      id
      name
      kind
    }
  }
`

export const ROBOTS: TypedDocumentNode<{ robots: RobotList }, { companyId: string }> = gql`
  ${ROBOT_FIELDS}
  query Robots($companyId: ID!) {
    robots(companyId: $companyId) {
      source
      items {
        ...RobotFields
      }
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
