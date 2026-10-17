import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Account, AuditEntry, LocalizedNames, PermissionInfo, SellerRole } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import { i18n } from '@/i18n'
import {
  ACCOUNTS,
  ADD_ACCOUNT,
  AUDIT_LOG,
  CREATE_SELLER_ROLE,
  REMOVE_ACCOUNT,
  REMOVE_SELLER_ROLE,
  RESTORE_ACCOUNT,
  RESTORE_SELLER_ROLE,
  SELLER_PERMISSIONS,
  SELLER_ROLES,
  UPDATE_SELLER_ROLE,
} from '@/graphql/team.query'

/**
 * Our own staff, their roles (a table of rights, not a fixed list) and the log of what they did. The names of
 * roles come in the language of the screen, so a screen loads again when the language changes.
 */
export const useTeamStore = defineStore('team', () => {
  const { apolloClient } = useGraphql()
  const accounts = ref<Account[]>([])
  const audit = ref<AuditEntry[]>([])
  const roles = ref<SellerRole[]>([])
  const permissions = ref<PermissionInfo[]>([])

  const language = () => i18n.global.locale.value

  async function loadAccounts(withDeleted = false): Promise<void> {
    const { data } = await apolloClient.query({ query: ACCOUNTS, variables: { language: language(), withDeleted } })
    accounts.value = data.accounts
  }

  /** The log, newest first. Lines older than a year are in cold storage: only with `includeCold`, per `year`. */
  async function loadAudit(options: { limit?: number; year?: number | null; includeCold?: boolean } = {}): Promise<void> {
    const { data } = await apolloClient.query({ query: AUDIT_LOG, variables: { limit: 20, ...options } })
    audit.value = data.auditLog
  }

  async function loadRoles(withDeleted = false): Promise<void> {
    const { data } = await apolloClient.query({ query: SELLER_ROLES, variables: { language: language(), withDeleted } })
    roles.value = data.sellerRoles
  }

  async function loadPermissions(): Promise<void> {
    const { data } = await apolloClient.query({ query: SELLER_PERMISSIONS })
    permissions.value = data.sellerPermissions
  }

  /** Gives someone a role (or changes it). Someone who was archived is brought back. */
  async function add(email: string, roleKey: string): Promise<Account> {
    const { data } = await apolloClient.mutate({
      mutation: ADD_ACCOUNT,
      variables: { language: language(), input: { email, roleKey } },
    })
    if (!data) throw new Error('No account came back')
    return data.addAccount
  }

  /** Archives an account (soft delete): it can no longer log in, and can be restored */
  async function remove(email: string): Promise<Account> {
    const { data } = await apolloClient.mutate({ mutation: REMOVE_ACCOUNT, variables: { language: language(), email } })
    if (!data) throw new Error('No account came back')
    return data.removeAccount
  }

  async function restore(email: string): Promise<Account> {
    const { data } = await apolloClient.mutate({ mutation: RESTORE_ACCOUNT, variables: { language: language(), email } })
    if (!data) throw new Error('No account came back')
    return data.restoreAccount
  }

  async function createRole(input: { key: string; names: LocalizedNames; permissions: string[] }): Promise<SellerRole> {
    const { data } = await apolloClient.mutate({ mutation: CREATE_SELLER_ROLE, variables: { language: language(), input } })
    if (!data) throw new Error('No role came back')
    return data.createSellerRole
  }

  async function updateRole(id: string, input: { names?: LocalizedNames; permissions?: string[] }): Promise<SellerRole> {
    const { data } = await apolloClient.mutate({
      mutation: UPDATE_SELLER_ROLE,
      variables: { language: language(), id, input },
    })
    if (!data) throw new Error('No role came back')
    return data.updateSellerRole
  }

  async function removeRole(id: string): Promise<SellerRole> {
    const { data } = await apolloClient.mutate({ mutation: REMOVE_SELLER_ROLE, variables: { language: language(), id } })
    if (!data) throw new Error('No role came back')
    return data.removeSellerRole
  }

  async function restoreRole(id: string): Promise<SellerRole> {
    const { data } = await apolloClient.mutate({ mutation: RESTORE_SELLER_ROLE, variables: { language: language(), id } })
    if (!data) throw new Error('No role came back')
    return data.restoreSellerRole
  }

  return {
    accounts,
    audit,
    roles,
    permissions,
    loadAccounts,
    loadAudit,
    loadRoles,
    loadPermissions,
    add,
    remove,
    restore,
    createRole,
    updateRole,
    removeRole,
    restoreRole,
  }
})
