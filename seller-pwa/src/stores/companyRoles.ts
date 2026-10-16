import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { CompanyRole } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import {
  COMPANY_PERMISSIONS,
  COMPANY_ROLES,
  CREATE_COMPANY_ROLE,
  DELETE_COMPANY_ROLE,
} from '@/graphql/company-roles.query'

/** The roles inside one company (kok, lader, ...) and the permission keys they are built from */
export const useCompanyRolesStore = defineStore('companyRoles', () => {
  const { apolloClient } = useGraphql()
  const roles = ref<CompanyRole[]>([])
  const permissions = ref<string[]>([])

  async function load(companyId: string): Promise<void> {
    const { data } = await apolloClient.query({ query: COMPANY_ROLES, variables: { companyId } })
    roles.value = data.companyRoles
  }

  async function loadPermissions(): Promise<void> {
    const { data } = await apolloClient.query({ query: COMPANY_PERMISSIONS })
    permissions.value = data.companyPermissions
  }

  async function create(companyId: string, input: { name: string; permissions: string[] }): Promise<CompanyRole> {
    const { data } = await apolloClient.mutate({ mutation: CREATE_COMPANY_ROLE, variables: { companyId, input } })
    if (!data) throw new Error('No role came back')
    return data.createCompanyRole
  }

  async function remove(companyId: string, roleId: string): Promise<void> {
    await apolloClient.mutate({ mutation: DELETE_COMPANY_ROLE, variables: { companyId, roleId } })
    roles.value = roles.value.filter(role => role.id !== roleId)
  }

  return { roles, permissions, load, loadPermissions, create, remove }
})
