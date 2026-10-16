import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Company, PlatformSource } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import { COMPANIES, COMPANY, CREATE_COMPANY, type CreateCompanyVariables } from '@/graphql/companies.query'

/** The companies that use our robots (a copy of the platform: no staff, no customers) */
export const useCompaniesStore = defineStore('companies', () => {
  const { apolloClient } = useGraphql()
  const items = ref<Company[]>([])
  /** PLATFORM: just answered by the platform. CACHE: the platform did not answer, this is the last known list */
  const source = ref<PlatformSource>('PLATFORM')

  async function load(): Promise<void> {
    const { data } = await apolloClient.query({ query: COMPANIES })
    items.value = data.companies.items
    source.value = data.companies.source
  }

  /** One company, or null when it does not exist (any other failure is thrown) */
  async function find(id: string): Promise<Company | null> {
    try {
      const { data } = await apolloClient.query({ query: COMPANY, variables: { id } })
      return data.company
    } catch (error) {
      const code = (error as { graphQLErrors?: { extensions?: { code?: string } }[] }).graphQLErrors?.[0]?.extensions?.code
      if (code === 'NOT_FOUND') return null
      throw error
    }
  }

  async function create(input: CreateCompanyVariables['input']): Promise<Company> {
    const { data } = await apolloClient.mutate({ mutation: CREATE_COMPANY, variables: { input } })
    if (!data) throw new Error('No company came back')
    return data.createCompany
  }

  return { items, source, load, find, create }
})
