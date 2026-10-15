import { gql } from '@apollo/client/core'

export type PlatformRole = 'PLATFORM_ADMIN' | 'TECHNICIAN'
export type RobotKind = 'FOOD' | 'PARCEL'
export type TemperatureType = 'WARM' | 'COLD' | 'NEUTRAL'

export interface Me {
  id: string
  email: string
  displayName: string | null
  platformRole: PlatformRole | null
}

export interface Company {
  id: string
  name: string
  subdomain: string
  createdAt: string | null
}

export interface RobotModel {
  id: string
  name: string
  kind: RobotKind
}

export interface Robot {
  id: string
  name: string
  apiKeyPrefix: string
  online: boolean
  battery: number | null
  model: { name: string; kind: RobotKind } | null
}

export const ME = gql`
  query Me {
    me {
      id
      email
      displayName
      platformRole
    }
  }
`

/** Every company (platform admin). Only what a robot seller needs: no staff, no emails. */
export const COMPANIES = gql`
  query SellerCompanies {
    tenants {
      id
      name
      subdomain
      createdAt
    }
  }
`

export const CREATE_COMPANY = gql`
  mutation SellerCreateCompany($input: CreateTenantInput!) {
    createTenant(input: $input) {
      id
      name
      subdomain
      createdAt
    }
  }
`

export const ROBOT_MODELS = gql`
  query SellerRobotModels {
    robotModels {
      id
      name
      kind
    }
  }
`

export const COMPANY_ROBOTS = gql`
  query SellerCompanyRobots($tenantId: ID!) {
    robots(tenantId: $tenantId) {
      id
      name
      apiKeyPrefix
      online
      battery: batteryPercentage
      model {
        name
        kind
      }
    }
  }
`

export const CREATE_ROBOT = gql`
  mutation SellerCreateRobot($input: CreateRobotInput!) {
    createRobot(input: $input) {
      apiKey
      robot {
        id
        name
      }
    }
  }
`
