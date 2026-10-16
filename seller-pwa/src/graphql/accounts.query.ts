import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { Account, AuditEntry, SellerRole } from '@/api/types'

export const ACCOUNTS: TypedDocumentNode<{ accounts: Account[] }> = gql`
  query Accounts {
    accounts {
      email
      role
      createdBy
      createdAt
    }
  }
`

export const AUDIT_LOG: TypedDocumentNode<{ auditLog: AuditEntry[] }, { limit?: number }> = gql`
  query AuditLog($limit: Int) {
    auditLog(limit: $limit) {
      id
      at
      actor
      action
      target
      detail
    }
  }
`

export const ADD_ACCOUNT: TypedDocumentNode<
  { addAccount: Account },
  { input: { email: string; role: SellerRole } }
> = gql`
  mutation AddAccount($input: AddAccountInput!) {
    addAccount(input: $input) {
      email
      role
      createdBy
      createdAt
    }
  }
`

export const REMOVE_ACCOUNT: TypedDocumentNode<{ removeAccount: boolean }, { email: string }> = gql`
  mutation RemoveAccount($email: String!) {
    removeAccount(email: $email)
  }
`
