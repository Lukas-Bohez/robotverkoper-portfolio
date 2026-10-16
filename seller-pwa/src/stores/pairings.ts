import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { WaitingPairing } from '@/api/types'
import useGraphql from '@/composables/useGraphql'
import { DELIVER_TO_SIMULATOR, WAITING_PAIRINGS } from '@/graphql/pairings.query'

/**
 * The simulators (the phone, the Windows app) that wait for the key of a new robot. The list is kept up to
 * date by a subscription in the dialog that shows the key (see lib/handoff.ts).
 */
export const usePairingsStore = defineStore('pairings', () => {
  const { apolloClient } = useGraphql()
  const waiting = ref<WaitingPairing[]>([])

  async function load(): Promise<void> {
    const { data } = await apolloClient.query({ query: WAITING_PAIRINGS })
    waiting.value = data.waitingPairings
  }

  /** Hands the key to a waiting simulator. Nothing of it is written down by the API. */
  async function deliver(pairingId: string, robotId: string, apiKey: string): Promise<void> {
    await apolloClient.mutate({
      mutation: DELIVER_TO_SIMULATOR,
      variables: { pairingId, input: { robotId, apiKey } },
    })
  }

  return { waiting, load, deliver }
})
