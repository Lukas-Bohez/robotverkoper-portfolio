import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { Defect, DefectsChanged, ReplacedRobot } from '@/api/types'

const DEFECT_FIELDS = gql`
  fragment DefectFields on Defect {
    id
    summary
    severity
    status
    reportedBy
    createdAt
    resolvedAt
    replacementRobotId
    robot {
      id
      name
    }
    company {
      id
      name
    }
  }
`

export const DEFECTS: TypedDocumentNode<{ defects: Defect[] }, { onlyOpen: boolean }> = gql`
  ${DEFECT_FIELDS}
  query Defects($onlyOpen: Boolean) {
    defects(onlyOpen: $onlyOpen) {
      ...DefectFields
    }
  }
`

export interface ReportDefectVariables {
  robotId: string
  input: { summary: string; severity: Defect['severity'] }
}

export const REPORT_DEFECT: TypedDocumentNode<{ reportDefect: Defect }, ReportDefectVariables> = gql`
  ${DEFECT_FIELDS}
  mutation ReportDefect($robotId: ID!, $input: ReportDefectInput!) {
    reportDefect(robotId: $robotId, input: $input) {
      ...DefectFields
    }
  }
`

export const CLOSE_DEFECT: TypedDocumentNode<{ closeDefect: Defect }, { id: string }> = gql`
  ${DEFECT_FIELDS}
  mutation CloseDefect($id: ID!) {
    closeDefect(id: $id) {
      ...DefectFields
    }
  }
`

export const REPLACE_ROBOT: TypedDocumentNode<
  { replaceRobot: ReplacedRobot },
  { defectId: string; input?: { name?: string } }
> = gql`
  ${DEFECT_FIELDS}
  mutation ReplaceRobot($defectId: ID!, $input: ReplaceRobotInput) {
    replaceRobot(defectId: $defectId, input: $input) {
      apiKey
      defect {
        ...DefectFields
      }
      robot {
        id
        companyId
        name
        apiKeyPrefix
        status
        model {
          id
          name
          kind
        }
      }
    }
  }
`

/** Realtime: the open defects changed (reported, closed or replaced), so a list can load again */
export const DEFECTS_CHANGED: TypedDocumentNode<{ defectsChanged: DefectsChanged }> = gql`
  subscription DefectsChanged {
    defectsChanged {
      openDefects
    }
  }
`
