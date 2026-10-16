import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { CompanyRole } from '@/api/types'

export const COMPANY_ROLES: TypedDocumentNode<{ companyRoles: CompanyRole[] }, { companyId: string }> = gql`
  query CompanyRoles($companyId: ID!) {
    companyRoles(companyId: $companyId) {
      id
      name
      permissions
      locked
    }
  }
`

export const COMPANY_PERMISSIONS: TypedDocumentNode<{ companyPermissions: string[] }> = gql`
  query CompanyPermissions {
    companyPermissions
  }
`

export interface CreateCompanyRoleVariables {
  companyId: string
  input: { name: string; permissions: string[] }
}

export const CREATE_COMPANY_ROLE: TypedDocumentNode<
  { createCompanyRole: CompanyRole },
  CreateCompanyRoleVariables
> = gql`
  mutation CreateCompanyRole($companyId: ID!, $input: CreateCompanyRoleInput!) {
    createCompanyRole(companyId: $companyId, input: $input) {
      id
      name
      permissions
      locked
    }
  }
`

export const DELETE_COMPANY_ROLE: TypedDocumentNode<
  { deleteCompanyRole: boolean },
  { companyId: string; roleId: string }
> = gql`
  mutation DeleteCompanyRole($companyId: ID!, $roleId: ID!) {
    deleteCompanyRole(companyId: $companyId, roleId: $roleId)
  }
`
