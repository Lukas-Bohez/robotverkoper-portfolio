import {
  ApolloClient,
  ApolloError,
  createHttpLink,
  InMemoryCache,
  type DocumentNode,
} from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { useAuthStore } from '@/stores/auth'

/** GraphQL HTTP endpoint from VITE_API_URL (never derived from the page Host). */
export function apiUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:3000/graphql'
}

const authLink = setContext(async (_, { headers }) => {
  const token = await useAuthStore().getIdToken()
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }
})

const client = new ApolloClient({
  link: authLink.concat(createHttpLink({ uri: apiUrl() })),
  cache: new InMemoryCache(),
  // Companies and robots must be live: no cached lists
  defaultOptions: {
    query: { fetchPolicy: 'network-only' },
    mutate: { fetchPolicy: 'no-cache' },
  },
})

/** Small wrapper so screens (and their tests) do not need the Apollo client itself */
export const graphql = {
  async query<T>(query: DocumentNode, variables?: Record<string, unknown>): Promise<T> {
    const { data } = await client.query<T>({ query, variables })
    return data
  },
  async mutate<T>(mutation: DocumentNode, variables?: Record<string, unknown>): Promise<T> {
    const { data } = await client.mutate<T>({ mutation, variables })
    if (!data) throw new Error('The API gave no answer')
    return data
  },
  /** Forget everything of the previous user (after a login or logout) */
  async reset(): Promise<void> {
    await client.clearStore()
  },
}

/** The message of the API (a GraphQL error), else a plain one */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApolloError) {
    const first = error.graphQLErrors[0]?.message
    if (first) return first
    if (error.networkError) return fallback
  }
  return error instanceof Error && error.message ? error.message : fallback
}
