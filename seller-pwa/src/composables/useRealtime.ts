import { onBeforeUnmount, ref, type Ref } from 'vue'
import { useSubscription } from '@vue/apollo-composable'
import type { Defect, TechnicianCall } from '@/api/types'
import { DEFECT_UPDATED, DEFECTS_CHANGED, TECHNICIAN_CALLED } from '@/graphql/defects.query'
import { usePlaceStore } from '@/stores/place'

/** When the websocket is down, a screen asks again every 10 seconds instead */
const POLL_MS = 10_000
/** Several changes in a row (a technician ticks four boxes) load the list once */
const DEBOUNCE_MS = 300

/**
 * A list of defects that follows the API: when a defect is reported, taken, closed or replaced, the API pushes
 * `defectsChanged` over the websocket and the screen loads again. Without a websocket the screen polls.
 */
export function useDefectsRealtime(reload: () => void | Promise<void>): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let poll: ReturnType<typeof setInterval> | undefined

  const later = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void reload(), DEBOUNCE_MS)
  }

  const { onResult, onError } = useSubscription(DEFECTS_CHANGED)
  onResult(later)
  onError(() => {
    poll ??= setInterval(() => void reload(), POLL_MS)
  })

  onBeforeUnmount(() => {
    clearTimeout(timer)
    clearInterval(poll)
  })
}

/**
 * The detail screen of one defect: it follows that defect (the API only sends this one). Without a websocket the screen
 * loads the defect again every 10 seconds.
 */
export function useDefectRealtime(
  defectId: string,
  onUpdate: (defect: Defect) => void,
  reload: () => void | Promise<void>,
): void {
  const place = usePlaceStore()
  let poll: ReturnType<typeof setInterval> | undefined

  const { onResult, onError } = useSubscription(DEFECT_UPDATED, () => ({ defectId, ...place.variables }))
  onResult(({ data }) => {
    if (data) onUpdate(data.defectUpdated)
  })
  onError(() => {
    poll ??= setInterval(() => void reload(), POLL_MS)
  })
  onBeforeUnmount(() => clearInterval(poll))
}

/**
 * Someone calls for a technician (an administrator) or asks for help (a colleague): the dashboard of the technician
 * hears it at once. Returns the latest call and a way to dismiss it.
 */
export function useTechnicianCalls(): { call: Ref<TechnicianCall | null>; dismiss: () => void } {
  const call = ref<TechnicianCall | null>(null)
  const { onResult } = useSubscription(TECHNICIAN_CALLED)
  onResult(({ data }) => {
    if (data) call.value = data.technicianCalled
  })
  return { call, dismiss: () => (call.value = null) }
}
