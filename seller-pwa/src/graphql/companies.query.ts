import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { Company, CompanyList } from '@/api/types'

const COMPANY_FIELDS = gql`
  fragment CompanyFields on Company {
    id
    name
    subdomain
    createdAt
    robotCount
    openDefects
    deletedAt
  }
`

export const COMPANIES: TypedDocumentNode<{ companies: CompanyList }, { withDeleted?: boolean }> = gql`
  ${COMPANY_FIELDS}
  query Companies($withDeleted: Boolean) {
    companies(withDeleted: $withDeleted) {
      source
      items {
        ...CompanyFields
      }
    }
  }
`

export const COMPANY: TypedDocumentNode<{ company: Company }, { id: string }> = gql`
  ${COMPANY_FIELDS}
  query Company($id: ID!) {
    company(id: $id) {
      ...CompanyFields
    }
  }
`

export interface CreateCompanyVariables {
  input: { name: string; subdomain: string; adminEmail: string }
}

export const CREATE_COMPANY: TypedDocumentNode<{ createCompany: Company }, CreateCompanyVariables> = gql`
  ${COMPANY_FIELDS}
  mutation CreateCompany($input: CreateCompanyInput!) {
    createCompany(input: $input) {
      ...CompanyFields
    }
  }
`

export const REMOVE_COMPANY: TypedDocumentNode<{ removeCompany: Company }, { id: string }> = gql`
  ${COMPANY_FIELDS}
  mutation RemoveCompany($id: ID!) {
    removeCompany(id: $id) {
      ...CompanyFields
    }
  }
`

export const RESTORE_COMPANY: TypedDocumentNode<{ restoreCompany: Company }, { id: string }> = gql`
  ${COMPANY_FIELDS}
  mutation RestoreCompany($id: ID!) {
    restoreCompany(id: $id) {
      ...CompanyFields
    }
  }
`
