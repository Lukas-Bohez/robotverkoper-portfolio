import { ApolloClient, createHttpLink, from, InMemoryCache, split } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { logErrorMessages } from '@vue/apollo-util'
import { createClient } from 'graphql-ws'
import { useAuthStore } from '@/stores/auth'

/** The GraphQL endpoint of the seller API, from VITE_API_URL (never derived from the page address) */
export function graphqlHttpUri(): string {
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:4200').replace(/\/+$/, '')
  return base.endsWith('/graphql') ? base : `${base}/graphql`
}

/** The login token, as the API wants it. Public operations (the health check) do not need it. */
export async function graphqlRequestHeaders(): Promise<Record<string, string>> {
  const token = await useAuthStore().getIdToken()
  return token ? { authorization: `Bearer ${token}` } : {}
}

const httpUri = graphqlHttpUri()

const httpLink = createHttpLink({ uri: httpUri })

// Every request carries the token of whoever is logged in
const authLink = setContext(async (_, { headers }) => ({
  headers: { ...headers, ...(await graphqlRequestHeaders()) },
}))

// What went wrong is logged nicely in the console of the browser while developing; the screens show their own sentence
const errorLink = onError(error => {
  if (import.meta.env.DEV) logErrorMessages(error)
})

// Subscriptions (realtime) go over a websocket; the token travels in the connectionParams, because a websocket has
// no headers per message
const wsClient = createClient({
  url: httpUri.replace(/^http/, 'ws'),
  lazy: true,
  connectionParams: graphqlRequestHeaders,
})

const apolloClient = new ApolloClient({
  link: split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription'
    },
    new GraphQLWsLink(wsClient),
    from([authLink, errorLink, httpLink]),
  ),
  cache: new InMemoryCache(),
  // Companies, robots and defects must be live: nothing is served from the cache of the browser
  defaultOptions: {
    query: { fetchPolicy: 'no-cache' },
    watchQuery: { fetchPolicy: 'no-cache' },
    mutate: { fetchPolicy: 'no-cache' },
  },
})

/** Reconnect the websocket, e.g. after another person logs in (a new token) */
function restartRealtime() {
  wsClient.terminate()
}

export default () => ({ apolloClient, restartRealtime })
