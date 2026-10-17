import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type {
  Account,
  AuditEntry,
  LocalizedNames,
  PermissionInfo,
  SellerRole,
} from '@/api/types'

const SELLER_ROLE_FIELDS = gql`
  fragment SellerRoleFields on SellerRole {
    id
    key
    locked
    permissions
    deletedAt
    name(language: $language)
    names {
      nl
      en
      fr
      de
    }
  }
`

const ACCOUNT_FIELDS = gql`
  fragment AccountFields on Account {
    id
    email
    createdBy
    createdAt
    deletedAt
    role {
      id
      key
      locked
      name(language: $language)
    }
  }
`

export const ACCOUNTS: TypedDocumentNode<
  { accounts: Account[] },
  { language: string; withDeleted?: boolean }
> = gql`
  ${ACCOUNT_FIELDS}
  query Accounts($language: String, $withDeleted: Boolean) {
    accounts(withDeleted: $withDeleted) {
      ...AccountFields
    }
  }
`

export const ADD_ACCOUNT: TypedDocumentNode<
  { addAccount: Account },
  { language: string; input: { email: string; roleKey: string } }
> = gql`
  ${ACCOUNT_FIELDS}
  mutation AddAccount($language: String, $input: AddAccountInput!) {
    addAccount(input: $input) {
      ...AccountFields
    }
  }
`

export const REMOVE_ACCOUNT: TypedDocumentNode<
  { removeAccount: Account },
  { language: string; email: string }
> = gql`
  ${ACCOUNT_FIELDS}
  mutation RemoveAccount($language: String, $email: String!) {
    removeAccount(email: $email) {
      ...AccountFields
    }
  }
`

export const RESTORE_ACCOUNT: TypedDocumentNode<
  { restoreAccount: Account },
  { language: string; email: string }
> = gql`
  ${ACCOUNT_FIELDS}
  mutation RestoreAccount($language: String, $email: String!) {
    restoreAccount(email: $email) {
      ...AccountFields
    }
  }
`

export const AUDIT_LOG: TypedDocumentNode<
  { auditLog: AuditEntry[] },
  { limit?: number; year?: number | null; includeCold?: boolean }
> = gql`
  query AuditLog($limit: Int, $year: Int, $includeCold: Boolean) {
    auditLog(limit: $limit, year: $year, includeCold: $includeCold) {
      id
      createdAt
      actor
      action
      target
      detail
      coldAt
    }
  }
`

export const SELLER_ROLES: TypedDocumentNode<
  { sellerRoles: SellerRole[] },
  { language: string; withDeleted?: boolean }
> = gql`
  ${SELLER_ROLE_FIELDS}
  query SellerRoles($language: String, $withDeleted: Boolean) {
    sellerRoles(withDeleted: $withDeleted) {
      ...SellerRoleFields
    }
  }
`

/** The standard rights with their group: the rows of the table of rights */
export const SELLER_PERMISSIONS: TypedDocumentNode<{ sellerPermissions: PermissionInfo[] }> = gql`
  query SellerPermissions {
    sellerPermissions {
      key
      group
    }
  }
`

export const CREATE_SELLER_ROLE: TypedDocumentNode<
  { createSellerRole: SellerRole },
  { language: string; input: { key: string; names: LocalizedNames; permissions: string[] } }
> = gql`
  ${SELLER_ROLE_FIELDS}
  mutation CreateSellerRole($language: String, $input: CreateSellerRoleInput!) {
    createSellerRole(input: $input) {
      ...SellerRoleFields
    }
  }
`

export const UPDATE_SELLER_ROLE: TypedDocumentNode<
  { updateSellerRole: SellerRole },
  { language: string; id: string; input: { names?: LocalizedNames; permissions?: string[] } }
> = gql`
  ${SELLER_ROLE_FIELDS}
  mutation UpdateSellerRole($language: String, $id: ID!, $input: UpdateSellerRoleInput!) {
    updateSellerRole(id: $id, input: $input) {
      ...SellerRoleFields
    }
  }
`

export const REMOVE_SELLER_ROLE: TypedDocumentNode<
  { removeSellerRole: SellerRole },
  { language: string; id: string }
> = gql`
  ${SELLER_ROLE_FIELDS}
  mutation RemoveSellerRole($language: String, $id: ID!) {
    removeSellerRole(id: $id) {
      ...SellerRoleFields
    }
  }
`

export const RESTORE_SELLER_ROLE: TypedDocumentNode<
  { restoreSellerRole: SellerRole },
  { language: string; id: string }
> = gql`
  ${SELLER_ROLE_FIELDS}
  mutation RestoreSellerRole($language: String, $id: ID!) {
    restoreSellerRole(id: $id) {
      ...SellerRoleFields
    }
  }
`
