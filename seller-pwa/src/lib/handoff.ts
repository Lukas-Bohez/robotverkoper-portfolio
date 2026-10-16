import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSubscription } from '@vue/apollo-composable'
import type { WaitingPairing } from '@/api/types'
import { WAITING_PAIRINGS_CHANGED } from '@/graphql/pairings.query'
import { usePairingsStore } from '@/stores/pairings'

/** When the websocket is down, the list of waiting simulators is asked for every 2 seconds instead */
const POLL_MS = 2000

/**
 * Sends the key of a new robot straight to the simulator, so nobody copies it by hand.
 * A simulator on this computer gets it at once; one elsewhere (a phone) shows a code and is
 * chosen with a click. The key goes through the seller API in memory and is handed over once.
 *
 * The list of waiting simulators is live: the API pushes it over a GraphQL subscription
 * (`waitingPairingsChanged`), so a simulator that starts while the dialog is open shows up by itself.
 */
export function useSimulatorHandoff(robotId: string, apiKey: string) {
  const pairings = usePairingsStore()
  const sentTo = ref<WaitingPairing | null>(null)
  const sending = ref(false)
  const failed = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined
  let busy = false

  async function send(pairing: WaitingPairing): Promise<void> {
    if (sentTo.value || sending.value) return
    sending.value = true
    failed.value = false
    try {
      await pairings.deliver(pairing.id, robotId, apiKey)
      sentTo.value = pairing
      stopPolling()
    } catch {
      failed.value = true
    } finally {
      sending.value = false
    }
  }

  /** A simulator on this very computer gets the key without asking */
  async function adopt(list: WaitingPairing[]): Promise<void> {
    pairings.waiting = list
    const local = list.find(pairing => pairing.loopback)
    if (local && !failed.value) await send(local)
  }

  async function poll(): Promise<void> {
    if (busy || sentTo.value) return
    busy = true
    try {
      await pairings.load()
      await adopt(pairings.waiting)
    } catch {
      pairings.waiting = []
    } finally {
      busy = false
    }
  }

  function startPolling(): void {
    if (!timer) timer = setInterval(() => void poll(), POLL_MS)
  }

  function stopPolling(): void {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  const { onResult, onError } = useSubscription(WAITING_PAIRINGS_CHANGED)
  onResult(({ data }) => {
    if (data && !sentTo.value) void adopt(data.waitingPairingsChanged)
  })
  onError(startPolling)

  onMounted(() => void poll())
  onBeforeUnmount(stopPolling)

  const waiting = computed(() => pairings.waiting)
  return { waiting, sentTo, sending, failed, send }
}
