import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { List } from '@/api/types'
import { api } from '@/lib/api'

/** A simulator (the phone or the Windows app) that waits for the key of a robot */
export interface Pairing {
  id: string
  device: string
  code: string
  /** It runs on this very computer: then the key goes to it without asking */
  loopback: boolean
  createdAt: string
}

const POLL_MS = 2000

/**
 * Sends the key of a new robot straight to the simulator, so nobody copies it by hand.
 * A simulator on this computer gets it at once; one elsewhere (a phone) shows a code and is
 * chosen with a click. The key goes through the seller API in memory and is handed over once.
 */
export function useSimulatorHandoff(robotId: string, apiKey: string) {
  const waiting = ref<Pairing[]>([])
  const sentTo = ref<Pairing | null>(null)
  const sending = ref(false)
  const failed = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined
  let busy = false

  async function send(pairing: Pairing): Promise<void> {
    if (sentTo.value || sending.value) return
    sending.value = true
    failed.value = false
    try {
      await api.post(`/pairings/${encodeURIComponent(pairing.id)}/deliver`, { robotId, apiKey })
      sentTo.value = pairing
      stop()
    } catch {
      failed.value = true
    } finally {
      sending.value = false
    }
  }

  async function poll(): Promise<void> {
    if (busy || sentTo.value) return
    busy = true
    try {
      const { items } = await api.get<List<Pairing>>('/pairings')
      waiting.value = items
      const local = items.find((pairing) => pairing.loopback)
      if (local && !failed.value) await send(local)
    } catch {
      waiting.value = []
    } finally {
      busy = false
    }
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  onMounted(() => {
    void poll()
    timer = setInterval(() => void poll(), POLL_MS)
  })
  onBeforeUnmount(stop)

  return { waiting, sentTo, sending, failed, send }
}
