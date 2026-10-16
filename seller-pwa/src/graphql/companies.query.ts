import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { Company, CompanyList } from '@/api/types'

export const COMPANIES: TypedDocumentNode<{ companies: CompanyList }> = gql`
  query Companies {
    companies {
      source
      items {
        id
        name
        subdomain
        createdAt
        robotCount
        openDefects
      }
    }
  }
`

export const COMPANY: TypedDocumentNode<{ company: Company }, { id: string }> = gql`
  query Company($id: ID!) {
    company(id: $id) {
      id
      name
      subdomain
      createdAt
      robotCount
      openDefects
    }
  }
`

export interface CreateCompanyVariables {
  input: { name: string; subdomain: string; adminEmail: string }
}

export const CREATE_COMPANY: TypedDocumentNode<{ createCompany: Company }, CreateCompanyVariables> = gql`
  mutation CreateCompany($input: CreateCompanyInput!) {
    createCompany(input: $input) {
      id
      name
      subdomain
      createdAt
      robotCount
      openDefects
    }
  }
`
