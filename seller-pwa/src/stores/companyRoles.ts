import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CompanyRole, RoleCopyResult, RolePreset } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import {
  APPLY_ROLE_PRESET,
  COMPANY_PERMISSIONS,
  COMPANY_ROLES,
  COPY_COMPANY_ROLE,
  CREATE_COMPANY_ROLE,
  REMOVE_COMPANY_ROLE,
  REMOVE_ROLE_PRESET,
  RESTORE_COMPANY_ROLE,
  RESTORE_ROLE_PRESET,
  ROLE_PRESETS,
  SAVE_ROLE_AS_PRESET,
  UPDATE_COMPANY_ROLE,
  type CompanyRoleInput,
} from '@/graphql/company-roles.query'
import { i18n } from '@/i18n'

/**
 * The roles inside a company (kok, lader, ...) with a name in every language, the permission keys they are built from,
 * and the presets: a role made once and given to as many companies as you like.
 */
export const useCompanyRolesStore = defineStore('companyRoles', () => {
  const { apolloClient } = useGraphql()
  const roles = ref<CompanyRole[]>([])
  const permissions = ref<string[]>([])
  const presets = ref<RolePreset[]>([])

  const language = () => i18n.global.locale.value

  async function load(companyId: string, withDeleted = false): Promise<void> {
    const { data } = await apolloClient.query({ query: COMPANY_ROLES, variables: { companyId, withDeleted } })
    roles.value = data.companyRoles
  }

  async function loadPermissions(): Promise<void> {
    const { data } = await apolloClient.query({ query: COMPANY_PERMISSIONS })
    permissions.value = data.companyPermissions
  }

  async function create(companyId: string, input: CompanyRoleInput): Promise<CompanyRole> {
    const { data } = await apolloClient.mutate({ mutation: CREATE_COMPANY_ROLE, variables: { companyId, input } })
    if (!data) throw new Error('No role came back')
    return data.createCompanyRole
  }

  async function update(companyId: string, roleId: string, input: Partial<CompanyRoleInput>): Promise<CompanyRole> {
    const { data } = await apolloClient.mutate({ mutation: UPDATE_COMPANY_ROLE, variables: { companyId, roleId, input } })
    if (!data) throw new Error('No role came back')
    return data.updateCompanyRole
  }

  /** Archives a role (soft delete): the locked administrator role cannot be archived */
  async function remove(companyId: string, roleId: string): Promise<CompanyRole> {
    const { data } = await apolloClient.mutate({ mutation: REMOVE_COMPANY_ROLE, variables: { companyId, roleId } })
    if (!data) throw new Error('No role came back')
    roles.value = roles.value.filter(role => role.id !== roleId)
    return data.removeCompanyRole
  }

  async function restore(companyId: string, roleId: string): Promise<CompanyRole> {
    const { data } = await apolloClient.mutate({ mutation: RESTORE_COMPANY_ROLE, variables: { companyId, roleId } })
    if (!data) throw new Error('No role came back')
    return data.restoreCompanyRole
  }

  /** Copies a role to other companies; a company that has a role with that name keeps its own */
  async function copy(companyId: string, roleId: string, targetCompanyIds: string[]): Promise<RoleCopyResult> {
    const { data } = await apolloClient.mutate({
      mutation: COPY_COMPANY_ROLE,
      variables: { companyId, roleId, input: { targetCompanyIds } },
    })
    if (!data) throw new Error('No answer came back')
    return data.copyCompanyRole
  }

  // ---- presets ----

  async function loadPresets(withDeleted = false): Promise<void> {
    const { data } = await apolloClient.query({ query: ROLE_PRESETS, variables: { language: language(), withDeleted } })
    presets.value = data.rolePresets
  }

  async function saveAsPreset(companyId: string, roleId: string): Promise<RolePreset> {
    const { data } = await apolloClient.mutate({
      mutation: SAVE_ROLE_AS_PRESET,
      variables: { language: language(), companyId, roleId },
    })
    if (!data) throw new Error('No preset came back')
    return data.saveRoleAsPreset
  }

  /** Gives the roles of these presets to these companies (a company that has the role keeps its own) */
  async function applyPresets(presetIds: string[], companyIds: string[]): Promise<RoleCopyResult> {
    const total: RoleCopyResult = { copied: 0, skipped: [] }
    for (const id of presetIds) {
      const { data } = await apolloClient.mutate({ mutation: APPLY_ROLE_PRESET, variables: { id, input: { companyIds } } })
      if (!data) throw new Error('No answer came back')
      total.copied += data.applyRolePreset.copied
      total.skipped.push(...data.applyRolePreset.skipped)
    }
    return total
  }

  async function removePreset(id: string): Promise<RolePreset> {
    const { data } = await apolloClient.mutate({ mutation: REMOVE_ROLE_PRESET, variables: { language: language(), id } })
    if (!data) throw new Error('No preset came back')
    presets.value = presets.value.filter(preset => preset.id !== id)
    return data.removeRolePreset
  }

  async function restorePreset(id: string): Promise<RolePreset> {
    const { data } = await apolloClient.mutate({ mutation: RESTORE_ROLE_PRESET, variables: { language: language(), id } })
    if (!data) throw new Error('No preset came back')
    return data.restoreRolePreset
  }

  return {
    roles,
    permissions,
    presets,
    load,
    loadPermissions,
    create,
    update,
    remove,
    restore,
    copy,
    loadPresets,
    saveAsPreset,
    applyPresets,
    removePreset,
    restorePreset,
  }
})
