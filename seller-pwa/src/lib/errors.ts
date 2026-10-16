import { ApolloError } from '@apollo/client/core'
import { i18n } from '@/i18n'

/**
 * A sentence for the person: the translation of the stable error code of the API (`apiErrors.<code>`) when we have
 * one, else the fallback of the screen. The code is the `domainCode` of the GraphQL error (for example
 * `subdomain_taken`), or the standard code of its status (UNAUTHENTICATED, FORBIDDEN).
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const keys: string[] = []
  if (error instanceof ApolloError) {
    for (const graphQLError of error.graphQLErrors) {
      const { domainCode, code } = graphQLError.extensions as { domainCode?: string; code?: string }
      if (domainCode) keys.push(`apiErrors.${domainCode}`)
      if (code === 'UNAUTHENTICATED') keys.push('apiErrors.unauthorized')
      if (code === 'FORBIDDEN') keys.push('apiErrors.forbidden')
    }
    if (error.networkError) keys.push('apiErrors.network')
  }
  const key = keys.find(candidate => i18n.global.te(candidate))
  return key ? i18n.global.t(key) : fallback
}
