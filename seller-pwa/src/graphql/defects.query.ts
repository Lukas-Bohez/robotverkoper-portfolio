import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type {
  Defect,
  DefectResolution,
  DefectSeverity,
  DefectsChanged,
  GeoPointInput,
  NearbyDefect,
  ReplacedRobot,
  TechnicianCall,
} from '@/api/types'
import { CONDITION_FIELDS } from './robots.query'

/** Everything the screens show of a defect. `distanceMeters` only when the technician's place is known. */
export const DEFECT_FIELDS = gql`
  ${CONDITION_FIELDS}
  fragment DefectFields on Defect {
    id
    summary
    severity
    status
    reportedBy
    assignedTo
    createdAt
    claimedAt
    onSiteAt
    checklistDone
    resolution
    resolvedAt
    resolvedBy
    resolutionNote
    replacementRobotId
    callRequestedAt
    calledBy
    helpRequestedAt
    deletedAt
    coldAt
    distanceMeters(from: $from) @include(if: $withDistance)
    condition {
      ...ConditionFields
    }
    location {
      country
      address
      geometry {
        type
        coordinates
      }
    }
    robot {
      id
      name
      serial
      qrCode
      model {
        id
        name
        kind
      }
    }
    company {
      id
      name
    }
  }
`

/** The variables the fragment needs, with a default for a screen that does not know the place of the technician */
export interface PlaceVariables {
  withDistance?: boolean
  from?: GeoPointInput
}

export const NO_PLACE: Required<PlaceVariables> = {
  withDistance: false,
  from: { type: 'Point', coordinates: [0, 0] },
}

export interface DefectsVariables extends PlaceVariables {
  onlyOpen?: boolean
  mine?: boolean
  year?: number | null
  includeCold?: boolean
  withDeleted?: boolean
}

export const DEFECTS: TypedDocumentNode<{ defects: Defect[] }, DefectsVariables> = gql`
  ${DEFECT_FIELDS}
  query Defects(
    $onlyOpen: Boolean
    $mine: Boolean
    $year: Int
    $includeCold: Boolean
    $withDeleted: Boolean
    $withDistance: Boolean!
    $from: GeoPointInput!
  ) {
    defects(onlyOpen: $onlyOpen, mine: $mine, year: $year, includeCold: $includeCold, withDeleted: $withDeleted) {
      ...DefectFields
    }
  }
`

export const DEFECT: TypedDocumentNode<{ defect: Defect }, { id: string } & Required<PlaceVariables>> = gql`
  ${DEFECT_FIELDS}
  query DefectDetail($id: ID!, $withDistance: Boolean!, $from: GeoPointInput!) {
    defect(id: $id, withDeleted: true) {
      ...DefectFields
    }
  }
`

export const NEARBY_DEFECTS: TypedDocumentNode<
  { nearbyDefects: NearbyDefect[] },
  { defectId: string; radiusMeters?: number }
> = gql`
  query NearbyDefects($defectId: ID!, $radiusMeters: Int) {
    nearbyDefects(defectId: $defectId, radiusMeters: $radiusMeters) {
      distanceMeters
      defect {
        id
        summary
        status
        severity
        robot {
          id
          name
        }
        company {
          id
          name
        }
        condition {
          battery
          hasCargo
        }
      }
    }
  }
`

export interface ReportDefectVariables extends Required<PlaceVariables> {
  robotId: string
  input: { summary: string; severity: DefectSeverity }
}

export const REPORT_DEFECT: TypedDocumentNode<{ reportDefect: Defect }, ReportDefectVariables> = gql`
  ${DEFECT_FIELDS}
  mutation ReportDefect($robotId: ID!, $input: ReportDefectInput!, $withDistance: Boolean!, $from: GeoPointInput!) {
    reportDefect(robotId: $robotId, input: $input) {
      ...DefectFields
    }
  }
`

type IdVariables = { id: string } & Required<PlaceVariables>

export const CLAIM_DEFECT: TypedDocumentNode<{ claimDefect: Defect }, IdVariables> = gql`
  ${DEFECT_FIELDS}
  mutation ClaimDefect($id: ID!, $withDistance: Boolean!, $from: GeoPointInput!) {
    claimDefect(id: $id) {
      ...DefectFields
    }
  }
`

export const RELEASE_DEFECT: TypedDocumentNode<{ releaseDefect: Defect }, IdVariables> = gql`
  ${DEFECT_FIELDS}
  mutation ReleaseDefect($id: ID!, $withDistance: Boolean!, $from: GeoPointInput!) {
    releaseDefect(id: $id) {
      ...DefectFields
    }
  }
`

export const ARRIVE_AT_DEFECT: TypedDocumentNode<{ arriveAtDefect: Defect }, IdVariables> = gql`
  ${DEFECT_FIELDS}
  mutation ArriveAtDefect($id: ID!, $withDistance: Boolean!, $from: GeoPointInput!) {
    arriveAtDefect(id: $id) {
      ...DefectFields
    }
  }
`

export const UPDATE_DEFECT_CHECKLIST: TypedDocumentNode<
  { updateDefectChecklist: Defect },
  { id: string; done: string[] } & Required<PlaceVariables>
> = gql`
  ${DEFECT_FIELDS}
  mutation UpdateDefectChecklist($id: ID!, $done: [String!]!, $withDistance: Boolean!, $from: GeoPointInput!) {
    updateDefectChecklist(id: $id, done: $done) {
      ...DefectFields
    }
  }
`

export const CLOSE_DEFECT: TypedDocumentNode<
  { closeDefect: Defect },
  { id: string; input: { resolution: DefectResolution; note?: string } } & Required<PlaceVariables>
> = gql`
  ${DEFECT_FIELDS}
  mutation CloseDefect($id: ID!, $input: CloseDefectInput!, $withDistance: Boolean!, $from: GeoPointInput!) {
    closeDefect(id: $id, input: $input) {
      ...DefectFields
    }
  }
`

export const REPLACE_ROBOT: TypedDocumentNode<
  { replaceRobot: ReplacedRobot },
  { defectId: string; input?: { code?: string; name?: string } } & Required<PlaceVariables>
> = gql`
  ${DEFECT_FIELDS}
  mutation ReplaceRobot($defectId: ID!, $input: ReplaceRobotInput, $withDistance: Boolean!, $from: GeoPointInput!) {
    replaceRobot(defectId: $defectId, input: $input) {
      apiKey
      defect {
        ...DefectFields
      }
      robot {
        id
        companyId
        name
        serial
        qrCode
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

export const CALL_TECHNICIAN: TypedDocumentNode<{ callTechnician: Defect }, IdVariables> = gql`
  ${DEFECT_FIELDS}
  mutation CallTechnician($id: ID!, $withDistance: Boolean!, $from: GeoPointInput!) {
    callTechnician(id: $id) {
      ...DefectFields
    }
  }
`

export const REQUEST_HELP: TypedDocumentNode<{ requestHelp: Defect }, IdVariables> = gql`
  ${DEFECT_FIELDS}
  mutation RequestHelp($id: ID!, $withDistance: Boolean!, $from: GeoPointInput!) {
    requestHelp(id: $id) {
      ...DefectFields
    }
  }
`

export const REMOVE_DEFECT: TypedDocumentNode<{ removeDefect: Defect }, IdVariables> = gql`
  ${DEFECT_FIELDS}
  mutation RemoveDefect($id: ID!, $withDistance: Boolean!, $from: GeoPointInput!) {
    removeDefect(id: $id) {
      ...DefectFields
    }
  }
`

export const RESTORE_DEFECT: TypedDocumentNode<{ restoreDefect: Defect }, IdVariables> = gql`
  ${DEFECT_FIELDS}
  mutation RestoreDefect($id: ID!, $withDistance: Boolean!, $from: GeoPointInput!) {
    restoreDefect(id: $id) {
      ...DefectFields
    }
  }
`

/** Realtime: the list of defects changed (reported, taken, closed, replaced), so a list can load again */
export const DEFECTS_CHANGED: TypedDocumentNode<{ defectsChanged: DefectsChanged }> = gql`
  subscription DefectsChanged {
    defectsChanged {
      openDefects
    }
  }
`

/** Realtime: the detail of one defect follows it (the API only sends this defect) */
export const DEFECT_UPDATED: TypedDocumentNode<
  { defectUpdated: Defect },
  { defectId: string } & Required<PlaceVariables>
> = gql`
  ${DEFECT_FIELDS}
  subscription DefectUpdated($defectId: ID!, $withDistance: Boolean!, $from: GeoPointInput!) {
    defectUpdated(defectId: $defectId) {
      ...DefectFields
    }
  }
`

/** Realtime: someone calls for a technician, or a technician asks for help (the technician's dashboard) */
export const TECHNICIAN_CALLED: TypedDocumentNode<{ technicianCalled: TechnicianCall }> = gql`
  subscription TechnicianCalled {
    technicianCalled {
      kind
      defectId
      robotName
      companyName
      summary
      hasCargo
      requestedBy
      at
    }
  }
`
