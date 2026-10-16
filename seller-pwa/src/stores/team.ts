import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Account, AuditEntry, SellerRole } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import { ACCOUNTS, ADD_ACCOUNT, AUDIT_LOG, REMOVE_ACCOUNT } from '@/graphql/accounts.query'

/** Our own staff (admin and technician) and the log of what they did */
export const useTeamStore = defineStore('team', () => {
  const { apolloClient } = useGraphql()
  const accounts = ref<Account[]>([])
  const audit = ref<AuditEntry[]>([])

  async function loadAccounts(): Promise<void> {
    const { data } = await apolloClient.query({ query: ACCOUNTS })
    accounts.value = data.accounts
  }

  async function loadAudit(limit = 20): Promise<void> {
    const { data } = await apolloClient.query({ query: AUDIT_LOG, variables: { limit } })
    audit.value = data.auditLog
  }

  async function add(email: string, role: SellerRole): Promise<Account> {
    const { data } = await apolloClient.mutate({ mutation: ADD_ACCOUNT, variables: { input: { email, role } } })
    if (!data) throw new Error('No account came back')
    return data.addAccount
  }

  async function remove(email: string): Promise<void> {
    await apolloClient.mutate({ mutation: REMOVE_ACCOUNT, variables: { email } })
  }

  return { accounts, audit, loadAccounts, loadAudit, add, remove }
})
