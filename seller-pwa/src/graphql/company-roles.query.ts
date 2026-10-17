import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { CompanyRole, LocalizedNames, RoleCopyResult, RolePreset } from '@/api/types'

const COMPANY_ROLE_FIELDS = gql`
  fragment CompanyRoleFields on CompanyRole {
    id
    name
    permissions
    locked
    archivedAt
    names {
      nl
      en
      fr
      de
    }
  }
`

export const COMPANY_ROLES: TypedDocumentNode<
  { companyRoles: CompanyRole[] },
  { companyId: string; withDeleted?: boolean }
> = gql`
  ${COMPANY_ROLE_FIELDS}
  query CompanyRoles($companyId: ID!, $withDeleted: Boolean) {
    companyRoles(companyId: $companyId, withDeleted: $withDeleted) {
      ...CompanyRoleFields
    }
  }
`

export const COMPANY_PERMISSIONS: TypedDocumentNode<{ companyPermissions: string[] }> = gql`
  query CompanyPermissions {
    companyPermissions
  }
`

export interface CompanyRoleInput {
  name: string
  names?: LocalizedNames
  permissions: string[]
}

export const CREATE_COMPANY_ROLE: TypedDocumentNode<
  { createCompanyRole: CompanyRole },
  { companyId: string; input: CompanyRoleInput }
> = gql`
  ${COMPANY_ROLE_FIELDS}
  mutation CreateCompanyRole($companyId: ID!, $input: CreateCompanyRoleInput!) {
    createCompanyRole(companyId: $companyId, input: $input) {
      ...CompanyRoleFields
    }
  }
`

export const UPDATE_COMPANY_ROLE: TypedDocumentNode<
  { updateCompanyRole: CompanyRole },
  { companyId: string; roleId: string; input: Partial<CompanyRoleInput> }
> = gql`
  ${COMPANY_ROLE_FIELDS}
  mutation UpdateCompanyRole($companyId: ID!, $roleId: ID!, $input: UpdateCompanyRoleInput!) {
    updateCompanyRole(companyId: $companyId, roleId: $roleId, input: $input) {
      ...CompanyRoleFields
    }
  }
`

export const REMOVE_COMPANY_ROLE: TypedDocumentNode<
  { removeCompanyRole: CompanyRole },
  { companyId: string; roleId: string }
> = gql`
  ${COMPANY_ROLE_FIELDS}
  mutation RemoveCompanyRole($companyId: ID!, $roleId: ID!) {
    removeCompanyRole(companyId: $companyId, roleId: $roleId) {
      ...CompanyRoleFields
    }
  }
`

export const RESTORE_COMPANY_ROLE: TypedDocumentNode<
  { restoreCompanyRole: CompanyRole },
  { companyId: string; roleId: string }
> = gql`
  ${COMPANY_ROLE_FIELDS}
  mutation RestoreCompanyRole($companyId: ID!, $roleId: ID!) {
    restoreCompanyRole(companyId: $companyId, roleId: $roleId) {
      ...CompanyRoleFields
    }
  }
`

export const COPY_COMPANY_ROLE: TypedDocumentNode<
  { copyCompanyRole: RoleCopyResult },
  { companyId: string; roleId: string; input: { targetCompanyIds: string[] } }
> = gql`
  mutation CopyCompanyRole($companyId: ID!, $roleId: ID!, $input: CopyCompanyRoleInput!) {
    copyCompanyRole(companyId: $companyId, roleId: $roleId, input: $input) {
      copied
      skipped
    }
  }
`

// ---- the presets: a role made once, given to many companies ----

const PRESET_FIELDS = gql`
  fragment PresetFields on RolePreset {
    id
    permissions
    deletedAt
    missingLanguages
    name(language: $language)
    names {
      nl
      en
      fr
      de
    }
  }
`

export const ROLE_PRESETS: TypedDocumentNode<
  { rolePresets: RolePreset[] },
  { language: string; withDeleted?: boolean }
> = gql`
  ${PRESET_FIELDS}
  query RolePresets($language: String, $withDeleted: Boolean) {
    rolePresets(withDeleted: $withDeleted) {
      ...PresetFields
    }
  }
`

export const SAVE_ROLE_AS_PRESET: TypedDocumentNode<
  { saveRoleAsPreset: RolePreset },
  { language: string; companyId: string; roleId: string }
> = gql`
  ${PRESET_FIELDS}
  mutation SaveRoleAsPreset($language: String, $companyId: ID!, $roleId: ID!) {
    saveRoleAsPreset(companyId: $companyId, roleId: $roleId) {
      ...PresetFields
    }
  }
`

export const APPLY_ROLE_PRESET: TypedDocumentNode<
  { applyRolePreset: RoleCopyResult },
  { id: string; input: { companyIds: string[] } }
> = gql`
  mutation ApplyRolePreset($id: ID!, $input: ApplyRolePresetInput!) {
    applyRolePreset(id: $id, input: $input) {
      copied
      skipped
    }
  }
`

export const REMOVE_ROLE_PRESET: TypedDocumentNode<
  { removeRolePreset: RolePreset },
  { language: string; id: string }
> = gql`
  ${PRESET_FIELDS}
  mutation RemoveRolePreset($language: String, $id: ID!) {
    removeRolePreset(id: $id) {
      ...PresetFields
    }
  }
`

export const RESTORE_ROLE_PRESET: TypedDocumentNode<
  { restoreRolePreset: RolePreset },
  { language: string; id: string }
> = gql`
  ${PRESET_FIELDS}
  mutation RestoreRolePreset($language: String, $id: ID!) {
    restoreRolePreset(id: $id) {
      ...PresetFields
    }
  }
`
